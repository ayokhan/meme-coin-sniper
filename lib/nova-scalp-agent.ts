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
import { estimateBlofinIsolatedLiquidation } from "@/lib/blofin-estimated-liq";
import { roundPx as roundPxWithTick } from "@/lib/blofin-tick";

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
  { id: "4h", label: "4 hours", interval: "1h", limit: 48, estHoldMinutes: 240 },
  { id: "1d", label: "1 day", interval: "1d", limit: 42, estHoldMinutes: 1440 },
] as const;

export type ScalpTimeframeId = (typeof SCALP_TIMEFRAMES)[number]["id"];

export type ScalpSide = "long" | "short" | "no_entry";

export type ScalpEntryMode = "limit" | "market";

export const SCALP_ENTRY_NEAR_PCT = 0.15;

export type NovaScalpAnalysis = {
  symbol: string;
  timeframeId: ScalpTimeframeId;
  timeframeLabel: string;
  amountUsd: number;
  leverage: number;
  /** Max loss on margin used to compute optional risk stop (default 5%). */
  maxLossPctOnMargin: number;
  analyzedAt: string;
  currentPrice: number | null;
  /** Price when the plan was generated — reference for market entry. */
  enterNowPrice: number | null;
  /** Limit / retest entry level. */
  entryPrice: number | null;
  entryMode: ScalpEntryMode | null;
  side: ScalpSide;
  exitPrice: number | null;
  /** Structural invalidation (chart-based). */
  stopLossPrice: number | null;
  /** Stop from max-loss % on margin (tighter risk cap). */
  riskStopLossPrice: number | null;
  /** Tighter of structural vs risk — suggested if you want a hard loss cap. */
  recommendedStopPrice: number | null;
  /** Candles in the window whose range traded near entry (within tolerance). */
  entryTouches: number | null;
  /** Candles in the window whose range traded near exit target (within tolerance). */
  exitTouches: number | null;
  expectedPnlUsd: number | null;
  expectedPnlPctOnMargin: number | null;
  /** If filled at limit entry then stopped at structural invalidation. */
  lossAtStopUsd: number | null;
  lossAtStopPctOnMargin: number | null;
  /** If filled at limit entry then stopped at risk cap (max-loss % on margin). */
  lossAtRiskStopUsd: number | null;
  lossAtRiskStopPctOnMargin: number | null;
  /**
   * Estimated isolated Blofin liquidation price at plan entry + notional (margin × leverage).
   * Confirm Est. Liq. on Blofin — not exchange truth.
   */
  estimatedLiquidationPrice: number | null;
  /** % price move from entry to estimated liq. */
  estimatedLiqDistancePct: number | null;
  /** True when structural stop is beyond estimated liq (stop would not protect before liq). */
  stopBeyondEstimatedLiq: boolean | null;
  estimatedHoldMinutes: number | null;
  structureDirection: "bullish" | "bearish" | "sideways";
  trendlineBias: "up" | "down" | "flat";
  blendedDirection: "bullish" | "bearish" | "sideways";
  rationale: string;
  disclaimer: string;
};

/** Timeframe used for Quick Wins list + “Analyze” handoff (must match Run Agent logic). */
export const QUICK_WIN_SCALP_TIMEFRAME_ID: ScalpTimeframeId = "5m";

export type QuickWinScanSummary = {
  symbolsScanned: number;
  oscillationQualified: number;
  entryConfirmed: number;
};

/** Liquid, tight-range symbol with no confirmed entry yet — shown when Quick Wins list is empty. */
export type NovaScalpNearSetup = {
  symbol: string;
  quickWinScore: number;
  blendedDirection: string;
  structureDirection: string;
  note: string;
};

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

/** Round plan levels to Blofin tickSize when provided; else heuristic decimals. */
function roundPx(n: number, ref: number, tickSize?: number | null): number {
  return roundPxWithTick(n, ref, tickSize);
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

/** Exported for UI — PnL from entry to exit/stop at given margin + leverage. */
export function estimateScalpPnl(
  side: "long" | "short",
  entry: number,
  exitOrStop: number,
  amountUsd: number,
  leverage: number
): { pnlUsd: number; pnlPctMargin: number } {
  return estimatePnl(side, entry, exitOrStop, amountUsd, leverage);
}

function lossFields(
  side: "long" | "short",
  entry: number,
  structuralStop: number,
  riskStop: number | null,
  amountUsd: number,
  leverage: number
): Pick<
  NovaScalpAnalysis,
  | "lossAtStopUsd"
  | "lossAtStopPctOnMargin"
  | "lossAtRiskStopUsd"
  | "lossAtRiskStopPctOnMargin"
> {
  const atStructural = estimatePnl(side, entry, structuralStop, amountUsd, leverage);
  const atRisk =
    riskStop != null ? estimatePnl(side, entry, riskStop, amountUsd, leverage) : null;
  return {
    lossAtStopUsd: Number(atStructural.pnlUsd.toFixed(2)),
    lossAtStopPctOnMargin: Number(atStructural.pnlPctMargin.toFixed(2)),
    lossAtRiskStopUsd: atRisk ? Number(atRisk.pnlUsd.toFixed(2)) : null,
    lossAtRiskStopPctOnMargin: atRisk ? Number(atRisk.pnlPctMargin.toFixed(2)) : null,
  };
}

const EMPTY_LOSS_FIELDS: Pick<
  NovaScalpAnalysis,
  | "lossAtStopUsd"
  | "lossAtStopPctOnMargin"
  | "lossAtRiskStopUsd"
  | "lossAtRiskStopPctOnMargin"
  | "estimatedLiquidationPrice"
  | "estimatedLiqDistancePct"
  | "stopBeyondEstimatedLiq"
> = {
  lossAtStopUsd: null,
  lossAtStopPctOnMargin: null,
  lossAtRiskStopUsd: null,
  lossAtRiskStopPctOnMargin: null,
  estimatedLiquidationPrice: null,
  estimatedLiqDistancePct: null,
  stopBeyondEstimatedLiq: null,
};

function scalpLiqFields(
  symbol: string,
  side: "long" | "short",
  entry: number,
  stop: number | null,
  amountUsd: number,
  leverage: number,
  tickSize?: number | null
): Pick<
  NovaScalpAnalysis,
  "estimatedLiquidationPrice" | "estimatedLiqDistancePct" | "stopBeyondEstimatedLiq"
> {
  const notional = amountUsd * leverage;
  const est = estimateBlofinIsolatedLiquidation({
    symbol,
    side,
    entryPrice: entry,
    leverage,
    positionNotionalUsdt: notional,
  });
  const liq = est.liquidationPrice != null ? roundPx(est.liquidationPrice, entry, tickSize) : null;
  let stopBeyond: boolean | null = null;
  if (liq != null && stop != null && Number.isFinite(stop)) {
    stopBeyond = side === "long" ? stop < liq : stop > liq;
  }
  return {
    estimatedLiquidationPrice: liq,
    estimatedLiqDistancePct:
      est.liqDistancePct != null ? Number(est.liqDistancePct.toFixed(2)) : null,
    stopBeyondEstimatedLiq: stopBeyond,
  };
}

function positionInRange(price: number, low: number, high: number): number {
  const span = high - low;
  if (span <= 0) return 0.5;
  return (price - low) / span;
}

export function riskStopFromMaxLossPct(
  side: "long" | "short",
  entry: number,
  leverage: number,
  maxLossPctOnMargin: number,
  tickSize?: number | null
): number {
  const movePct = maxLossPctOnMargin / Math.max(1, leverage);
  return side === "long"
    ? roundPx(entry * (1 - movePct / 100), entry, tickSize)
    : roundPx(entry * (1 + movePct / 100), entry, tickSize);
}

export function recommendedStopPrice(
  side: "long" | "short",
  structural: number,
  risk: number
): number {
  return side === "long" ? Math.max(structural, risk) : Math.min(structural, risk);
}

export function detectEntryMode(enterNow: number, limitEntry: number): ScalpEntryMode {
  const diffPct = (Math.abs(enterNow - limitEntry) / enterNow) * 100;
  return diffPct <= SCALP_ENTRY_NEAR_PCT ? "market" : "limit";
}

function emptyPlanMeta(
  maxLossPctOnMargin: number,
  analyzedAt: string
): Pick<
  NovaScalpAnalysis,
  | "maxLossPctOnMargin"
  | "analyzedAt"
  | "enterNowPrice"
  | "entryMode"
  | "riskStopLossPrice"
  | "recommendedStopPrice"
> {
  return {
    maxLossPctOnMargin,
    analyzedAt,
    enterNowPrice: null,
    entryMode: null,
    riskStopLossPrice: null,
    recommendedStopPrice: null,
  };
}

export type ScalpReconfirmAnchor = {
  side: "long" | "short";
  entryPrice: number;
  exitPrice: number;
  stopLossPrice: number;
  analyzedAt?: string | null;
  entryMode?: ScalpEntryMode | null;
};

/** Keep a waiting limit plan alive this long when a fresh rescan would return NO ENTRY. */
export const SCALP_RECONFIRM_MAX_AGE_MS = 25 * 60 * 1000;

/**
 * If a fresh scan says no_entry but the previous waiting plan is still structurally valid
 * (price between stop and target), keep those levels so Refresh doesn't wipe a valid wait.
 */
function reconfirmWaitingLimitPlan(params: {
  anchor: ScalpReconfirmAnchor;
  symbol: string;
  timeframeId: ScalpTimeframeId;
  timeframeLabel: string;
  amountUsd: number;
  leverage: number;
  maxLossPctOnMargin: number;
  analyzedAt: string;
  price: number;
  tickSize: number | null;
  structureDirection: NovaScalpAnalysis["structureDirection"];
  trendlineBias: NovaScalpAnalysis["trendlineBias"];
  blendedDirection: NovaScalpAnalysis["blendedDirection"];
  trendlineRead: string;
  candles: CandleTuple[];
}): NovaScalpAnalysis | null {
  const { anchor, price } = params;
  if (anchor.side !== "long" && anchor.side !== "short") return null;
  if (
    !Number.isFinite(anchor.entryPrice) ||
    !Number.isFinite(anchor.exitPrice) ||
    !Number.isFinite(anchor.stopLossPrice)
  ) {
    return null;
  }

  const ageMs = anchor.analyzedAt ? Date.now() - Date.parse(anchor.analyzedAt) : 0;
  if (Number.isFinite(ageMs) && ageMs > SCALP_RECONFIRM_MAX_AGE_MS) return null;

  const side = anchor.side;
  const entry = roundPx(anchor.entryPrice, price, params.tickSize);
  const exit = roundPx(anchor.exitPrice, price, params.tickSize);
  const sl = roundPx(anchor.stopLossPrice, price, params.tickSize);

  if (side === "long") {
    if (price <= sl) return null;
    if (price >= exit) return null;
  } else {
    if (price >= sl) return null;
    if (price <= exit) return null;
  }

  const entryMode = detectEntryMode(price, entry);
  const riskStop = riskStopFromMaxLossPct(side, entry, params.leverage, params.maxLossPctOnMargin, params.tickSize);
  const recStop = recommendedStopPrice(side, sl, riskStop);
  const distPct = Math.abs((exit - entry) / entry) * 100;
  const tfHold = scalpTimeframeConfig(params.timeframeId).estHoldMinutes;
  const estHold = Math.max(
    1,
    Math.round(tfHold * Math.min(1.4, Math.max(0.35, distPct / 0.45)))
  );
  const { pnlUsd, pnlPctMargin } = estimatePnl(side, entry, exit, params.amountUsd, params.leverage);
  const { entryTouches, exitTouches } = countEntryExitTouches(params.candles, entry, exit, side);
  const liq = scalpLiqFields(
    params.symbol,
    side,
    entry,
    sl,
    params.amountUsd,
    params.leverage,
    params.tickSize
  );

  const waitNote =
    entryMode === "market"
      ? " Price is at the limit zone — enter now."
      : ` Still waiting for limit entry near ${entry.toLocaleString()} (kept from prior plan; structure mid-range on rescan).`;

  return {
    symbol: params.symbol,
    timeframeId: params.timeframeId,
    timeframeLabel: params.timeframeLabel,
    amountUsd: params.amountUsd,
    leverage: params.leverage,
    maxLossPctOnMargin: params.maxLossPctOnMargin,
    analyzedAt: params.analyzedAt,
    currentPrice: price,
    enterNowPrice: price,
    entryMode,
    side,
    entryPrice: entry,
    exitPrice: exit,
    stopLossPrice: sl,
    riskStopLossPrice: riskStop,
    recommendedStopPrice: recStop,
    entryTouches,
    exitTouches,
    expectedPnlUsd: Number(pnlUsd.toFixed(2)),
    expectedPnlPctOnMargin: Number(pnlPctMargin.toFixed(2)),
    ...lossFields(side, entry, sl, riskStop, params.amountUsd, params.leverage),
    ...liq,
    estimatedHoldMinutes: estHold,
    structureDirection: params.structureDirection,
    trendlineBias: params.trendlineBias,
    blendedDirection: params.blendedDirection,
    rationale: `Reconfirmed ${side.toUpperCase()} wait plan.${waitNote} ${params.trendlineRead}`.trim(),
    disclaimer: NOVA_SCALP_DISCLAIMER,
  };
}

export function analyzeScalpSetup(input: {
  symbol: string;
  timeframeId: string;
  amountUsd: number;
  leverage: number;
  maxLossPctOnMargin?: number;
  analyzedAt?: string;
  candles: Candle[];
  currentPrice: number | null;
  /** Blofin tickSize — when set, entry/exit/stop round to exchange-legal increments. */
  tickSize?: number | null;
  /** Cap for leverage clamp (default 125 for crypto; forex plans may pass 2000). */
  maxLeverage?: number | null;
  /**
   * Prior waiting plan — if a full rescan would return no_entry but price is still
   * between stop and target, keep these levels (prevents "wait → refresh → NO ENTRY").
   */
  reconfirm?: ScalpReconfirmAnchor | null;
}): NovaScalpAnalysis {
  const tf = scalpTimeframeConfig(input.timeframeId);
  const symbol = resolveScalpSymbol(input.symbol);
  const amountUsd = Math.max(1, Number(input.amountUsd) || 100);
  const maxLev =
    input.maxLeverage != null && Number.isFinite(input.maxLeverage) && input.maxLeverage > 0
      ? Math.min(10_000, Math.max(1, input.maxLeverage))
      : 125;
  const leverage = Math.min(maxLev, Math.max(1, Number(input.leverage) || 10));
  const maxLossPctOnMargin = Math.min(100, Math.max(0.5, Number(input.maxLossPctOnMargin) || 5));
  const analyzedAt = input.analyzedAt ?? new Date().toISOString();
  const tickSize =
    input.tickSize != null && Number.isFinite(input.tickSize) && input.tickSize > 0 ? input.tickSize : null;
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
      ...emptyPlanMeta(maxLossPctOnMargin, analyzedAt),
      currentPrice: price,
      side: "no_entry",
      entryPrice: null,
      exitPrice: null,
      stopLossPrice: null,
      entryTouches: null,
      exitTouches: null,
      expectedPnlUsd: null,
      expectedPnlPctOnMargin: null,
      ...EMPTY_LOSS_FIELDS,
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
    pos <= 0.48;
  const bearishSetup =
    (blendedDirection === "bearish" || (structureDirection === "bearish" && trendlineBias !== "up")) &&
    pos >= 0.52;

  if (blendedDirection === "sideways") {
    if (pos <= 0.28) {
      side = "long";
      entry = roundPx(low + buffer * 0.35, price, tickSize);
      exit = roundPx(mid + span * 0.12, price, tickSize);
      sl = roundPx(low - buffer * 0.5, price, tickSize);
    } else if (pos >= 0.72) {
      side = "short";
      entry = roundPx(high - buffer * 0.35, price, tickSize);
      exit = roundPx(mid - span * 0.12, price, tickSize);
      sl = roundPx(high + buffer * 0.5, price, tickSize);
    }
  } else if (bullishSetup) {
    side = "long";
    entry = roundPx(Math.min(price, low + buffer), price, tickSize);
    exit = roundPx(Math.max(mid, price + span * 0.35), price, tickSize);
    sl = roundPx(low - buffer * 0.65, price, tickSize);
  } else if (bearishSetup) {
    side = "short";
    entry = roundPx(Math.max(price, high - buffer), price, tickSize);
    exit = roundPx(Math.min(mid, price - span * 0.35), price, tickSize);
    sl = roundPx(high + buffer * 0.65, price, tickSize);
  }

  if (side === "no_entry") {
    const kept =
      input.reconfirm && price != null
        ? reconfirmWaitingLimitPlan({
            anchor: input.reconfirm,
            symbol,
            timeframeId: tf.id,
            timeframeLabel: tf.label,
            amountUsd,
            leverage,
            maxLossPctOnMargin,
            analyzedAt,
            price,
            tickSize,
            structureDirection,
            trendlineBias,
            blendedDirection,
            trendlineRead: tl?.read ?? "",
            candles: rows,
          })
        : null;
    if (kept) return kept;

    return {
      symbol,
      timeframeId: tf.id,
      timeframeLabel: tf.label,
      amountUsd,
      leverage,
      ...emptyPlanMeta(maxLossPctOnMargin, analyzedAt),
      currentPrice: price,
      side,
      entryPrice: null,
      exitPrice: null,
      stopLossPrice: null,
      entryTouches: null,
      exitTouches: null,
      expectedPnlUsd: null,
      expectedPnlPctOnMargin: null,
      ...EMPTY_LOSS_FIELDS,
      estimatedHoldMinutes: null,
      structureDirection,
      trendlineBias,
      blendedDirection,
      rationale:
        "No clear scalp edge: price is mid-range or structure/trendline conflict. Wait for retest of range low (long) or high (short), or pick a tighter timeframe. Tip: while Waiting for limit entry, use Watch — Refresh rebuilds the setup and can flip to NO ENTRY.",
      disclaimer: NOVA_SCALP_DISCLAIMER,
    };
  }

  const limitEntry = entry;
  const enterNowPrice = price;
  const entryMode = detectEntryMode(enterNowPrice, limitEntry);
  const riskStop = riskStopFromMaxLossPct(side, limitEntry, leverage, maxLossPctOnMargin, tickSize);
  const recStop = recommendedStopPrice(side, sl, riskStop);

  const distPct = Math.abs((exit - entry) / entry) * 100;
  const estHold = Math.max(
    1,
    Math.round(tf.estHoldMinutes * Math.min(1.4, Math.max(0.35, distPct / 0.45)))
  );
  const { pnlUsd, pnlPctMargin } = estimatePnl(side, limitEntry, exit, amountUsd, leverage);
  const { entryTouches, exitTouches } = countEntryExitTouches(rows, limitEntry, exit, side);
  const liq = scalpLiqFields(symbol, side, limitEntry, sl, amountUsd, leverage, tickSize);

  const entryNote =
    entryMode === "market"
      ? " Enter now — price is at the limit zone."
      : ` Wait for limit entry near ${roundPx(limitEntry, price, tickSize).toLocaleString()}.`;

  const rationale =
    side === "long"
      ? `Structure ${structureDirection}, trendline ${trendlineBias} → blended ${blendedDirection}. Price in lower ${Math.round(pos * 100)}% of ${tf.label} range — long toward range mid/target.${entryNote} ${tl?.read ?? ""}`
      : `Structure ${structureDirection}, trendline ${trendlineBias} → blended ${blendedDirection}. Price in upper ${Math.round((1 - pos) * 100)}% of ${tf.label} range — short toward range mid/target.${entryNote} ${tl?.read ?? ""}`;

  return {
    symbol,
    timeframeId: tf.id,
    timeframeLabel: tf.label,
    amountUsd,
    leverage,
    maxLossPctOnMargin,
    analyzedAt,
    currentPrice: price,
    enterNowPrice,
    entryMode,
    side,
    entryPrice: limitEntry,
    exitPrice: exit,
    stopLossPrice: sl,
    riskStopLossPrice: riskStop,
    recommendedStopPrice: recStop,
    entryTouches,
    exitTouches,
    expectedPnlUsd: Number(pnlUsd.toFixed(2)),
    expectedPnlPctOnMargin: Number(pnlPctMargin.toFixed(2)),
    ...lossFields(side, limitEntry, sl, riskStop, amountUsd, leverage),
    ...liq,
    estimatedHoldMinutes: estHold,
    structureDirection,
    trendlineBias,
    blendedDirection,
    rationale: rationale.trim(),
    disclaimer: NOVA_SCALP_DISCLAIMER,
  };
}

export const QUICK_WIN_MIN_OSCILLATION_SCORE = 36;

/** Rank + require a valid scalp plan on the selected TF (same rules as Run Agent). */
export function evaluateQuickWinPerp(
  perp: TrendingPerp,
  candles15m: Candle[],
  candles5m: Candle[],
  scalpCandles: Candle[],
  amountUsd = 100,
  scalpTimeframeId: string = QUICK_WIN_SCALP_TIMEFRAME_ID,
  userLeverage?: number,
  tickSize?: number | null
): { win: NovaScalpQuickWin | null; near: NovaScalpNearSetup | null; oscillationOk: boolean } {
  const oscillation = scoreOscillationProfile(perp, candles15m, candles5m);
  if (!oscillation) return { win: null, near: null, oscillationOk: false };

  const tfId = isValidScalpTimeframeId(scalpTimeframeId) ? scalpTimeframeId : QUICK_WIN_SCALP_TIMEFRAME_ID;
  const price = Number(perp.markPx ?? 0) || null;
  const leverage =
    userLeverage != null && Number.isFinite(userLeverage)
      ? Math.min(125, Math.max(1, userLeverage))
      : oscillation.suggestedLeverage;
  const analysis = analyzeScalpSetup({
    symbol: perp.coin,
    timeframeId: tfId,
    amountUsd,
    leverage,
    candles: scalpCandles,
    currentPrice: price,
    tickSize,
  });

  if (
    (analysis.side === "long" || analysis.side === "short") &&
    analysis.entryPrice != null &&
    analysis.exitPrice != null
  ) {
    const side = analysis.side;
    return {
      win: {
        symbol: perp.coin,
        quickWinScore: oscillation.quickWinScore,
        momentumBias: oscillation.momentumBias,
        rangePct15m: oscillation.rangePct15m,
        liquidityNote: oscillation.liquidityNote,
        directionHint: `${side.toUpperCase()} on ${analysis.timeframeLabel}: ${analysis.rationale.split(".")[0]}.`,
        suggestedLeverage: leverage,
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
      },
      near: null,
      oscillationOk: true,
    };
  }

  const near =
    oscillation.quickWinScore >= 48
      ? {
          symbol: perp.coin,
          quickWinScore: oscillation.quickWinScore,
          blendedDirection: analysis.blendedDirection,
          structureDirection: analysis.structureDirection,
          note: analysis.rationale.split(".")[0] ?? analysis.rationale,
        }
      : null;

  return { win: null, near, oscillationOk: true };
}

export function buildQuickWinCandidate(
  perp: TrendingPerp,
  candles15m: Candle[],
  candles5m: Candle[],
  scalpCandles: Candle[],
  amountUsd = 100,
  scalpTimeframeId: string = QUICK_WIN_SCALP_TIMEFRAME_ID,
  userLeverage?: number,
  tickSize?: number | null
): NovaScalpQuickWin | null {
  return evaluateQuickWinPerp(
    perp,
    candles15m,
    candles5m,
    scalpCandles,
    amountUsd,
    scalpTimeframeId,
    userLeverage,
    tickSize
  ).win;
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
  if (quickWinScore < QUICK_WIN_MIN_OSCILLATION_SCORE) return null;

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
