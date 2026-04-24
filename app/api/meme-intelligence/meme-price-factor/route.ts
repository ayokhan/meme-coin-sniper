import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getMemePriceFactorAccess } from "@/lib/vip-futures-addon-access";
import { getBscToken, getSolanaToken, type DexPair } from "@/lib/api-clients/dexscreener";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

const TF_OPTIONS = [
  { id: "60s", label: "60 secs", key: "h1", scale: 0.18, minutes: 1 },
  { id: "1m", label: "1 min", key: "h1", scale: 0.2, minutes: 1 },
  { id: "3m", label: "3 mins", key: "h1", scale: 0.32, minutes: 3 },
  { id: "5m", label: "5 mins", key: "h1", scale: 0.42, minutes: 5 },
  { id: "15m", label: "15 mins", key: "h1", scale: 0.62, minutes: 15 },
  { id: "30m", label: "30 mins", key: "h1", scale: 0.82, minutes: 30 },
  { id: "1h", label: "1 hour", key: "h1", scale: 1, minutes: 60 },
  { id: "2h", label: "2 hours", key: "h6", scale: 0.6, minutes: 120 },
  { id: "4h", label: "4 hours", key: "h6", scale: 0.9, minutes: 240 },
  { id: "8h", label: "8 hours", key: "h24", scale: 0.55, minutes: 480 },
  { id: "12h", label: "12 hours", key: "h24", scale: 0.7, minutes: 720 },
  { id: "24h", label: "24 hours", key: "h24", scale: 1, minutes: 1440 },
  { id: "48h", label: "48 hours", key: "h24", scale: 1.35, minutes: 2880 },
  { id: "72h", label: "72 hours", key: "h24", scale: 1.7, minutes: 4320 },
  { id: "1w", label: "1 week", key: "h24", scale: 2.1, minutes: 10080 },
] as const;

type TfOption = (typeof TF_OPTIONS)[number];

function isLikelySolanaMint(input: string): boolean {
  const s = input.trim();
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);
}

function isLikelyEvmAddress(input: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(input.trim());
}

function getPairMarketCap(pair: DexPair): number | null {
  const mcap = Number((pair as DexPair & { marketCap?: unknown }).marketCap ?? 0);
  return Number.isFinite(mcap) && mcap > 0 ? mcap : null;
}

function pctForKey(pair: DexPair, key: "h1" | "h6" | "h24"): number {
  if (key === "h1") return Number(pair.priceChange?.h1 ?? 0);
  if (key === "h6") return Number(pair.priceChange?.h6 ?? pair.priceChange?.h24 ?? 0);
  return Number(pair.priceChange?.h24 ?? 0);
}

function estimateCounts(tf: TfOption, pair: DexPair, absMovePct: number): { lowCount: number; highCount: number } {
  const buys = Number(tf.key === "h1" ? pair.txns?.h1?.buys ?? 0 : tf.key === "h6" ? pair.txns?.h6?.buys ?? 0 : pair.txns?.h24?.buys ?? 0);
  const sells = Number(tf.key === "h1" ? pair.txns?.h1?.sells ?? 0 : tf.key === "h6" ? pair.txns?.h6?.sells ?? 0 : pair.txns?.h24?.sells ?? 0);
  const total = Math.max(1, buys + sells);
  const windowMinutes = tf.key === "h1" ? 60 : tf.key === "h6" ? 360 : 1440;
  const activityInWindow = total * Math.max(0.02, Math.min(1, tf.minutes / windowMinutes));
  const volFactor = 1 + Math.min(1.5, absMovePct / 18);
  const baseCount = Math.max(1, Math.round(Math.log10(activityInWindow + 10) * 2.2 * volFactor));
  const bias = (sells - buys) / total;
  const lowCount = Math.max(1, Math.round(baseCount * (1 + Math.max(0, bias) * 0.8)));
  const highCount = Math.max(1, Math.round(baseCount * (1 + Math.max(0, -bias) * 0.8)));
  return { lowCount, highCount };
}

function estimateMcapRangeFromChange(currentMcap: number, pctChange: number): { lowMcap: number; highMcap: number } {
  // current = past * (1 + pct/100)
  // => past = current / (1 + pct/100)
  const denom = 1 + pctChange / 100;
  const safeDenom = Math.abs(denom) < 0.01 ? (denom < 0 ? -0.01 : 0.01) : denom;
  const historicalMcap = currentMcap / safeDenom;
  const low = Math.max(0, Math.min(currentMcap, historicalMcap));
  const high = Math.max(currentMcap, historicalMcap);
  return { lowMcap: low, highMcap: high };
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const access = await getMemePriceFactorAccess(session);
    if (!access.ok) {
      return NextResponse.json({ success: false, error: access.error, locked: access.status === 403 }, { status: access.status });
    }

    const body = await request.json().catch(() => ({}));
    const contract = String(body.contract ?? "").trim();
    const timeframeParam = body.timeframes ?? body.timeframe ?? ["1h"];
    if (!contract) {
      return NextResponse.json({ success: false, error: "Contract is required." }, { status: 400 });
    }
    const requested = (Array.isArray(timeframeParam) ? timeframeParam : String(timeframeParam).split(/[\s,]+/))
      .map((x) => String(x).trim().toLowerCase())
      .filter(Boolean);
    const selected = TF_OPTIONS.filter((x) => requested.includes(x.id));
    const effectiveTfs = selected.length ? selected : [TF_OPTIONS.find((x) => x.id === "1h")!];

    let pair: DexPair | null = null;
    if (isLikelySolanaMint(contract)) pair = await getSolanaToken(contract);
    if (!pair && isLikelyEvmAddress(contract)) pair = await getBscToken(contract);
    if (!pair) {
      return NextResponse.json({ success: false, error: "No pair found for this contract. Paste a valid Solana/BSC contract." }, { status: 404 });
    }

    const currentMcap = getPairMarketCap(pair);
    if (!currentMcap) {
      return NextResponse.json({ success: false, error: "Market cap unavailable for this pair right now." }, { status: 404 });
    }

    const rows = effectiveTfs.map((tf) => {
      const basePct = pctForKey(pair, tf.key);
      const slopePct = basePct * tf.scale;
      const { lowMcap, highMcap } = estimateMcapRangeFromChange(currentMcap, slopePct);
      const { lowCount, highCount } = estimateCounts(tf, pair, Math.abs(basePct));
      return {
        timeframe: tf.id,
        timeframeLabel: tf.label,
        lowMcap,
        highMcap,
        lowCount,
        highCount,
        netChangePct: slopePct,
      };
    });

    return NextResponse.json({
      success: true,
      result: {
        symbol: pair.baseToken?.symbol ?? "UNKNOWN",
        contract,
        currentMcap,
        rows,
        analyzedAt: new Date().toISOString(),
        pairAddress: pair.pairAddress ?? null,
        dexUrl: (pair as DexPair & { url?: string }).url ?? null,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Meme Price Factor failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
