import { NextResponse } from "next/server";
import { getSessionAndSubscription } from "@/lib/auth-server";
import { getCandles, getTicker } from "@/lib/hyperliquid";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

/** Timeframe config for NovaSmart: id, label, interval, bar count. */
const NOVA_SMART_TIMEFRAMES = [
  { id: "15m", label: "15 mins", interval: "1m", limit: 15 },
  { id: "1h", label: "1 hour", interval: "1m", limit: 60 },
  { id: "4h", label: "4 hours", interval: "5m", limit: 48 },
  { id: "24h", label: "24 hours", interval: "1h", limit: 24 },
  { id: "1w", label: "1 week", interval: "1d", limit: 7 },
  { id: "2w", label: "2 weeks", interval: "1d", limit: 14 },
] as const;

type CandleTuple = [string, string, string, string, string, ...string[]];

function highLowFromCandles(candles: CandleTuple[]): { high: number; low: number } | null {
  if (!candles.length) return null;
  const highs = candles.map((c) => Number(c[2])).filter((n) => Number.isFinite(n));
  const lows = candles.map((c) => Number(c[3])).filter((n) => Number.isFinite(n));
  if (highs.length === 0 || lows.length === 0) return null;
  return { high: Math.max(...highs), low: Math.min(...lows) };
}

/** Derive strategy: scalp (quick in/out), swing (hold for bigger move), or mixed. */
function deriveStrategy(
  tfData: { id: string; high: number; low: number }[],
  currentPrice: number | null
): { strategy: "scalp" | "swing" | "mixed"; note: string } {
  if (tfData.length === 0) return { strategy: "swing", note: "Insufficient data." };
  const ranges = tfData.map((t) => ({ id: t.id, range: t.high - t.low }));
  const minRange = Math.min(...ranges.map((r) => r.range));
  const maxRange = Math.max(...ranges.map((r) => r.range));
  const allHighs = tfData.map((t) => t.high);
  const allLows = tfData.map((t) => t.low);
  const smartHigh = Math.max(...allHighs);
  const smartLow = Math.min(...allLows);
  const fullRange = smartHigh - smartLow;
  if (fullRange <= 0) return { strategy: "swing", note: "Range too small." };

  const ratio = maxRange > 0 ? minRange / maxRange : 0;
  let strategy: "scalp" | "swing" | "mixed" = "swing";
  let note = "";

  if (ratio < 0.2) {
    strategy = "scalp";
    note = "Short timeframes show tight range vs longer TFs—consider quick scalps for fast profit.";
  } else if (ratio > 0.6) {
    strategy = "swing";
    note = "Timeframes aligned—consider swinging for a larger move.";
  } else {
    strategy = "mixed";
    note = "Mix of timeframes—scalp on pullbacks or swing if price reaches smart entry.";
  }

  if (currentPrice != null) {
    if (currentPrice >= smartHigh * 0.99) note += " Price near smart short zone.";
    else if (currentPrice <= smartLow * 1.01) note += " Price near smart long zone.";
    else if (currentPrice > (smartHigh + smartLow) / 2) note += " Above range mid—bias short.";
    else note += " Below range mid—bias long.";
  }

  return { strategy, note };
}

export type NovaSmartTfResult = {
  id: string;
  label: string;
  high: number;
  low: number;
};

export type NovaSmartResult = {
  symbol: string;
  timeframes: NovaSmartTfResult[];
  smartShortEntry: number;
  smartLongEntry: number;
  currentPrice: number | null;
  strategy: "scalp" | "swing" | "mixed";
  strategyNote: string;
};

/** POST - NovaSmart Analysis: multi-timeframe high/low, smart entry, scalp vs swing. VIP only. */
export async function POST(request: Request) {
  try {
    const { tier } = await getSessionAndSubscription();
    if (tier !== "vip") {
      return NextResponse.json(
        { success: false, error: "NovaSmart Analysis is for VIP subscribers.", locked: true },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const symbolsParam = body.symbols ?? body.symbol ?? "";
    const timeframesParam = body.timeframes ?? body.tf ?? "15m,1h,1w";

    const symbols: string[] = typeof symbolsParam === "string"
      ? symbolsParam.split(/[\s,]+/).map((s) => s.trim().toUpperCase()).filter(Boolean)
      : Array.isArray(symbolsParam)
        ? symbolsParam.map((s) => String(s).trim().toUpperCase()).filter(Boolean)
        : [];

    if (symbols.length === 0) {
      return NextResponse.json(
        { success: false, error: "At least one symbol is required (e.g. BTC, ETH, or a custom symbol)." },
        { status: 400 }
      );
    }

    const requestedTf = (typeof timeframesParam === "string"
      ? timeframesParam.split(/[\s,]+/).map((s) => s.trim().toLowerCase())
      : timeframesParam
    ).filter(Boolean);
    const timeframes = NOVA_SMART_TIMEFRAMES.filter((t) => requestedTf.includes(t.id));
    const effectiveTf = timeframes.length > 0 ? timeframes : [NOVA_SMART_TIMEFRAMES[0], NOVA_SMART_TIMEFRAMES[1], NOVA_SMART_TIMEFRAMES[4]]; // 15m, 1h, 1w default

    const results: NovaSmartResult[] = [];
    const limit = Math.min(symbols.length, 10);

    for (const symbol of symbols.slice(0, limit)) {
      try {
        const tfData: { id: string; label: string; high: number; low: number }[] = [];
        for (const tf of effectiveTf) {
          const candles = await getCandles(symbol, tf.interval, tf.limit);
          const hl = highLowFromCandles(candles as CandleTuple[]);
          if (hl) tfData.push({ id: tf.id, label: tf.label, high: hl.high, low: hl.low });
        }

        const ticker = await getTicker(symbol);
        const currentPrice = ticker?.last ? Number(ticker.last) : null;

        if (tfData.length === 0) {
          results.push({
            symbol,
            timeframes: [],
            smartShortEntry: 0,
            smartLongEntry: 0,
            currentPrice,
            strategy: "swing",
            strategyNote: "No candle data for selected timeframes.",
          });
          continue;
        }

        const smartShortEntry = Math.max(...tfData.map((t) => t.high));
        const smartLongEntry = Math.min(...tfData.map((t) => t.low));
        const { strategy, note } = deriveStrategy(tfData, currentPrice);

        results.push({
          symbol,
          timeframes: tfData.map((t) => ({ id: t.id, label: t.label, high: t.high, low: t.low })),
          smartShortEntry,
          smartLongEntry,
          currentPrice,
          strategy,
          strategyNote: note,
        });
      } catch {
        results.push({
          symbol,
          timeframes: [],
          smartShortEntry: 0,
          smartLongEntry: 0,
          currentPrice: null,
          strategy: "swing",
          strategyNote: "Could not load data for this symbol.",
        });
      }
    }

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "NovaSmart failed";
    console.error("NovaSmart error:", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
