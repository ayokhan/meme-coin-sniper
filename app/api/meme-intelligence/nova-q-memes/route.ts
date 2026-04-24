import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import axios from "axios";
import { demandSupplyRead, overallTrendlineSummary } from "@/lib/nova-q-analytics";
import { getNovaQMemesAccess } from "@/lib/vip-futures-addon-access";
import { getBscToken, getSolanaToken, type DexPair } from "@/lib/api-clients/dexscreener";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

const MEME_Q_TIMEFRAMES = [
  { id: "30s", label: "30 secs", key: "h1", scale: 0.12 },
  { id: "1m", label: "1 min", key: "h1", scale: 0.2 },
  { id: "2m", label: "2 mins", key: "h1", scale: 0.26 },
  { id: "3m", label: "3 mins", key: "h1", scale: 0.3 },
  { id: "5m", label: "5 mins", key: "h1", scale: 0.35 },
  { id: "15m", label: "15 mins", key: "h1", scale: 0.55 },
  { id: "30m", label: "30 mins", key: "h1", scale: 0.8 },
  { id: "1h", label: "1 hour", key: "h1", scale: 1 },
  { id: "2h", label: "2 hours", key: "h6", scale: 0.55 },
  { id: "4h", label: "4 hours", key: "h6", scale: 0.85 },
  { id: "24h", label: "24 hours", key: "h24", scale: 1 },
  { id: "1w", label: "1 week", key: "h24", scale: 1.35 },
] as const;

type MemeQTfResult = {
  id: string;
  label: string;
  support: number;
  resistance: number;
  structureDirection: "bullish" | "bearish" | "sideways";
  trendlineBias: "up" | "down" | "flat";
  trendlineSlopePctWindow: number;
  trendlineRead: string;
  demandSupplyRead: string;
  direction: "bullish" | "bearish" | "sideways";
  supportTouches: number;
  resistanceTouches: number;
};

function getPairMarketCap(pair: DexPair): number | null {
  const mcap = Number((pair as DexPair & { marketCap?: unknown }).marketCap ?? pair.fdv ?? 0);
  return Number.isFinite(mcap) && mcap > 0 ? mcap : null;
}

function pctForKey(pair: DexPair, key: "h1" | "h6" | "h24"): number {
  if (key === "h1") return Number(pair.priceChange?.h1 ?? 0);
  if (key === "h6") return Number(pair.priceChange?.h6 ?? pair.priceChange?.h24 ?? 0);
  return Number(pair.priceChange?.h24 ?? 0);
}

function timeframeMinutes(id: string): number {
  switch (id) {
    case "30s":
      return 0.5;
    case "1m":
      return 1;
    case "2m":
      return 2;
    case "3m":
      return 3;
    case "5m":
      return 5;
    case "15m":
      return 15;
    case "30m":
      return 30;
    case "1h":
      return 60;
    case "2h":
      return 120;
    case "4h":
      return 240;
    case "24h":
      return 1440;
    case "1w":
      return 10080;
    default:
      return 60;
  }
}

function estimateTouchesForTimeframe(args: {
  tfId: string;
  tfKey: "h1" | "h6" | "h24";
  buys: number;
  sells: number;
  absMovePct: number;
}): { supportTouches: number; resistanceTouches: number } {
  const { tfId, tfKey, buys, sells, absMovePct } = args;
  const total = Math.max(1, buys + sells);
  const minutes = timeframeMinutes(tfId);
  const windowMinutes = tfKey === "h1" ? 60 : tfKey === "h6" ? 360 : 1440;
  const activityInWindow = total * Math.max(0.02, Math.min(1, minutes / windowMinutes));
  const volFactor = 1 + Math.min(1.5, absMovePct / 18);
  const baseTouches = Math.max(1, Math.round(Math.log10(activityInWindow + 10) * 2.2 * volFactor));
  const bias = sells - buys;
  const biasNorm = bias / total;
  const supportTouches = Math.max(1, Math.round(baseTouches * (1 + Math.max(0, biasNorm) * 0.8)));
  const resistanceTouches = Math.max(1, Math.round(baseTouches * (1 + Math.max(0, -biasNorm) * 0.8)));
  return { supportTouches, resistanceTouches };
}

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

async function resolveSymbolInput(raw: string): Promise<{ symbol: string; note?: string }> {
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

function getOverallDirection(timeframes: MemeQTfResult[]): "bullish" | "bearish" | "sideways" {
  let score = 0;
  for (const tf of timeframes) {
    if (tf.direction === "bullish") score += 1;
    if (tf.direction === "bearish") score -= 1;
  }
  if (score > 0) return "bullish";
  if (score < 0) return "bearish";
  return "sideways";
}

function getDeadFlag(currentPrice: number | null, rows: MemeQTfResult[]): { dead: boolean; note: string } {
  if (currentPrice == null || rows.length === 0) {
    return { dead: false, note: "Insufficient data for dead-coin signal." };
  }
  const weekly = rows.find((r) => r.id === "1w");
  const oneDay = rows.find((r) => r.id === "24h");
  const ref = weekly ?? oneDay ?? rows[rows.length - 1];
  const range = Math.max(0.0000001, ref.resistance - ref.support);
  const pctFromResistance = ((ref.resistance - currentPrice) / Math.max(ref.resistance, 0.0000001)) * 100;
  const rangePos = (currentPrice - ref.support) / range;
  const bearishRows = rows.filter((r) => r.direction === "bearish").length;
  const mostlyBearish = bearishRows >= Math.ceil(rows.length * 0.6);
  const dead = mostlyBearish && (rangePos < 0.2 || pctFromResistance > 35);
  if (dead) {
    return {
      dead: true,
      note: "Warning: downside/dead-coin risk is elevated (majority bearish structure + trendline and price is near range lows). Avoid fresh buys until momentum recovers.",
    };
  }
  return { dead: false, note: "No strong dead-coin flag from current structure/trendline blend." };
}

function getBuyRecommendation(
  marketDirection: "bullish" | "bearish" | "sideways",
  deadFlag: { dead: boolean; note: string },
  rows: MemeQTfResult[]
): { signal: "buy" | "no_buy"; note: string } {
  const bullishRows = rows.filter((r) => r.direction === "bullish").length;
  const bearishRows = rows.filter((r) => r.direction === "bearish").length;
  if (deadFlag.dead) {
    return { signal: "no_buy", note: "No buy: dead/downside risk is elevated." };
  }
  if (marketDirection === "bullish" && bullishRows >= Math.max(2, bearishRows + 1)) {
    return { signal: "buy", note: `Buy bias: ${bullishRows} bullish timeframe reads vs ${bearishRows} bearish.` };
  }
  return { signal: "no_buy", note: "No buy: momentum/structure is mixed or bearish. Wait for stronger confirmation." };
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const access = await getNovaQMemesAccess(session);
    if (!access.ok) {
      return NextResponse.json({ success: false, error: access.error, locked: access.status === 403 }, { status: access.status });
    }

    const body = await request.json().catch(() => ({}));
    const resolved = await resolveSymbolInput(String(body.symbol ?? "PEPE"));
    const symbol = resolved.symbol;
    const rawInput = String(body.symbol ?? "PEPE");
    const tfParam = body.timeframes ?? ["15m", "1h", "24h"];
    const requested = (Array.isArray(tfParam) ? tfParam : String(tfParam).split(/[\s,]+/))
      .map((x) => String(x).trim().toLowerCase())
      .filter(Boolean);
    const selected = MEME_Q_TIMEFRAMES.filter((t) => requested.includes(t.id));
    const effectiveTf = selected.length > 0 ? selected : [MEME_Q_TIMEFRAMES[1], MEME_Q_TIMEFRAMES[3], MEME_Q_TIMEFRAMES[6]];

    const pair = await getDexPairForInput(rawInput, symbol);
    if (!pair) {
      return NextResponse.json(
        {
          success: false,
          error:
            `No DexScreener pair found for "${rawInput}". ` +
            `Paste a valid meme coin contract or searchable ticker.`,
          resolvedSymbol: symbol,
          resolvedNote: resolved.note ?? null,
        },
        { status: 404 }
      );
    }

    const currentPrice = Number(pair.priceUsd ?? 0) || null;
    const currentMarketCap = getPairMarketCap(pair);
    if (currentMarketCap == null || currentMarketCap <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Market cap unavailable from DexScreener for this coin.",
          resolvedSymbol: symbol,
          resolvedNote: resolved.note ?? null,
        },
        { status: 404 }
      );
    }

    const rows: MemeQTfResult[] = [];
    for (const tf of effectiveTf) {
      const basePct = pctForKey(pair, tf.key);
      const slopePct = basePct * tf.scale;
      const move = Math.max(0.01, Math.min(85, Math.abs(slopePct)));
      const support = currentMarketCap * (1 - move / 200);
      const resistance = currentMarketCap * (1 + move / 200);
      const structureDirection = slopePct > 2 ? "bullish" : slopePct < -2 ? "bearish" : "sideways";
      const trendlineBias = slopePct > 1 ? "up" : slopePct < -1 ? "down" : "flat";
      const direction = structureDirection === "sideways" || trendlineBias === "flat"
        ? "sideways"
        : structureDirection === "bullish" && trendlineBias === "up"
          ? "bullish"
          : structureDirection === "bearish" && trendlineBias === "down"
            ? "bearish"
            : "sideways";
      const buys = Number(
        tf.key === "h1" ? pair.txns?.h1?.buys ?? pair.txns?.h24?.buys ?? 0 : tf.key === "h6" ? pair.txns?.h6?.buys ?? pair.txns?.h24?.buys ?? 0 : pair.txns?.h24?.buys ?? 0
      );
      const sells = Number(
        tf.key === "h1" ? pair.txns?.h1?.sells ?? pair.txns?.h24?.sells ?? 0 : tf.key === "h6" ? pair.txns?.h6?.sells ?? pair.txns?.h24?.sells ?? 0 : pair.txns?.h24?.sells ?? 0
      );
      const { supportTouches, resistanceTouches } = estimateTouchesForTimeframe({
        tfId: tf.id,
        tfKey: tf.key,
        buys,
        sells,
        absMovePct: Math.abs(basePct),
      });
      rows.push({
        id: tf.id,
        label: tf.label,
        support,
        resistance,
        structureDirection,
        trendlineBias,
        trendlineSlopePctWindow: slopePct,
        trendlineRead: `Dex trend proxy from ${tf.key} change (${basePct.toFixed(2)}%) scaled to ${tf.id}.`,
        demandSupplyRead: demandSupplyRead(support, resistance, supportTouches, resistanceTouches),
        direction,
        supportTouches,
        resistanceTouches,
      });
    }

    const deadFlag = getDeadFlag(currentMarketCap, rows);
    const marketDirection = getOverallDirection(rows);
    const recommendation = getBuyRecommendation(marketDirection, deadFlag, rows);
    return NextResponse.json({
      success: true,
      result: {
        symbol,
        resolvedNote: resolved.note ?? null,
        currentPrice,
        currentMarketCap,
        marketDirection,
        recommendation,
        overallTrendlineSummary: overallTrendlineSummary(rows),
        timeframes: rows,
        deadFlag,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "NovaQ Memes failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
