import type { Candle } from "@/lib/hyperliquid";
import {
  type CandleTuple,
  combineStructureAndTrendline,
  countEntryExitTouches,
  highLowFromCandles,
  structureDirectionFromCloses,
  trendlineRegressionFromCloses,
} from "@/lib/nova-q-analytics";
import { meanRangePct, momentumBias as perpMomentumBias, trendFrom15mCloses } from "@/lib/crypto-buddie-score";
import type { TrendingPerp } from "@/lib/api-clients/hyperliquid";
import { normalizeMetalBase } from "@/lib/blofin-metals";

export const SCALP_TIMEFRAMES = [
  { id: "1m", label: "1 min", interval: "1m", limit: 90, estHoldMinutes: 2 },
  { id: "2m", label: "2 mins", interval: "1m", limit: 90, estHoldMinutes: 4 },
  { id: "5m", label: "5 mins", interval: "1m", limit: 120, estHoldMinutes: 8 },
  { id: "10m", label: "10 mins", interval: "1m", limit: 120, estHoldMinutes: 12 },
  { id: "15m", label: "15 mins", interval: "1m", limit: 120, estHoldMinutes: 18 },
  { id: "20m", label: "20 mins", interval: "5m", limit: 48, estHoldMinutes: 22 },
  { id: "30m", label: "30 mins", interval: "5m", limit: 60, estHoldMinutes: 35 },
  { id: "1h", label: "1 hour", interval: "5m", limit: 72, estHoldMinutes: 55 },
  { id: "2h", label: "2 hours", interval: "15m", limit: 48, estHoldMinutes: 110 },
] as const;

export type ScalpTimeframeId = (typeof SCALP_TIMEFRAMES)[number]["id"];

export type ScalpSide = "long" | "short" | "no_entry";

export type NovaScalpAnalysis = {
  symbol: string;
  timeframeId: ScalpTimeframeId;
  timeframeLabel: string;
  amountUsd: number;
  leverage: number;
  currentPrice: number | null;
  side: ScalpSide;
  entryPrice: number | null;
  exitPrice: number | null;
  stopLossPrice: number | null;
  /** Candles in the window whose range traded near entry (within tolerance). */
  entryTouches: number | null;
  /** Candles in the window whose range traded near exit target (within tolerance). */
  exitTouches: number | null;
  expectedPnlUsd: number | null;
  expectedPnlPctOnMargin: number | null;
  estimatedHoldMinutes: number | null;
  structureDirection: "bullish" | "bearish" | "sideways";
  trendlineBias: "up" | "down" | "flat";
  blendedDirection: "bullish" | "bearish" | "sideways";
  rationale: string;
  disclaimer: string;
};

/** Timeframe used for Quick Wins list + “Analyze” handoff (must match Run Agent logic). */
export const QUICK_WIN_SCALP_TIMEFRAME_ID: ScalpTimeframeId = "5m";

export type NovaScalpQuickWin = {
  symbol: string;
  quickWinScore: number;
  /** Momentum read on 5m/15m bars — informational only. */
  momentumBias: "long" | "short" | "neutral";
  rangePct15m: number;
  liquidityNote: string;
  directionHint: string;
  suggestedLeverage: number;
  estHoldMinutes: number;
  currentPrice: number | null;
  /** Same engine as Run Agent on 5m — only listed when this is long or short. */
  scalpSide: "long" | "short";
  scalpTimeframeId: ScalpTimeframeId;
  scalpTimeframeLabel: string;
  entryPrice: number;
  exitPrice: number;
  stopLossPrice: number;
  entryTouches: number;
  exitTouches: number;
  /** Illustrative PnL at $100 margin and suggested leverage. */
  previewPnlUsd: number | null;
};

export const NOVA_SCALP_DISCLAIMER =
  "Not financial advice. Know your risk level before trading.";

export function resolveScalpSymbol(raw: string): string {
  const normalized = normalizeMetalBase(raw);
  return normalized || "BTC";
}

export function scalpTimeframeConfig(id: string) {
  return SCALP_TIMEFRAMES.find((t) => t.id === id) ?? SCALP_TIMEFRAMES.find((t) => t.id === "5m")!;
}

export function isValidScalpTimeframeId(id: string): id is ScalpTimeframeId {
  return SCALP_TIMEFRAMES.some((t) => t.id === id);
}

export function scalpCandlesRequest(timeframeId: string): { interval: string; limit: number } {
  const tf = scalpTimeframeConfig(timeframeId);
  return { interval: tf.interval, limit: tf.limit };
}

function asTuples(candles: Candle[]): CandleTuple[] {
  return candles as CandleTuple[];
}

function roundPx(n: number, ref: number): number {
  if (!Number.isFinite(n)) return n;
  const decimals = ref >= 1000 ? 2 : ref >= 10 ? 3 : ref >= 1 ? 4 : 6;
  return Number(n.toFixed(decimals));
}

function positionInRange(price: number, low: number, high: number): number {
  const span = high - low;
  if (span <= 0) return 0.5;
  return (price - low) / span;
}

function estimatePnl(
  side: "long" | "short",
  entry: number,
  exit: number,
  amountUsd: number,
  leverage: number
): { pnlUsd: number; pnlPctMargin: number } {
  if (!(entry > 0) || !(exit > 0) || !(amountUsd > 0) || !(leverage > 0)) {
    return { pnlUsd: 0, pnlPctMargin: 0 };
  }
  const movePct =
    side === "long" ? ((exit - entry) / entry) * 100 : ((entry - exit) / entry) * 100;
  const pnlPctMargin = movePct * leverage;
  const pnlUsd = (amountUsd * pnlPctMargin) / 100;
  return { pnlUsd, pnlPctMargin };
}

export function analyzeScalpSetup(input: {
  symbol: string;
  timeframeId: string;
  amountUsd: number;
  leverage: number;
  candles: Candle[];
  currentPrice: number | null;
}): NovaScalpAnalysis {
  const tf = scalpTimeframeConfig(input.timeframeId);
  const symbol = resolveScalpSymbol(input.symbol);
  const amountUsd = Math.max(1, Number(input.amountUsd) || 100);
  const leverage = Math.min(125, Math.max(1, Number(input.leverage) || 10));
  const rows = asTuples(input.candles);
  const hl = highLowFromCandles(rows);
  const price =
    input.currentPrice != null && Number.isFinite(input.currentPrice)
      ? input.currentPrice
      : rows[0]
        ? Number(rows[0][4])
        : null;

  const structureDirection = structureDirectionFromCloses(rows);
  const tl = trendlineRegressionFromCloses(rows);
  const trendlineBias = tl?.bias ?? "flat";
  const blendedDirection = combineStructureAndTrendline(structureDirection, trendlineBias);

  if (!hl || price == null || !Number.isFinite(price)) {
    return {
      symbol,
      timeframeId: tf.id,
      timeframeLabel: tf.label,
      amountUsd,
      leverage,
      currentPrice: price,
      side: "no_entry",
      entryPrice: null,
      exitPrice: null,
      stopLossPrice: null,
      entryTouches: null,
      exitTouches: null,
      expectedPnlUsd: null,
      expectedPnlPctOnMargin: null,
      estimatedHoldMinutes: null,
      structureDirection,
      trendlineBias,
      blendedDirection,
      rationale: "Insufficient candle data for this symbol and timeframe.",
      disclaimer: NOVA_SCALP_DISCLAIMER,
    };
  }

  const { high, low } = hl;
  const mid = (high + low) / 2;
  const span = Math.max(high - low, price * 0.0005);
  const pos = positionInRange(price, low, high);

  let side: ScalpSide = "no_entry";
  let entry = price;
  let exit = price;
  let sl = price;
  const buffer = span * 0.08;

  const bullishSetup =
    (blendedDirection === "bullish" || (structureDirection === "bullish" && trendlineBias !== "down")) &&
    pos <= 0.42;
  const bearishSetup =
    (blendedDirection === "bearish" || (structureDirection === "bearish" && trendlineBias !== "up")) &&
    pos >= 0.58;

  if (blendedDirection === "sideways") {
    if (pos <= 0.22) {
      side = "long";
      entry = roundPx(low + buffer * 0.35, price);
      exit = roundPx(mid + span * 0.12, price);
      sl = roundPx(low - buffer * 0.5, price);
    } else if (pos >= 0.78) {
      side = "short";
      entry = roundPx(high - buffer * 0.35, price);
      exit = roundPx(mid - span * 0.12, price);
      sl = roundPx(high + buffer * 0.5, price);
    }
  } else if (bullishSetup) {
    side = "long";
    entry = roundPx(Math.min(price, low + buffer), price);
    exit = roundPx(Math.max(mid, price + span * 0.35), price);
    sl = roundPx(low - buffer * 0.65, price);
  } else if (bearishSetup) {
    side = "short";
    entry = roundPx(Math.max(price, high - buffer), price);
    exit = roundPx(Math.min(mid, price - span * 0.35), price);
    sl = roundPx(high + buffer * 0.65, price);
  }

  if (side === "no_entry") {
    return {
      symbol,
      timeframeId: tf.id,
      timeframeLabel: tf.label,
      amountUsd,
      leverage,
      currentPrice: price,
      side,
      entryPrice: null,
      exitPrice: null,
      stopLossPrice: null,
      entryTouches: null,
      exitTouches: null,
      expectedPnlUsd: null,
      expectedPnlPctOnMargin: null,
      estimatedHoldMinutes: null,
      structureDirection,
      trendlineBias,
      blendedDirection,
      rationale:
        "No clear scalp edge: price is mid-range or structure/trendline conflict. Wait for retest of range low (long) or high (short), or pick a tighter timeframe.",
      disclaimer: NOVA_SCALP_DISCLAIMER,
    };
  }

  const distPct = Math.abs((exit - entry) / entry) * 100;
  const estHold = Math.max(
    1,
    Math.round(tf.estHoldMinutes * Math.min(1.4, Math.max(0.35, distPct / 0.45)))
  );
  const { pnlUsd, pnlPctMargin } = estimatePnl(side, entry, exit, amountUsd, leverage);
  const { entryTouches, exitTouches } = countEntryExitTouches(rows, entry, exit, side);

  const rationale =
    side === "long"
      ? `Structure ${structureDirection}, trendline ${trendlineBias} → blended ${blendedDirection}. Price in lower ${Math.round(pos * 100)}% of ${tf.label} range — long toward range mid/target. ${tl?.read ?? ""}`
      : `Structure ${structureDirection}, trendline ${trendlineBias} → blended ${blendedDirection}. Price in upper ${Math.round((1 - pos) * 100)}% of ${tf.label} range — short toward range mid/target. ${tl?.read ?? ""}`;

  return {
    symbol,
    timeframeId: tf.id,
    timeframeLabel: tf.label,
    amountUsd,
    leverage,
    currentPrice: price,
    side,
    entryPrice: entry,
    exitPrice: exit,
    stopLossPrice: sl,
    entryTouches,
    exitTouches,
    expectedPnlUsd: Number(pnlUsd.toFixed(2)),
    expectedPnlPctOnMargin: Number(pnlPctMargin.toFixed(2)),
    estimatedHoldMinutes: estHold,
    structureDirection,
    trendlineBias,
    blendedDirection,
    rationale: rationale.trim(),
    disclaimer: NOVA_SCALP_DISCLAIMER,
  };
}

/** Rank + require a valid 5m scalp plan (same rules as Run Agent). */
export function buildQuickWinCandidate(
  perp: TrendingPerp,
  candles15m: Candle[],
  candles5m: Candle[],
  scalpCandles: Candle[],
  amountUsd = 100,
  scalpTimeframeId: string = QUICK_WIN_SCALP_TIMEFRAME_ID
): NovaScalpQuickWin | null {
  const oscillation = scoreOscillationProfile(perp, candles15m, candles5m);
  if (!oscillation) return null;

  const tfId = isValidScalpTimeframeId(scalpTimeframeId) ? scalpTimeframeId : QUICK_WIN_SCALP_TIMEFRAME_ID;
  const price = Number(perp.markPx ?? 0) || null;
  const analysis = analyzeScalpSetup({
    symbol: perp.coin,
    timeframeId: tfId,
    amountUsd,
    leverage: oscillation.suggestedLeverage,
    candles: scalpCandles,
    currentPrice: price,
  });

  if (analysis.side === "no_entry" || analysis.entryPrice == null || analysis.exitPrice == null) {
    return null;
  }

  const side = analysis.side;
  return {
    symbol: perp.coin,
    quickWinScore: oscillation.quickWinScore,
    momentumBias: oscillation.momentumBias,
    rangePct15m: oscillation.rangePct15m,
    liquidityNote: oscillation.liquidityNote,
    directionHint: `${side.toUpperCase()} on ${analysis.timeframeLabel}: ${analysis.rationale.split(".")[0]}.`,
    suggestedLeverage: oscillation.suggestedLeverage,
    estHoldMinutes: analysis.estimatedHoldMinutes ?? oscillation.estHoldMinutes,
    currentPrice: price,
    scalpSide: side,
    scalpTimeframeId: analysis.timeframeId,
    scalpTimeframeLabel: analysis.timeframeLabel,
    entryPrice: analysis.entryPrice,
    exitPrice: analysis.exitPrice,
    stopLossPrice: analysis.stopLossPrice ?? analysis.entryPrice,
    entryTouches: analysis.entryTouches ?? 0,
    exitTouches: analysis.exitTouches ?? 0,
    previewPnlUsd: analysis.expectedPnlUsd,
  };
}

type OscillationProfile = {
  quickWinScore: number;
  momentumBias: "long" | "short" | "neutral";
  rangePct15m: number;
  liquidityNote: string;
  suggestedLeverage: number;
  estHoldMinutes: number;
};

/** Tight 5m/15m range + liquidity — does not imply an entry by itself. */
function scoreOscillationProfile(
  perp: TrendingPerp,
  candles15m: Candle[],
  candles5m: Candle[]
): OscillationProfile | null {
  const range15 = meanRangePct(candles15m);
  const range5 = meanRangePct(candles5m);
  const { label: trend15m, netPct } = trendFrom15mCloses(candles15m);
  const bias = perpMomentumBias(perp);

  let score = 0;
  const vol = Number(perp.dayNtlVlm || 0);
  score += Math.min(30, Math.log10(vol + 10) * 5.8);

  if (range15 >= 0.006 && range15 <= 0.028) score += 28;
  else if (range15 < 0.045) score += 14;

  if (range5 >= 0.004 && range5 <= 0.022) score += 18;

  const a15 = Math.abs(perp.pct15m ?? 0);
  if (a15 >= 0.05 && a15 <= 1.8) score += 16;

  if (Math.abs(perp.pct4h ?? 0) > 14) score -= 22;

  if (trend15m === "sideways") score += 12;
  else if (Math.abs(netPct) < 0.35) score += 6;

  const quickWinScore = Math.max(0, Math.min(100, Math.round(score)));
  if (quickWinScore < 42) return null;

  let momentumBias: "long" | "short" | "neutral" = "neutral";
  if (bias === "long") momentumBias = "long";
  else if (bias === "short") momentumBias = "short";
  else if ((perp.pct5m ?? 0) > 0.04) momentumBias = "long";
  else if ((perp.pct5m ?? 0) < -0.04) momentumBias = "short";

  const suggestedLeverage = range15 < 0.014 ? 50 : range15 < 0.022 ? 35 : 25;

  return {
    quickWinScore,
    momentumBias,
    rangePct15m: Number((range15 * 100).toFixed(3)),
    liquidityNote:
      vol > 5_000_000
        ? "High perp volume — fills usually manageable."
        : "Moderate volume — size down if spreads widen.",
    suggestedLeverage,
    estHoldMinutes: range15 < 0.016 ? 6 : 12,
  };
}
