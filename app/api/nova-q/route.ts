import { NextResponse } from "next/server";
import { getSessionAndSubscription } from "@/lib/auth-server";
import { getCandles, getPerpSpecFromMeta, getTicker, type HyperliquidPerpSpec } from "@/lib/hyperliquid";

/** Optional one-liner for symbols users often confuse with other venues. */
const NOVA_Q_KNOWN_ASSET_NOTES: Record<string, string> = {
  PAXG:
    "Paxos Gold (tokenized gold exposure). It is not the same instrument or ticker as classic metals XAU/USD or another venue’s XAU-USDT; NovaQ uses Hyperliquid’s perp candles and mid, which can differ from global spot references.",
};

export const dynamic = "force-dynamic";
export const maxDuration = 45;

const NOVA_Q_TIMEFRAMES = [
  { id: "5m", label: "5 mins", interval: "1m", limit: 5 },
  { id: "15m", label: "15 mins", interval: "1m", limit: 15 },
  { id: "30m", label: "30 mins", interval: "1m", limit: 30 },
  { id: "1h", label: "1 hour", interval: "1m", limit: 60 },
  { id: "2h", label: "2 hours", interval: "5m", limit: 24 },
  { id: "4h", label: "4 hours", interval: "5m", limit: 48 },
  { id: "6h", label: "6 hours", interval: "15m", limit: 24 },
  { id: "10h", label: "10 hours", interval: "15m", limit: 40 },
  { id: "12h", label: "12 hours", interval: "15m", limit: 48 },
  { id: "24h", label: "24 hours", interval: "1h", limit: 24 },
  { id: "48h", label: "48 hours", interval: "1h", limit: 48 },
  { id: "72h", label: "72 hours", interval: "1h", limit: 72 },
  { id: "1w", label: "1 week", interval: "1d", limit: 7 },
  { id: "2w", label: "2 weeks", interval: "1d", limit: 14 },
  { id: "3w", label: "3 weeks", interval: "1d", limit: 21 },
  { id: "4w", label: "4 weeks", interval: "1d", limit: 28 },
  { id: "5w", label: "5 weeks", interval: "1d", limit: 35 },
  { id: "6w", label: "6 weeks", interval: "1d", limit: 42 },
  { id: "52w", label: "52 weeks", interval: "1d", limit: 364 },
  { id: "104w", label: "104 weeks", interval: "1d", limit: 728 },
] as const;

type CandleTuple = [string, string, string, string, string, ...string[]];

type NovaQTfResult = {
  id: string;
  label: string;
  support: number;
  resistance: number;
  direction: "bullish" | "bearish" | "sideways";
  /** Candles in the window whose low traded within tolerance of period support (min low). */
  supportTouches: number;
  /** Candles in the window whose high traded within tolerance of period resistance (max high). */
  resistanceTouches: number;
};

function highLowFromCandles(candles: CandleTuple[]): { high: number; low: number } | null {
  if (!candles.length) return null;
  const highs = candles.map((c) => Number(c[2])).filter((n) => Number.isFinite(n));
  const lows = candles.map((c) => Number(c[3])).filter((n) => Number.isFinite(n));
  if (highs.length === 0 || lows.length === 0) return null;
  return { high: Math.max(...highs), low: Math.min(...lows) };
}

/** Count candles that trade near period support (min low) / resistance (max high)—useful for scalping frequency. */
function countSupportResistanceTouches(
  candles: CandleTuple[],
  support: number,
  resistance: number
): { supportTouches: number; resistanceTouches: number } {
  if (!candles.length || !Number.isFinite(support) || !Number.isFinite(resistance)) {
    return { supportTouches: 0, resistanceTouches: 0 };
  }
  const range = resistance - support;
  const mid = (resistance + support) / 2;
  // Band: ~0.08% of mid or ~1.2% of range (whichever is larger), capped so huge ranges do not swallow everything.
  const tol = Math.min(Math.max(mid * 0.0008, range * 0.012, 1e-12), Math.max(range * 0.2, mid * 0.002));
  let supportTouches = 0;
  let resistanceTouches = 0;
  for (const c of candles) {
    const hi = Number(c[2]);
    const lo = Number(c[3]);
    if (!Number.isFinite(hi) || !Number.isFinite(lo)) continue;
    if (lo <= support + tol) supportTouches += 1;
    if (hi >= resistance - tol) resistanceTouches += 1;
  }
  return { supportTouches, resistanceTouches };
}

function getTfDirection(candles: CandleTuple[]): "bullish" | "bearish" | "sideways" {
  if (candles.length < 3) return "sideways";
  const closesNewestFirst = candles.map((c) => Number(c[4])).filter((n) => Number.isFinite(n));
  if (closesNewestFirst.length < 3) return "sideways";
  const closes = [...closesNewestFirst].reverse();
  const mid = Math.floor(closes.length / 2);
  const first = closes.slice(0, mid);
  const second = closes.slice(mid);
  if (first.length === 0 || second.length === 0) return "sideways";
  const avg = (arr: number[]) => arr.reduce((sum, n) => sum + n, 0) / arr.length;
  const firstAvg = avg(first);
  const secondAvg = avg(second);
  if (!Number.isFinite(firstAvg) || !Number.isFinite(secondAvg) || firstAvg <= 0) return "sideways";
  const pct = (secondAvg - firstAvg) / firstAvg;
  if (pct > 0.0025) return "bullish";
  if (pct < -0.0025) return "bearish";
  return "sideways";
}

function normalizeSymbol(raw: string): string {
  const upper = raw.trim().toUpperCase();
  const base = upper.replace(/\/USDT$/i, "").replace(/\/USD$/i, "").replace(/-USDT$/i, "").replace(/\.USDT$/i, "").trim();
  return base || "BTC";
}

function buildContractDescription(symbol: string, spec: HyperliquidPerpSpec | null): string {
  if (!spec) {
    return `${symbol} is not listed as a USDC-margined perpetual in Hyperliquid’s meta. NovaQ only analyzes Hyperliquid markets—try the exact HL coin name (for gold on HL, use PAXG).`;
  }
  const minStep = Math.pow(10, -spec.szDecimals);
  const base = `${spec.name}: Hyperliquid USDC-margined perpetual, max leverage ${spec.maxLeverage}x, minimum size step about ${minStep} ${spec.name}.`;
  const extra = NOVA_Q_KNOWN_ASSET_NOTES[spec.name];
  return extra ? `${base} ${extra}` : base;
}

function getOverallDirection(timeframes: NovaQTfResult[]): "bullish" | "bearish" | "sideways" {
  if (timeframes.length === 0) return "sideways";
  let score = 0;
  for (const tf of timeframes) {
    if (tf.direction === "bullish") score += 1;
    if (tf.direction === "bearish") score -= 1;
  }
  if (score > 0) return "bullish";
  if (score < 0) return "bearish";
  return "sideways";
}

export async function POST(request: Request) {
  try {
    const { tier } = await getSessionAndSubscription();
    if (tier !== "vip") {
      return NextResponse.json(
        { success: false, error: "NovaQ is for VIP subscribers.", locked: true },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const symbol = normalizeSymbol(String(body.symbol ?? "BTC"));
    const timeframesParam = body.timeframes ?? body.tf ?? ["15m", "1h", "1w"];
    const requestedTf = (typeof timeframesParam === "string"
      ? timeframesParam.split(/[\s,]+/).map((s) => s.trim().toLowerCase())
      : Array.isArray(timeframesParam)
        ? timeframesParam.map((s) => String(s).trim().toLowerCase())
        : []
    ).filter(Boolean);

    const selected = NOVA_Q_TIMEFRAMES.filter((t) => requestedTf.includes(t.id));
    const effectiveTf = selected.length > 0 ? selected : [NOVA_Q_TIMEFRAMES[1], NOVA_Q_TIMEFRAMES[3], NOVA_Q_TIMEFRAMES[8]]; // 15m, 1h, 1w

    let contractDescription = "";
    try {
      const spec = await getPerpSpecFromMeta(symbol);
      contractDescription = buildContractDescription(symbol, spec);
    } catch {
      contractDescription = `${symbol}: contract details temporarily unavailable (Hyperliquid meta).`;
    }

    const tfResults: NovaQTfResult[] = [];
    for (const tf of effectiveTf) {
      try {
        const candles = await getCandles(symbol, tf.interval, tf.limit);
        const hl = highLowFromCandles(candles as CandleTuple[]);
        if (!hl) continue;
        const { supportTouches, resistanceTouches } = countSupportResistanceTouches(
          candles as CandleTuple[],
          hl.low,
          hl.high
        );
        tfResults.push({
          id: tf.id,
          label: tf.label,
          support: hl.low,
          resistance: hl.high,
          direction: getTfDirection(candles as CandleTuple[]),
          supportTouches,
          resistanceTouches,
        });
      } catch {
        // Ignore a failed timeframe and continue with others.
      }
    }

    const ticker = await getTicker(symbol);
    const currentPrice = ticker?.last ? Number(ticker.last) : null;
    const marketDirection = getOverallDirection(tfResults);

    return NextResponse.json({
      success: true,
      result: {
        symbol,
        currentPrice,
        marketDirection,
        contractDescription,
        timeframes: tfResults,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "NovaQ failed";
    console.error("NovaQ error:", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
