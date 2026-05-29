/**
 * Nova Pattern Detector — swing / range pattern heuristics from OHLC candles.
 * Helps VIP users see recurring highs, lows, and cycle timing (e.g. XAU weekly swings).
 */

import {
  blofinMetalContractDescription,
  getBlofinMetalCandles,
  getBlofinMetalTicker,
  isBlofinMetal,
  normalizeMetalBase,
  type BlofinMetal,
} from "@/lib/blofin-metals";
import { formatQuotePriceUsd } from "@/lib/format-quote-price";
import { getCandles as getHlCandles, getTicker as getHlTicker } from "@/lib/hyperliquid";
import { highLowFromCandles, type CandleTuple } from "@/lib/nova-q-analytics";
import { NOVA_STANDARD_TIMEFRAMES, type NovaTimeframeConfig } from "@/lib/nova-timeframes";

export const NOVA_PATTERN_LOOKBACK_OPTIONS: { id: string; label: string; interval: string; limit: number }[] = [
  { id: "2w", label: "2 weeks", interval: "1d", limit: 14 },
  { id: "4w", label: "4 weeks", interval: "1d", limit: 28 },
  { id: "6w", label: "6 weeks", interval: "1d", limit: 42 },
  { id: "8w", label: "8 weeks", interval: "1d", limit: 56 },
];

export type NovaPatternSwingPoint = {
  kind: "high" | "low";
  price: number;
  ts: number;
  label: string;
};

export type NovaPatternTimeframeRow = {
  id: string;
  label: string;
  support: number;
  resistance: number;
  currentPrice: number | null;
  rangePct: number;
  positionInRangePct: number;
  changePctWindow: number | null;
  swingCount: number;
  patternHint: string;
};

export type NovaPatternResult = {
  symbol: string;
  dataSource: "blofin" | "hyperliquid";
  contractNote: string;
  lookbackId: string;
  lookbackLabel: string;
  currentPrice: number | null;
  periodHigh: number;
  periodLow: number;
  positionInRangePct: number;
  patternType: "range" | "uptrend" | "downtrend" | "mixed";
  patternLabel: string;
  /** Typical ceiling from recent swing highs (≈75th percentile). */
  typicalHighZone: number;
  /** Typical floor from recent swing lows (≈25th percentile). */
  typicalLowZone: number;
  medianSwingUpPct: number | null;
  medianSwingDownPct: number | null;
  medianDaysBetweenSwings: number | null;
  recent48hChangePct: number | null;
  swings: NovaPatternSwingPoint[];
  summaryParagraph: string;
  observations: string[];
  timeframes: NovaPatternTimeframeRow[];
  disclaimer: string;
};

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function findSwings(candles: CandleTuple[], left = 2, right = 2): NovaPatternSwingPoint[] {
  const swings: NovaPatternSwingPoint[] = [];
  for (let i = left; i < candles.length - right; i++) {
    const hi = Number(candles[i][2]);
    const lo = Number(candles[i][3]);
    const ts = Number(candles[i][0]);
    if (!Number.isFinite(hi) || !Number.isFinite(lo)) continue;

    let isHigh = true;
    let isLow = true;
    for (let j = i - left; j <= i + right; j++) {
      if (j === i) continue;
      const h = Number(candles[j][2]);
      const l = Number(candles[j][3]);
      if (Number.isFinite(h) && h > hi) isHigh = false;
      if (Number.isFinite(l) && l < lo) isLow = false;
    }
    const dateLabel = Number.isFinite(ts) ? new Date(ts).toLocaleDateString() : "";
    if (isHigh) swings.push({ kind: "high", price: hi, ts, label: dateLabel });
    if (isLow) swings.push({ kind: "low", price: lo, ts, label: dateLabel });
  }
  swings.sort((a, b) => a.ts - b.ts);
  return swings;
}

function classifyPattern(swings: NovaPatternSwingPoint[]): {
  patternType: NovaPatternResult["patternType"];
  patternLabel: string;
} {
  const highs = swings.filter((s) => s.kind === "high").map((s) => s.price);
  const lows = swings.filter((s) => s.kind === "low").map((s) => s.price);
  if (highs.length < 2 || lows.length < 2) {
    return { patternType: "mixed", patternLabel: "Insufficient swing history — widen lookback or add timeframes." };
  }
  const last2High = highs.slice(-2);
  const last2Low = lows.slice(-2);
  const hh = last2High[1] > last2High[0];
  const hl = last2Low[1] > last2Low[0];
  const lh = last2High[1] < last2High[0];
  const ll = last2Low[1] < last2Low[0];

  if (hh && hl) return { patternType: "uptrend", patternLabel: "Higher highs & higher lows (uptrend structure)" };
  if (lh && ll) return { patternType: "downtrend", patternLabel: "Lower highs & lower lows (downtrend structure)" };

  const highBand = percentile([...highs].sort((a, b) => a - b), 0.75) - percentile([...highs].sort((a, b) => a - b), 0.25);
  const lowBand = percentile([...lows].sort((a, b) => a - b), 0.75) - percentile([...lows].sort((a, b) => a - b), 0.25);
  const avgMid = (percentile(highs, 0.5) + percentile(lows, 0.5)) / 2;
  const bandPct = avgMid > 0 ? ((highBand + lowBand) / 2 / avgMid) * 100 : 0;

  if (bandPct < 8 && highs.length >= 2 && lows.length >= 2) {
    return { patternType: "range", patternLabel: "Range / oscillation — price swings between recurring high and low zones" };
  }
  return { patternType: "mixed", patternLabel: "Mixed structure — partial range with trend elements" };
}

function median(nums: number[]): number | null {
  const v = nums.filter((n) => Number.isFinite(n));
  if (v.length === 0) return null;
  const s = [...v].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function buildSummary(params: {
  symbol: string;
  lookbackLabel: string;
  currentPrice: number | null;
  typicalHighZone: number;
  typicalLowZone: number;
  medianDaysBetweenSwings: number | null;
  medianSwingUpPct: number | null;
  medianSwingDownPct: number | null;
  recent48hChangePct: number | null;
  patternLabel: string;
  positionInRangePct: number;
}): { summaryParagraph: string; observations: string[] } {
  const obs: string[] = [];
  const {
    symbol,
    lookbackLabel,
    currentPrice,
    typicalHighZone,
    typicalLowZone,
    medianDaysBetweenSwings,
    medianSwingUpPct,
    medianSwingDownPct,
    recent48hChangePct,
    patternLabel,
    positionInRangePct,
  } = params;

  obs.push(patternLabel);

  if (currentPrice != null) {
    obs.push(
      `Now ${formatQuotePriceUsd(currentPrice)} — about ${positionInRangePct.toFixed(0)}% up from the ${lookbackLabel} low toward the high.`
    );
  }

  obs.push(
    `Typical swing high zone (recent peaks): ${formatQuotePriceUsd(typicalHighZone)} · Typical swing low zone (recent troughs): ${formatQuotePriceUsd(typicalLowZone)}.`
  );

  if (medianSwingUpPct != null && medianSwingDownPct != null) {
    obs.push(
      `Median leg up from a swing low to the next high: ~${medianSwingUpPct.toFixed(2)}%. Median leg down from a swing high to the next low: ~${medianSwingDownPct.toFixed(2)}%.`
    );
  }

  if (medianDaysBetweenSwings != null) {
    obs.push(`Rough median spacing between swing turns: ~${medianDaysBetweenSwings.toFixed(1)} days (daily candles).`);
  }

  if (recent48hChangePct != null) {
    const sign = recent48hChangePct >= 0 ? "+" : "";
    obs.push(`Last ~48 hours (hourly): ${sign}${recent48hChangePct.toFixed(2)}% — compare to your Blofin chart.`);
  }

  const summaryParagraph = [
    `${symbol} over ${lookbackLabel}: ${patternLabel.toLowerCase()}.`,
    `Price has often tagged ${formatQuotePriceUsd(typicalHighZone)} on rallies and ${formatQuotePriceUsd(typicalLowZone)} on pullbacks.`,
    medianDaysBetweenSwings != null
      ? `Swing turns are spaced about ${Math.round(medianDaysBetweenSwings)} day(s) apart on average — useful for timing mean-reversion vs breakout plays.`
      : "",
    currentPrice != null && currentPrice >= typicalHighZone * 0.98
      ? "Price is near the upper part of the recent range — watch for rejection or breakout above the typical high zone."
      : currentPrice != null && currentPrice <= typicalLowZone * 1.02
        ? "Price is near the lower part of the recent range — watch for bounce or breakdown below the typical low zone."
        : "",
  ]
    .filter(Boolean)
    .join(" ");

  return { summaryParagraph, observations: obs };
}

async function fetchCandles(symbol: string, interval: string, limit: number): Promise<CandleTuple[]> {
  if (isBlofinMetal(symbol)) {
    return (await getBlofinMetalCandles(symbol as BlofinMetal, interval, limit)) as CandleTuple[];
  }
  return (await getHlCandles(symbol, interval, limit)) as CandleTuple[];
}

async function fetchTicker(symbol: string): Promise<number | null> {
  try {
    if (isBlofinMetal(symbol)) {
      const t = await getBlofinMetalTicker(symbol as BlofinMetal);
      const n = t?.last ? Number(t.last) : NaN;
      return Number.isFinite(n) ? n : null;
    }
    const t = await getHlTicker(symbol);
    const n = t?.last ? Number(t.last) : NaN;
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function analyzeSwingLegs(swings: NovaPatternSwingPoint[]): {
  medianSwingUpPct: number | null;
  medianSwingDownPct: number | null;
  medianDaysBetweenSwings: number | null;
} {
  const ups: number[] = [];
  const downs: number[] = [];
  const gaps: number[] = [];

  for (let i = 1; i < swings.length; i++) {
    const prev = swings[i - 1];
    const cur = swings[i];
    const days = (cur.ts - prev.ts) / (24 * 60 * 60 * 1000);
    if (days > 0 && days < 60) gaps.push(days);

    if (prev.kind === "low" && cur.kind === "high" && prev.price > 0) {
      ups.push(((cur.price - prev.price) / prev.price) * 100);
    }
    if (prev.kind === "high" && cur.kind === "low" && prev.price > 0) {
      downs.push(((prev.price - cur.price) / prev.price) * 100);
    }
  }

  return {
    medianSwingUpPct: median(ups),
    medianSwingDownPct: median(downs),
    medianDaysBetweenSwings: median(gaps),
  };
}

function analyzeTimeframeRow(
  tf: NovaTimeframeConfig,
  candles: CandleTuple[],
  currentPrice: number | null
): NovaPatternTimeframeRow | null {
  const hl = highLowFromCandles(candles);
  if (!hl) return null;
  const { high: resistance, low: support } = hl;
  const range = resistance - support;
  const rangePct = support > 0 ? (range / support) * 100 : 0;
  let positionInRangePct = 50;
  if (currentPrice != null && range > 0) {
    positionInRangePct = Math.min(100, Math.max(0, ((currentPrice - support) / range) * 100));
  }
  const firstClose = Number(candles[0]?.[4]);
  const lastClose = Number(candles[candles.length - 1]?.[4]);
  let changePctWindow: number | null = null;
  if (Number.isFinite(firstClose) && Number.isFinite(lastClose) && firstClose > 0) {
    changePctWindow = ((lastClose - firstClose) / firstClose) * 100;
  }
  const swings = findSwings(candles, 1, 1);
  let patternHint = "Sideways chop in window";
  if (changePctWindow != null) {
    if (changePctWindow > 1.5) patternHint = "Net rise in window";
    else if (changePctWindow < -1.5) patternHint = "Net drop in window";
  }
  if (positionInRangePct >= 75) patternHint += " · price upper range";
  else if (positionInRangePct <= 25) patternHint += " · price lower range";

  return {
    id: tf.id,
    label: tf.label,
    support,
    resistance,
    currentPrice,
    rangePct,
    positionInRangePct,
    changePctWindow,
    swingCount: swings.length,
    patternHint,
  };
}

export async function analyzeNovaPattern(
  rawSymbol: string,
  options: { lookbackId: string; timeframeIds: string[] }
): Promise<NovaPatternResult> {
  const symbol = normalizeMetalBase(rawSymbol) || "BTC";
  const lookback =
    NOVA_PATTERN_LOOKBACK_OPTIONS.find((o) => o.id === options.lookbackId) ??
    NOVA_PATTERN_LOOKBACK_OPTIONS.find((o) => o.id === "6w")!;

  const useBlofin = isBlofinMetal(symbol);
  const contractNote = useBlofin
    ? blofinMetalContractDescription(symbol as BlofinMetal)
    : `${symbol}: Hyperliquid USDC-margined perpetual candles.`;

  const [lookbackCandles, currentPrice] = await Promise.all([
    fetchCandles(symbol, lookback.interval, lookback.limit),
    fetchTicker(symbol),
  ]);

  const hl = highLowFromCandles(lookbackCandles);
  if (!hl) {
    throw new Error(`Not enough candle data for ${symbol}. Try another symbol or lookback.`);
  }

  const swings = findSwings(lookbackCandles, 2, 2);
  const swingHighs = swings.filter((s) => s.kind === "high").map((s) => s.price);
  const swingLows = swings.filter((s) => s.kind === "low").map((s) => s.price);
  const sortedHighs = [...swingHighs].sort((a, b) => a - b);
  const sortedLows = [...swingLows].sort((a, b) => a - b);

  const typicalHighZone =
    sortedHighs.length > 0 ? percentile(sortedHighs, 0.75) : hl.high;
  const typicalLowZone = sortedLows.length > 0 ? percentile(sortedLows, 0.25) : hl.low;

  const { patternType, patternLabel } = classifyPattern(swings);
  const { medianSwingUpPct, medianSwingDownPct, medianDaysBetweenSwings } = analyzeSwingLegs(swings);

  const range = hl.high - hl.low;
  const positionInRangePct =
    currentPrice != null && range > 0
      ? Math.min(100, Math.max(0, ((currentPrice - hl.low) / range) * 100))
      : 50;

  let recent48hChangePct: number | null = null;
  try {
    const h48 = await fetchCandles(symbol, "1h", 48);
    if (h48.length >= 2) {
      const oldC = Number(h48[0][4]);
      const newC = Number(h48[h48.length - 1][4]);
      if (Number.isFinite(oldC) && Number.isFinite(newC) && oldC > 0) {
        recent48hChangePct = ((newC - oldC) / oldC) * 100;
      }
    }
  } catch {
    // optional
  }

  const tfIds = options.timeframeIds.length > 0 ? options.timeframeIds : ["24h", "1w"];
  const selectedTfs = NOVA_STANDARD_TIMEFRAMES.filter((t) => tfIds.includes(t.id));
  const effectiveTfs =
    selectedTfs.length > 0 ? selectedTfs : NOVA_STANDARD_TIMEFRAMES.filter((t) => ["24h", "48h", "1w"].includes(t.id));

  const timeframes: NovaPatternTimeframeRow[] = [];
  for (const tf of effectiveTfs) {
    try {
      const candles = await fetchCandles(symbol, tf.interval, tf.limit);
      const row = analyzeTimeframeRow(tf, candles, currentPrice);
      if (row) timeframes.push(row);
    } catch {
      // skip failed tf
    }
  }

  const { summaryParagraph, observations } = buildSummary({
    symbol,
    lookbackLabel: lookback.label,
    currentPrice,
    typicalHighZone,
    typicalLowZone,
    medianDaysBetweenSwings,
    medianSwingUpPct,
    medianSwingDownPct,
    recent48hChangePct,
    patternLabel,
    positionInRangePct,
  });

  return {
    symbol,
    dataSource: useBlofin ? "blofin" : "hyperliquid",
    contractNote,
    lookbackId: lookback.id,
    lookbackLabel: lookback.label,
    currentPrice,
    periodHigh: hl.high,
    periodLow: hl.low,
    positionInRangePct,
    patternType,
    patternLabel,
    typicalHighZone,
    typicalLowZone,
    medianSwingUpPct,
    medianSwingDownPct,
    medianDaysBetweenSwings,
    recent48hChangePct,
    swings: swings.slice(-12),
    summaryParagraph,
    observations,
    timeframes,
    disclaimer:
      "Heuristic swing detection on OHLC candles — not financial advice. Levels are statistical summaries of recent swings; compare with your exchange (e.g. Blofin) and manage risk.",
  };
}
