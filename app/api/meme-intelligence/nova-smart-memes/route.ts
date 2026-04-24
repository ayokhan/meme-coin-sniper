import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import axios from "axios";
import { getNovaSmartMemesAccess } from "@/lib/vip-futures-addon-access";
import { getBscToken, getSolanaToken, type DexPair } from "@/lib/api-clients/dexscreener";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

const MEME_SMART_TIMEFRAMES = [
  { id: "5m", label: "5 mins", key: "h1", scale: 0.35 },
  { id: "15m", label: "15 mins", key: "h1", scale: 0.55 },
  { id: "30m", label: "30 mins", key: "h1", scale: 0.8 },
  { id: "1h", label: "1 hour", key: "h1", scale: 1 },
  { id: "2h", label: "2 hours", key: "h6", scale: 0.55 },
  { id: "4h", label: "4 hours", key: "h6", scale: 0.85 },
  { id: "24h", label: "24 hours", key: "h24", scale: 1 },
  { id: "1w", label: "1 week", key: "h24", scale: 1.35 },
] as const;

function normalizeSymbol(raw: string): string {
  const upper = String(raw ?? "").trim().toUpperCase();
  const base = upper.replace(/\/USDT$/i, "").replace(/\/USD$/i, "").replace(/-USDT$/i, "").replace(/\.USDT$/i, "").trim();
  return base || "PEPE";
}

function isLikelySolanaMint(input: string): boolean {
  const s = input.trim();
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);
}

function isLikelyEvmAddress(input: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(input.trim());
}

async function resolveOneSymbol(raw: string): Promise<{ symbol: string; note?: string }> {
  const trimmed = raw.trim();
  if (!trimmed) return { symbol: "PEPE" };
  if (isLikelySolanaMint(trimmed)) {
    const pair = await getSolanaToken(trimmed);
    const resolved = pair?.baseToken?.symbol?.trim().toUpperCase();
    if (resolved) return { symbol: normalizeSymbol(resolved), note: `Resolved Solana contract to ${resolved}.` };
  }
  if (isLikelyEvmAddress(trimmed)) {
    const pair = await getBscToken(trimmed);
    const resolved = pair?.baseToken?.symbol?.trim().toUpperCase();
    if (resolved) return { symbol: normalizeSymbol(resolved), note: `Resolved EVM contract to ${resolved}.` };
  }
  return { symbol: normalizeSymbol(trimmed) };
}

async function getDexPairForInput(rawInput: string, symbol: string): Promise<DexPair | null> {
  const trimmed = rawInput.trim();
  if (isLikelySolanaMint(trimmed)) return getSolanaToken(trimmed);
  if (isLikelyEvmAddress(trimmed)) return getBscToken(trimmed);
  try {
    const res = await axios.get<{ pairs?: DexPair[] }>("https://api.dexscreener.com/latest/dex/search", {
      params: { q: symbol },
      timeout: 15000,
    });
    const pairs = res.data?.pairs ?? [];
    const ranked = pairs
      .filter((p) => ["solana", "bsc", "bnb"].includes((p.chainId || "").toLowerCase()))
      .sort((a, b) => Number(b.liquidity?.usd ?? 0) - Number(a.liquidity?.usd ?? 0));
    return ranked[0] ?? null;
  } catch {
    return null;
  }
}

function pctForKey(pair: DexPair, key: "h1" | "h6" | "h24"): number {
  if (key === "h1") return Number(pair.priceChange?.h1 ?? 0);
  if (key === "h6") return Number(pair.priceChange?.h6 ?? pair.priceChange?.h24 ?? 0);
  return Number(pair.priceChange?.h24 ?? 0);
}

type SmartResult = {
  symbol: string;
  resolvedNote?: string | null;
  currentPrice: number | null;
  smartShortEntry: number;
  smartLongEntry: number;
  recommendedDirection: "long" | "short" | "neutral";
  recommendationNote: string;
  trendlineConfidence: "high" | "medium" | "low";
  trendlineConfidenceNote: string;
  deadFlag: { dead: boolean; note: string };
  timeframes: Array<{
    id: string;
    label: string;
    high: number;
    low: number;
    structureDirection: "bullish" | "bearish" | "sideways";
    trendlineBias: "up" | "down" | "flat";
    direction: "bullish" | "bearish" | "sideways";
  }>;
};

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const access = await getNovaSmartMemesAccess(session);
    if (!access.ok) {
      return NextResponse.json({ success: false, error: access.error, locked: access.status === 403 }, { status: access.status });
    }

    const body = await request.json().catch(() => ({}));
    const symbolsInput = Array.isArray(body.symbols) ? body.symbols : String(body.symbols ?? body.symbol ?? "PEPE").split(/[\s,]+/);
    const rawSymbols = symbolsInput.map((s: unknown) => String(s)).filter(Boolean).slice(0, 10);
    const tfParam = body.timeframes ?? ["15m", "1h", "24h"];
    const requested = (Array.isArray(tfParam) ? tfParam : String(tfParam).split(/[\s,]+/)).map((x) => String(x).trim().toLowerCase());
    const chosen = MEME_SMART_TIMEFRAMES.filter((t) => requested.includes(t.id));
    const effectiveTf = chosen.length > 0 ? chosen : [MEME_SMART_TIMEFRAMES[1], MEME_SMART_TIMEFRAMES[3], MEME_SMART_TIMEFRAMES[6]];

    const results: SmartResult[] = [];
    for (const rawSymbol of rawSymbols.length ? rawSymbols : ["PEPE"]) {
      const resolved = await resolveOneSymbol(rawSymbol);
      const symbol = resolved.symbol;
      const pair = await getDexPairForInput(rawSymbol, symbol);
      if (!pair) {
        results.push({
          symbol,
          resolvedNote: `${resolved.note ?? ""} No DexScreener pair found for this input.`.trim(),
          currentPrice: null,
          smartShortEntry: 0,
          smartLongEntry: 0,
          recommendedDirection: "neutral",
          recommendationNote: "No pair found. Paste a valid Solana/BSC meme contract or searchable ticker.",
          trendlineConfidence: "low",
          trendlineConfidenceNote: "No market data available.",
          deadFlag: { dead: false, note: "Insufficient data." },
          timeframes: [],
        });
        continue;
      }

      const currentPrice = Number(pair.priceUsd ?? 0) || null;
      if (currentPrice == null || currentPrice <= 0) {
        results.push({
          symbol,
          resolvedNote: resolved.note ?? null,
          currentPrice: null,
          smartShortEntry: 0,
          smartLongEntry: 0,
          recommendedDirection: "neutral",
          recommendationNote: "Price unavailable for this token.",
          trendlineConfidence: "low",
          trendlineConfidenceNote: "No market data available.",
          deadFlag: { dead: false, note: "Insufficient data." },
          timeframes: [],
        });
        continue;
      }

      const tfRows: SmartResult["timeframes"] = [];
      for (const tf of effectiveTf) {
        const basePct = pctForKey(pair, tf.key);
        const slopePct = basePct * tf.scale;
        const move = Math.max(0.01, Math.min(85, Math.abs(slopePct)));
        const high = currentPrice * (1 + move / 200);
        const low = currentPrice * (1 - move / 200);
        const structureDirection = slopePct > 2 ? "bullish" : slopePct < -2 ? "bearish" : "sideways";
        const trendlineBias = slopePct > 1 ? "up" : slopePct < -1 ? "down" : "flat";
        const direction = structureDirection === "sideways" || trendlineBias === "flat"
          ? "sideways"
          : structureDirection === "bullish" && trendlineBias === "up"
            ? "bullish"
            : structureDirection === "bearish" && trendlineBias === "down"
              ? "bearish"
              : "sideways";
        tfRows.push({
          id: tf.id,
          label: tf.label,
          high,
          low,
          structureDirection,
          trendlineBias,
          direction,
        });
      }

      const smartShortEntry = tfRows.length ? Math.max(...tfRows.map((t) => t.high)) : 0;
      const smartLongEntry = tfRows.length ? Math.min(...tfRows.map((t) => t.low)) : 0;
      const bullish = tfRows.filter((t) => t.direction === "bullish").length;
      const bearish = tfRows.filter((t) => t.direction === "bearish").length;
      const recommendedDirection: "long" | "short" | "neutral" = bullish > bearish ? "long" : bearish > bullish ? "short" : "neutral";
      const trendlineConfidence: "high" | "medium" | "low" =
        tfRows.length >= 3 && Math.max(bullish, bearish) / Math.max(1, bullish + bearish) >= 0.7
          ? "high"
          : tfRows.length >= 2
            ? "medium"
            : "low";
      const deadFlag =
        currentPrice != null && smartLongEntry > 0 && smartShortEntry > smartLongEntry && bearish >= bullish && currentPrice <= smartLongEntry * 1.03
          ? { dead: true, note: "Warning: bearish alignment near range lows. Avoid buy-the-dip unless momentum reclaims key levels." }
          : { dead: false, note: "No immediate dead-coin warning from current structure/trendline alignment." };

      results.push({
        symbol,
        resolvedNote: resolved.note ?? null,
        currentPrice,
        smartShortEntry,
        smartLongEntry,
        recommendedDirection,
        recommendationNote:
          recommendedDirection === "long"
            ? "Direction bias: Long. Favor pullback entries near support with strict risk."
            : recommendedDirection === "short"
              ? "Direction bias: Short. Favor rallies into resistance; avoid blind buys."
              : "Direction bias: Neutral. Wait for cleaner structure alignment.",
        trendlineConfidence,
        trendlineConfidenceNote: `${bullish} bullish vs ${bearish} bearish blended rows across ${tfRows.length} timeframe(s).`,
        deadFlag,
        timeframes: tfRows,
      });
    }

    return NextResponse.json({ success: true, results });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Nova Smart Memes failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
