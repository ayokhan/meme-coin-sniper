import { NextResponse } from "next/server";
import { getSessionAndSubscription } from "@/lib/auth-server";
import { normalizeMetalBase } from "@/lib/blofin-metals";
import { getNovaPerpCandles, getNovaPerpTicker, resolveNovaPerpVenue } from "@/lib/nova-perp-market";
import {
  type CandleTuple,
  combineStructureAndTrendline,
  countSupportResistanceTouches,
  highLowFromCandles,
  structureDirectionFromCloses,
  trendlineRegressionFromCloses,
} from "@/lib/nova-q-analytics";
import { NOVA_STANDARD_TIMEFRAMES } from "@/lib/nova-timeframes";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

const NOVA_SMART_TIMEFRAMES = NOVA_STANDARD_TIMEFRAMES;

function normalizeSymbol(raw: string): string {
  return normalizeMetalBase(raw) || "BTC";
}

/** Derive strategy: scalp (quick in/out), swing (hold for bigger move), or mixed. */
function deriveStrategy(
  tfData: { id: string; high: number; low: number; direction: "bullish" | "bearish" | "sideways" }[],
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
  const bulls = tfData.filter((t) => t.direction === "bullish").length;
  const bears = tfData.filter((t) => t.direction === "bearish").length;
  if (bulls > bears) note += ` Blended direction tilts bullish (${bulls}/${tfData.length}).`;
  else if (bears > bulls) note += ` Blended direction tilts bearish (${bears}/${tfData.length}).`;
  else note += " Blended direction is mixed.";

  return { strategy, note };
}

/** Recommend best direction (long/short/neutral) from price vs range. Used for "Best entry" callout. */
function getRecommendedDirection(
  smartHigh: number,
  smartLow: number,
  currentPrice: number | null,
  tfData: { direction: "bullish" | "bearish" | "sideways" }[]
): { direction: "long" | "short" | "neutral"; recommendationNote: string } {
  if (currentPrice == null || smartHigh <= smartLow) {
    return { direction: "neutral", recommendationNote: "No price data—enter when price reaches a smart level." };
  }
  const mid = (smartHigh + smartLow) / 2;
  const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  if (currentPrice >= smartHigh * 0.995) {
    const base: { direction: "long" | "short" | "neutral"; recommendationNote: string } = {
      direction: "short",
      recommendationNote: `Best entry: Short. Price at resistance (near $${fmt(smartHigh)}). Consider short on confirmation or small pullback.`,
    };
    return applyTrendlineFilter(base, tfData);
  }
  if (currentPrice <= smartLow * 1.005) {
    const base: { direction: "long" | "short" | "neutral"; recommendationNote: string } = {
      direction: "long",
      recommendationNote: `Best entry: Long. Price at support (near $${fmt(smartLow)}). Consider long on confirmation or bounce.`,
    };
    return applyTrendlineFilter(base, tfData);
  }
  if (currentPrice > mid * 1.005) {
    const base: { direction: "long" | "short" | "neutral"; recommendationNote: string } = {
      direction: "short",
      recommendationNote: `Best entry: Short (bias). Price above range mid—prefer short on rally to $${fmt(smartHigh)} or scalp short. Long only on dip to $${fmt(smartLow)}.`,
    };
    return applyTrendlineFilter(base, tfData);
  }
  if (currentPrice < mid * 0.995) {
    const base: { direction: "long" | "short" | "neutral"; recommendationNote: string } = {
      direction: "long",
      recommendationNote: `Best entry: Long (bias). Price below range mid—prefer long on pullback to $${fmt(smartLow)} or scalp long. Short only on rally to $${fmt(smartHigh)}.`,
    };
    return applyTrendlineFilter(base, tfData);
  }
  const base: { direction: "long" | "short" | "neutral"; recommendationNote: string } = {
    direction: "neutral",
    recommendationNote: `Neutral—price near range mid. Wait for test of $${fmt(smartLow)} (long) or $${fmt(smartHigh)} (short) for clearer entry.`,
  };
  return applyTrendlineFilter(base, tfData);
}

function applyTrendlineFilter(
  base: { direction: "long" | "short" | "neutral"; recommendationNote: string },
  tfData: { direction: "bullish" | "bearish" | "sideways" }[]
): { direction: "long" | "short" | "neutral"; recommendationNote: string } {
  if (!tfData.length || base.direction === "neutral") return base;
  const bulls = tfData.filter((t) => t.direction === "bullish").length;
  const bears = tfData.filter((t) => t.direction === "bearish").length;
  if (base.direction === "long" && bears > bulls) {
    return {
      direction: "neutral",
      recommendationNote: `${base.recommendationNote} Trendline+structure blend leans bearish, so confidence is reduced to neutral until momentum confirms.`,
    };
  }
  if (base.direction === "short" && bulls > bears) {
    return {
      direction: "neutral",
      recommendationNote: `${base.recommendationNote} Trendline+structure blend leans bullish, so confidence is reduced to neutral until momentum confirms.`,
    };
  }
  return base;
}

function suggestTrendlineEntry(
  smartShort: number,
  smartLong: number,
  currentPrice: number | null,
  tfData: Array<{
    id: string;
    direction: "bullish" | "bearish" | "sideways";
    trendlineBias: "up" | "down" | "flat";
  }>
): {
  trendlineEntryLong: number | null;
  trendlineEntryShort: number | null;
  trendlineEntryNote: string;
  trendlineConfidence: "high" | "medium" | "low";
  trendlineConfidenceNote: string;
} {
  const validPrice = currentPrice != null && Number.isFinite(currentPrice) && currentPrice > 0 ? currentPrice : null;
  const bulls = tfData.filter((t) => t.direction === "bullish").length;
  const bears = tfData.filter((t) => t.direction === "bearish").length;
  const nonSide = bulls + bears;
  const lead = Math.max(bulls, bears);
  const confidence: "high" | "medium" | "low" =
    nonSide >= 3 && lead / Math.max(nonSide, 1) >= 0.75
      ? "high"
      : nonSide >= 2 && lead / Math.max(nonSide, 1) >= 0.6
        ? "medium"
        : "low";
  const confidenceNote =
    confidence === "high"
      ? `High confidence (${bulls} bullish / ${bears} bearish across ${tfData.length} selected frames).`
      : confidence === "medium"
        ? `Medium confidence (${bulls} bullish / ${bears} bearish across ${tfData.length} selected frames).`
        : `Low confidence (${bulls} bullish / ${bears} bearish across ${tfData.length} selected frames) — mixed structure.`;
  const pref = tfData.find((t) => t.id === "1h") ?? tfData[0];
  const prefBias = pref?.trendlineBias ?? "flat";
  const lean = bulls > bears ? "bullish" : bears > bulls ? "bearish" : "mixed";
  const anchor = validPrice ?? (smartShort + smartLong) / 2;

  if (lean === "bullish" || prefBias === "up") {
    const trendlineEntryLong = Math.max(smartLong, anchor * 0.9965);
    const trendlineEntryShort = smartShort;
    return {
      trendlineEntryLong,
      trendlineEntryShort,
      trendlineEntryNote:
        `Trendline entry bias: long. Prefer pullback entries near $${trendlineEntryLong.toLocaleString(undefined, { maximumFractionDigits: 4, minimumFractionDigits: 2 })}; treat shorts near $${trendlineEntryShort.toLocaleString(undefined, { maximumFractionDigits: 4, minimumFractionDigits: 2 })} as counter-trend scalps unless momentum flips.`,
      trendlineConfidence: confidence,
      trendlineConfidenceNote: confidenceNote,
    };
  }
  if (lean === "bearish" || prefBias === "down") {
    const trendlineEntryShort = Math.min(smartShort, anchor * 1.0035);
    const trendlineEntryLong = smartLong;
    return {
      trendlineEntryLong,
      trendlineEntryShort,
      trendlineEntryNote:
        `Trendline entry bias: short. Prefer rally/retest entries near $${trendlineEntryShort.toLocaleString(undefined, { maximumFractionDigits: 4, minimumFractionDigits: 2 })}; treat longs near $${trendlineEntryLong.toLocaleString(undefined, { maximumFractionDigits: 4, minimumFractionDigits: 2 })} as counter-trend bounces unless structure turns up.`,
      trendlineConfidence: confidence,
      trendlineConfidenceNote: confidenceNote,
    };
  }

  return {
    trendlineEntryLong: null,
    trendlineEntryShort: null,
    trendlineEntryNote:
      `Trendline entry bias: mixed/flat. Wait for reclaim above ~$${smartShort.toLocaleString(undefined, { maximumFractionDigits: 4, minimumFractionDigits: 2 })} (long trigger) or breakdown below ~$${smartLong.toLocaleString(undefined, { maximumFractionDigits: 4, minimumFractionDigits: 2 })} (short trigger).`,
    trendlineConfidence: confidence,
    trendlineConfidenceNote: confidenceNote,
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
  structureDirection: "bullish" | "bearish" | "sideways";
  trendlineBias: "up" | "down" | "flat";
  direction: "bullish" | "bearish" | "sideways";
  trendlineRead: string;
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
  trendlineEntryLong: number | null;
  trendlineEntryShort: number | null;
  trendlineEntryNote: string;
  trendlineConfidence: "high" | "medium" | "low";
  trendlineConfidenceNote: string;
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
    const symbols = rawSymbols.map((s) => normalizeSymbol(s)).filter(Boolean);

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
    const effectiveTf =
      timeframes.length > 0
        ? timeframes
        : NOVA_SMART_TIMEFRAMES.filter((t) => ["15m", "1h", "1w"].includes(t.id)); // default

    const results: NovaSmartResult[] = [];
    const limit = Math.min(symbols.length, 10);

    for (const symbol of symbols.slice(0, limit)) {
      try {
        const tfData: {
          id: string;
          label: string;
          high: number;
          low: number;
          highTouches: number;
          lowTouches: number;
          structureDirection: "bullish" | "bearish" | "sideways";
          trendlineBias: "up" | "down" | "flat";
          direction: "bullish" | "bearish" | "sideways";
          trendlineRead: string;
        }[] = [];
        const venue = await resolveNovaPerpVenue(symbol);
        if (!venue) {
          results.push({
            symbol,
            timeframes: [],
            smartShortEntry: 0,
            smartLongEntry: 0,
            currentPrice: null,
            strategy: "swing",
            strategyNote: `${symbol} is not on Hyperliquid or Blofin USDT perps.`,
            suggestedLongEntry: 0,
            suggestedLongExit: 0,
            suggestedShortEntry: 0,
            suggestedShortExit: 0,
            entryExitNote: "",
            trendlineEntryLong: null,
            trendlineEntryShort: null,
            trendlineEntryNote: "Symbol not found on supported venues.",
            trendlineConfidence: "low",
            trendlineConfidenceNote: "Low confidence — symbol unavailable.",
            recommendedDirection: "neutral",
            recommendationNote: "Try a Hyperliquid or Blofin USDT perp symbol (e.g. BTC, SPCX, XAU).",
          });
          continue;
        }
        for (const tf of effectiveTf) {
          const candles = await getNovaPerpCandles(symbol, venue, tf.interval, tf.limit);
          const hl = highLowFromCandles(candles as CandleTuple[]);
          if (!hl) continue;
          const rows = candles as CandleTuple[];
          const { supportTouches, resistanceTouches } = countSupportResistanceTouches(
            rows,
            hl.low,
            hl.high
          );
          const structureDirection = structureDirectionFromCloses(rows);
          const tl =
            trendlineRegressionFromCloses(rows) ?? {
              bias: "flat" as const,
              slopePctWindow: 0,
              closeVsLinePct: 0,
              read: "Too few candles for regression trendline.",
            };
          const direction = combineStructureAndTrendline(structureDirection, tl.bias);
          tfData.push({
            id: tf.id,
            label: tf.label,
            high: hl.high,
            low: hl.low,
            highTouches: resistanceTouches,
            lowTouches: supportTouches,
            structureDirection,
            trendlineBias: tl.bias,
            direction,
            trendlineRead: tl.read,
          });
        }

        const ticker = await getNovaPerpTicker(symbol, venue);
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
            trendlineEntryLong: null,
            trendlineEntryShort: null,
            trendlineEntryNote: "No trendline entry read—insufficient candle data.",
            trendlineConfidence: "low",
            trendlineConfidenceNote: "Low confidence — no timeframe trendline data available.",
            recommendedDirection: "neutral",
            recommendationNote: "No candle data—run again with different timeframes or symbol.",
          });
          continue;
        }

        const smartShortEntry = Math.max(...tfData.map((t) => t.high));
        const smartLongEntry = Math.min(...tfData.map((t) => t.low));
        const { strategy, note } = deriveStrategy(tfData, currentPrice);
        const entryExit = suggestEntryExit(smartShortEntry, smartLongEntry, currentPrice, strategy);
        const trendlineEntry = suggestTrendlineEntry(smartShortEntry, smartLongEntry, currentPrice, tfData);
        const { direction: recommendedDirection, recommendationNote } = getRecommendedDirection(
          smartShortEntry,
          smartLongEntry,
          currentPrice,
          tfData
        );

        results.push({
          symbol,
          timeframes: tfData.map((t) => ({
            id: t.id,
            label: t.label,
            high: t.high,
            low: t.low,
            highTouches: t.highTouches,
            lowTouches: t.lowTouches,
            structureDirection: t.structureDirection,
            trendlineBias: t.trendlineBias,
            direction: t.direction,
            trendlineRead: t.trendlineRead,
          })),
          smartShortEntry,
          smartLongEntry,
          currentPrice,
          strategy,
          strategyNote: note,
          ...entryExit,
          ...trendlineEntry,
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
          trendlineEntryLong: null,
          trendlineEntryShort: null,
          trendlineEntryNote: "No trendline entry read available.",
          trendlineConfidence: "low",
          trendlineConfidenceNote: "Low confidence — symbol data unavailable.",
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
