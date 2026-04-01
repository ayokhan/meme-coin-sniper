import { NextResponse } from "next/server";
import { getSessionAndSubscription } from "@/lib/auth-server";
import { getCandles, getTicker } from "@/lib/hyperliquid";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

/** Timeframe config for NovaSmart: id, label, interval, bar count. */
const NOVA_SMART_TIMEFRAMES = [
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

/** Recommend best direction (long/short/neutral) from price vs range. Used for "Best entry" callout. */
function getRecommendedDirection(
  smartHigh: number,
  smartLow: number,
  currentPrice: number | null
): { direction: "long" | "short" | "neutral"; recommendationNote: string } {
  if (currentPrice == null || smartHigh <= smartLow) {
    return { direction: "neutral", recommendationNote: "No price data—enter when price reaches a smart level." };
  }
  const mid = (smartHigh + smartLow) / 2;
  const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  if (currentPrice >= smartHigh * 0.995) {
    return {
      direction: "short",
      recommendationNote: `Best entry: Short. Price at resistance (near $${fmt(smartHigh)}). Consider short on confirmation or small pullback.`,
    };
  }
  if (currentPrice <= smartLow * 1.005) {
    return {
      direction: "long",
      recommendationNote: `Best entry: Long. Price at support (near $${fmt(smartLow)}). Consider long on confirmation or bounce.`,
    };
  }
  if (currentPrice > mid * 1.005) {
    return {
      direction: "short",
      recommendationNote: `Best entry: Short (bias). Price above range mid—prefer short on rally to $${fmt(smartHigh)} or scalp short. Long only on dip to $${fmt(smartLow)}.`,
    };
  }
  if (currentPrice < mid * 0.995) {
    return {
      direction: "long",
      recommendationNote: `Best entry: Long (bias). Price below range mid—prefer long on pullback to $${fmt(smartLow)} or scalp long. Short only on rally to $${fmt(smartHigh)}.`,
    };
  }
  return {
    direction: "neutral",
    recommendationNote: `Neutral—price near range mid. Wait for test of $${fmt(smartLow)} (long) or $${fmt(smartHigh)} (short) for clearer entry.`,
  };
}

/** Suggest entry/exit levels from strategy and smart levels. */
function suggestEntryExit(
  smartShort: number,
  smartLong: number,
  _currentPrice: number | null,
  strategy: "scalp" | "swing" | "mixed"
): {
  suggestedLongEntry: number;
  suggestedLongExit: number;
  suggestedShortEntry: number;
  suggestedShortExit: number;
  entryExitNote: string;
} {
  const scalpPct = 0.005; // 0.5% for scalp targets
  const longEntry = smartLong;
  const shortEntry = smartShort;
  let longExit: number;
  let shortExit: number;

  if (strategy === "scalp") {
    longExit = longEntry * (1 + scalpPct);
    shortExit = shortEntry * (1 - scalpPct);
  } else if (strategy === "swing") {
    longExit = smartShort;
    shortExit = smartLong;
  } else {
    longExit = Math.min(smartShort, longEntry * (1 + 0.015));
    shortExit = Math.max(smartLong, shortEntry * (1 - 0.015));
  }

  const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 4, minimumFractionDigits: 2 });
  const entryExitNote = `Long: enter near $${fmt(longEntry)}, exit near $${fmt(longExit)}. Short: enter near $${fmt(shortEntry)}, exit near $${fmt(shortExit)}.`;
  return {
    suggestedLongEntry: longEntry,
    suggestedLongExit: longExit,
    suggestedShortEntry: shortEntry,
    suggestedShortExit: shortExit,
    entryExitNote,
  };
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
  suggestedLongEntry: number;
  suggestedLongExit: number;
  suggestedShortEntry: number;
  suggestedShortExit: number;
  entryExitNote: string;
  recommendedDirection: "long" | "short" | "neutral";
  recommendationNote: string;
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

    const rawSymbols: string[] = typeof symbolsParam === "string"
      ? symbolsParam.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean)
      : Array.isArray(symbolsParam)
        ? symbolsParam.map((s) => String(s).trim()).filter(Boolean)
        : [];
    // Normalize so BTC/USDT, BTC-USDT, BTC.USDT all become BTC (Hyperliquid uses base symbol)
    const symbols = rawSymbols.map((s) => {
      const upper = s.toUpperCase();
      const base = upper.replace(/\/USDT$/i, "").replace(/\/USD$/i, "").replace(/-USDT$/i, "").replace(/\.USDT$/i, "").trim();
      return (base || upper).toUpperCase();
    }).filter(Boolean);

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
            suggestedLongEntry: 0,
            suggestedLongExit: 0,
            suggestedShortEntry: 0,
            suggestedShortExit: 0,
            entryExitNote: "",
            recommendedDirection: "neutral",
            recommendationNote: "No candle data—run again with different timeframes or symbol.",
          });
          continue;
        }

        const smartShortEntry = Math.max(...tfData.map((t) => t.high));
        const smartLongEntry = Math.min(...tfData.map((t) => t.low));
        const { strategy, note } = deriveStrategy(tfData, currentPrice);
        const entryExit = suggestEntryExit(smartShortEntry, smartLongEntry, currentPrice, strategy);
        const { direction: recommendedDirection, recommendationNote } = getRecommendedDirection(smartShortEntry, smartLongEntry, currentPrice);

        results.push({
          symbol,
          timeframes: tfData.map((t) => ({ id: t.id, label: t.label, high: t.high, low: t.low })),
          smartShortEntry,
          smartLongEntry,
          currentPrice,
          strategy,
          strategyNote: note,
          ...entryExit,
          recommendedDirection,
          recommendationNote,
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
          suggestedLongEntry: 0,
          suggestedLongExit: 0,
          suggestedShortEntry: 0,
          suggestedShortExit: 0,
          entryExitNote: "",
          recommendedDirection: "neutral",
          recommendationNote: "Could not load data for this symbol.",
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
