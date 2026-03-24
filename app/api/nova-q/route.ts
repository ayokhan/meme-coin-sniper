import { NextResponse } from "next/server";
import { getSessionAndSubscription } from "@/lib/auth-server";
import { getCandles, getTicker } from "@/lib/hyperliquid";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

const NOVA_Q_TIMEFRAMES = [
  { id: "5m", label: "5 mins", interval: "1m", limit: 5 },
  { id: "15m", label: "15 mins", interval: "1m", limit: 15 },
  { id: "30m", label: "30 mins", interval: "1m", limit: 30 },
  { id: "1h", label: "1 hour", interval: "1m", limit: 60 },
  { id: "4h", label: "4 hours", interval: "5m", limit: 48 },
  { id: "24h", label: "24 hours", interval: "1h", limit: 24 },
  { id: "48h", label: "48 hours", interval: "1h", limit: 48 },
  { id: "72h", label: "72 hours", interval: "1h", limit: 72 },
  { id: "1w", label: "1 week", interval: "1d", limit: 7 },
  { id: "2w", label: "2 weeks", interval: "1d", limit: 14 },
] as const;

type CandleTuple = [string, string, string, string, string, ...string[]];

type NovaQTfResult = {
  id: string;
  label: string;
  support: number;
  resistance: number;
  direction: "bullish" | "bearish" | "sideways";
};

function highLowFromCandles(candles: CandleTuple[]): { high: number; low: number } | null {
  if (!candles.length) return null;
  const highs = candles.map((c) => Number(c[2])).filter((n) => Number.isFinite(n));
  const lows = candles.map((c) => Number(c[3])).filter((n) => Number.isFinite(n));
  if (highs.length === 0 || lows.length === 0) return null;
  return { high: Math.max(...highs), low: Math.min(...lows) };
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

    const tfResults: NovaQTfResult[] = [];
    for (const tf of effectiveTf) {
      try {
        const candles = await getCandles(symbol, tf.interval, tf.limit);
        const hl = highLowFromCandles(candles as CandleTuple[]);
        if (!hl) continue;
        tfResults.push({
          id: tf.id,
          label: tf.label,
          support: hl.low,
          resistance: hl.high,
          direction: getTfDirection(candles as CandleTuple[]),
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
        timeframes: tfResults,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "NovaQ failed";
    console.error("NovaQ error:", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
