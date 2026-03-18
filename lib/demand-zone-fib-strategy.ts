/**
 * Demand Zone + Deep Fibonacci retracement confluence (LONG playbook).
 * Owner reference / future scanner wiring — not connected to Telegram alerts.
 */

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface DemandZone {
  top: number;
  bottom: number;
  strength: "weak" | "moderate" | "strong";
  startIndex: number;
}

export interface FibLevels {
  swingHigh: number;
  swingLow: number;
  level_0: number;
  level_236: number;
  level_382: number;
  level_500: number;
  level_618: number;
  level_764: number;
  level_786: number;
  level_886: number;
  level_100: number;
}

export interface ConfluenceZone {
  priceTop: number;
  priceBottom: number;
  fibLevelsPresent: string[];
  demandZone: DemandZone;
  strength: "low" | "medium" | "high" | "very_high";
}

export interface EntrySignal {
  type: "LONG";
  instrument: string;
  timeframe: string;
  entryPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  riskRewardRatio: number;
  confluenceZone: ConfluenceZone;
  fibLevels: FibLevels;
  confirmationCandle: Candle;
  timestamp: number;
  reasoning: string;
}

export interface StrategyConfig {
  instrument: string;
  htfTimeframe: string;
  ltfTimeframe: string;
  demandZoneLookback: number;
  swingLookback: number;
  deepFibMin: number;
  deepFibMax: number;
  confirmationBodyRatio: number;
  maxZoneWidth: number;
  minRiskReward: number;
  fundingRateFilter?: number;
}

export const DEFAULT_DEMAND_FIB_CONFIG: StrategyConfig = {
  instrument: "XAUUSD",
  htfTimeframe: "4h",
  ltfTimeframe: "5m",
  demandZoneLookback: 100,
  swingLookback: 50,
  deepFibMin: 0.764,
  deepFibMax: 0.886,
  confirmationBodyRatio: 0.5,
  maxZoneWidth: 0.02,
  minRiskReward: 1.5,
};

export function findSwingPoints(
  candles: Candle[],
  lookback: number,
  pivotStrength: number = 3
): { swingHigh: number; swingHighIndex: number; swingLow: number; swingLowIndex: number } | null {
  if (candles.length < lookback) return null;
  const slice = candles.slice(-lookback);
  let swingHigh = -Infinity;
  let swingHighIndex = -1;
  let swingLow = Infinity;
  let swingLowIndex = -1;
  for (let i = pivotStrength; i < slice.length - pivotStrength; i++) {
    const current = slice[i];
    const isSwingHigh =
      slice.slice(i - pivotStrength, i).every((c) => c.high <= current.high) &&
      slice.slice(i + 1, i + pivotStrength + 1).every((c) => c.high <= current.high);
    if (isSwingHigh && current.high > swingHigh) {
      swingHigh = current.high;
      swingHighIndex = i;
    }
    const isSwingLow =
      slice.slice(i - pivotStrength, i).every((c) => c.low >= current.low) &&
      slice.slice(i + 1, i + pivotStrength + 1).every((c) => c.low >= current.low);
    if (isSwingLow && current.low < swingLow) {
      swingLow = current.low;
      swingLowIndex = i;
    }
  }
  if (swingHighIndex === -1 || swingLowIndex === -1) return null;
  if (swingHighIndex >= swingLowIndex) return null;
  return { swingHigh, swingHighIndex, swingLow, swingLowIndex };
}

export function calculateFibLevels(swingHigh: number, swingLow: number): FibLevels {
  const range = swingHigh - swingLow;
  return {
    swingHigh,
    swingLow,
    level_0: swingLow,
    level_236: swingHigh - range * 0.236,
    level_382: swingHigh - range * 0.382,
    level_500: swingHigh - range * 0.5,
    level_618: swingHigh - range * 0.618,
    level_764: swingHigh - range * 0.764,
    level_786: swingHigh - range * 0.786,
    level_886: swingHigh - range * 0.886,
    level_100: swingHigh,
  };
}

export function detectDemandZones(candles: Candle[], lookback: number, maxZoneWidthPct: number = 0.02): DemandZone[] {
  const zones: DemandZone[] = [];
  const slice = candles.slice(-lookback);
  for (let i = 2; i < slice.length - 2; i++) {
    const prev2 = slice[i - 2];
    const prev1 = slice[i - 1];
    const curr = slice[i];
    const next1 = slice[i + 1];
    const prev2Body = Math.abs(prev2.close - prev2.open);
    const prev1Body = Math.abs(prev1.close - prev1.open);
    const prev2Range = prev2.high - prev2.low;
    const prev1Range = prev1.high - prev1.low;
    const prev2IsConsolidation = prev2Range > 0 && prev2Body / prev2Range < 0.4;
    const prev1IsConsolidation = prev1Range > 0 && prev1Body / prev1Range < 0.4;
    const currRange = curr.high - curr.low;
    const currBody = curr.close - curr.open;
    const currIsImpulse = currBody > 0 && currRange > 0 && currBody / currRange > 0.6;
    const nextIsConfirming = next1.close > curr.close;
    if (prev2IsConsolidation && prev1IsConsolidation && currIsImpulse && nextIsConfirming) {
      const zoneBottom = Math.min(prev2.low, prev1.low);
      const zoneTop = Math.max(prev2.high, prev1.high);
      const zoneWidth = (zoneTop - zoneBottom) / zoneBottom;
      if (zoneWidth <= maxZoneWidthPct) {
        const impulseSize = currBody / zoneBottom;
        let strength: DemandZone["strength"] = "weak";
        if (impulseSize > 0.015) strength = "strong";
        else if (impulseSize > 0.007) strength = "moderate";
        zones.push({
          top: zoneTop,
          bottom: zoneBottom,
          strength,
          startIndex: candles.length - lookback + i - 2,
        });
      }
    }
  }
  return zones;
}

function getDeepFibPrices(fibs: FibLevels, deepFibMin: number, deepFibMax: number): Record<string, number> {
  const range = fibs.swingHigh - fibs.swingLow;
  const allLevels: Record<string, number> = {
    "76.4%": fibs.level_764,
    "78.6%": fibs.level_786,
    "88.6%": fibs.level_886,
    "61.8%": fibs.level_618,
  };
  return Object.fromEntries(
    Object.entries(allLevels).filter(([, price]) => {
      const pct = (fibs.swingHigh - price) / range;
      return pct >= deepFibMin - 0.05 && pct <= deepFibMax + 0.05;
    })
  );
}

export function findFibDemandConfluence(
  demandZones: DemandZone[],
  fibLevels: FibLevels,
  deepFibMin: number,
  deepFibMax: number
): ConfluenceZone[] {
  const confluences: ConfluenceZone[] = [];
  const deepFibPrices = getDeepFibPrices(fibLevels, deepFibMin, deepFibMax);
  for (const zone of demandZones) {
    const overlappingFibs: string[] = [];
    for (const [label, price] of Object.entries(deepFibPrices)) {
      if (price >= zone.bottom && price <= zone.top) overlappingFibs.push(label);
      const tolerance = price * 0.003;
      if (zone.bottom <= price + tolerance && zone.top >= price - tolerance && !overlappingFibs.includes(label)) {
        overlappingFibs.push(label);
      }
    }
    if (overlappingFibs.length > 0) {
      let strengthScore = 0;
      if (zone.strength === "strong") strengthScore += 3;
      else if (zone.strength === "moderate") strengthScore += 2;
      else strengthScore += 1;
      strengthScore += overlappingFibs.length;
      let strength: ConfluenceZone["strength"] = "low";
      if (strengthScore >= 6) strength = "very_high";
      else if (strengthScore >= 4) strength = "high";
      else if (strengthScore >= 3) strength = "medium";
      confluences.push({
        priceTop: zone.top,
        priceBottom: zone.bottom,
        fibLevelsPresent: overlappingFibs,
        demandZone: zone,
        strength,
      });
    }
  }
  return confluences.sort((a, b) => {
    const order = { very_high: 4, high: 3, medium: 2, low: 1 };
    return order[b.strength] - order[a.strength];
  });
}

export function checkConfirmationCandle(
  ltfCandles: Candle[],
  confluenceZone: ConfluenceZone,
  minBodyRatio: number = 0.5
): { confirmed: boolean; candle: Candle; pattern: string } {
  if (ltfCandles.length < 2) {
    return { confirmed: false, candle: ltfCandles[ltfCandles.length - 1], pattern: "none" };
  }
  const current = ltfCandles[ltfCandles.length - 1];
  const previous = ltfCandles[ltfCandles.length - 2];
  const currBody = current.close - current.open;
  const currRange = current.high - current.low;
  const currLowerWick = Math.min(current.open, current.close) - current.low;
  const isBullish = currBody > 0;
  const priceTappedZone =
    current.low <= confluenceZone.priceTop &&
    current.low >= confluenceZone.priceBottom - (confluenceZone.priceTop - confluenceZone.priceBottom) * 0.5;
  const closeAboveZone = current.close >= confluenceZone.priceTop * 0.998;
  if (!isBullish || !priceTappedZone || !closeAboveZone) {
    return { confirmed: false, candle: current, pattern: "none" };
  }
  const prevBody = previous.close - previous.open;
  const isBullishEngulfing =
    prevBody < 0 && current.open <= previous.close && current.close >= previous.open;
  if (isBullishEngulfing) return { confirmed: true, candle: current, pattern: "bullish_engulfing" };
  const isPinBar =
    currRange > 0 && currLowerWick / currRange >= 0.6 && Math.abs(currBody) / currRange <= 0.3;
  if (isPinBar) return { confirmed: true, candle: current, pattern: "pin_bar" };
  const isStrongClose = currRange > 0 && currBody / currRange >= minBodyRatio;
  if (isStrongClose) return { confirmed: true, candle: current, pattern: "strong_bullish_close" };
  return { confirmed: false, candle: current, pattern: "none" };
}

export function isFundingRateFavorable(fundingRate: number, maxAbsoluteRate: number = 0.001): boolean {
  if (fundingRate < 0) return true;
  if (fundingRate <= maxAbsoluteRate) return true;
  return false;
}

export interface TradeParams {
  entryPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
}

export function calculateRiskReward(params: TradeParams): {
  riskPips: number;
  rewardPips1: number;
  rewardPips2: number;
  rr1: number;
  rr2: number;
} {
  const riskPips = params.entryPrice - params.stopLoss;
  const rewardPips1 = params.takeProfit1 - params.entryPrice;
  const rewardPips2 = params.takeProfit2 - params.entryPrice;
  return {
    riskPips,
    rewardPips1,
    rewardPips2,
    rr1: riskPips > 0 ? rewardPips1 / riskPips : 0,
    rr2: riskPips > 0 ? rewardPips2 / riskPips : 0,
  };
}

function buildReasoning(
  confluence: ConfluenceZone,
  fibs: FibLevels,
  pattern: string,
  rr: ReturnType<typeof calculateRiskReward>,
  fundingRate?: number
): string {
  const parts: string[] = [];
  parts.push(
    `Price tapped ${confluence.strength} demand zone [${confluence.priceBottom.toFixed(2)}–${confluence.priceTop.toFixed(2)}]`
  );
  parts.push(`overlapping with Fib levels: ${confluence.fibLevelsPresent.join(", ")}`);
  parts.push(`(Swing: ${fibs.swingHigh.toFixed(2)} → ${fibs.swingLow.toFixed(2)})`);
  parts.push(`Confirmation: ${pattern.replace(/_/g, " ")}`);
  parts.push(`R:R = ${rr.rr1.toFixed(2)}:1 (TP1) / ${rr.rr2.toFixed(2)}:1 (TP2)`);
  if (fundingRate !== undefined) {
    parts.push(`Funding rate: ${(fundingRate * 100).toFixed(4)}% (${fundingRate < 0 ? "favorable" : "neutral"})`);
  }
  return parts.join(" | ");
}

/** Optional OHLCV scanner — returns null if no setup. No side effects / no alerts. */
export function detectDemandFibSetup(
  htfCandles: Candle[],
  ltfCandles: Candle[],
  config: StrategyConfig = DEFAULT_DEMAND_FIB_CONFIG,
  fundingRate?: number
): EntrySignal | null {
  if (
    fundingRate !== undefined &&
    config.fundingRateFilter !== undefined &&
    !isFundingRateFavorable(fundingRate, config.fundingRateFilter)
  ) {
    return null;
  }
  const swings = findSwingPoints(htfCandles, config.swingLookback);
  if (!swings) return null;
  const fibLevels = calculateFibLevels(swings.swingHigh, swings.swingLow);
  const demandZones = detectDemandZones(htfCandles, config.demandZoneLookback, config.maxZoneWidth);
  if (demandZones.length === 0) return null;
  const confluences = findFibDemandConfluence(demandZones, fibLevels, config.deepFibMin, config.deepFibMax);
  if (confluences.length === 0) return null;
  const bestConfluence = confluences[0];
  const latestLTFCandle = ltfCandles[ltfCandles.length - 1];
  const priceInZone =
    latestLTFCandle.close >= bestConfluence.priceBottom && latestLTFCandle.close <= bestConfluence.priceTop * 1.005;
  if (!priceInZone) return null;
  const confirmation = checkConfirmationCandle(ltfCandles, bestConfluence, config.confirmationBodyRatio);
  if (!confirmation.confirmed) return null;
  const entryPrice = bestConfluence.priceTop;
  const stopLoss = bestConfluence.priceBottom * 0.998;
  const takeProfit1 = fibLevels.level_500;
  const takeProfit2 = fibLevels.level_382;
  const rr = calculateRiskReward({ entryPrice, stopLoss, takeProfit1, takeProfit2 });
  if (rr.rr1 < config.minRiskReward) return null;
  return {
    type: "LONG",
    instrument: config.instrument,
    timeframe: config.ltfTimeframe,
    entryPrice,
    stopLoss,
    takeProfit1,
    takeProfit2,
    riskRewardRatio: rr.rr1,
    confluenceZone: bestConfluence,
    fibLevels,
    confirmationCandle: confirmation.candle,
    timestamp: confirmation.candle.time,
    reasoning: buildReasoning(bestConfluence, fibLevels, confirmation.pattern, rr, fundingRate),
  };
}

export function formatDemandFibSignalText(signal: EntrySignal): string {
  const fibList = signal.confluenceZone.fibLevelsPresent.join(", ");
  const zoneStrength = signal.confluenceZone.strength.toUpperCase().replace("_", " ");
  return [
    `NOVASTARIS — Demand + Fib LONG (${signal.instrument})`,
    `Timeframe: ${signal.timeframe}`,
    `Entry: ${signal.entryPrice.toFixed(4)} | SL: ${signal.stopLoss.toFixed(4)}`,
    `TP1 (50% Fib): ${signal.takeProfit1.toFixed(4)} | TP2 (38.2%): ${signal.takeProfit2.toFixed(4)}`,
    `R:R: ${signal.riskRewardRatio.toFixed(2)}:1 | Zone: ${zoneStrength} | Fibs: ${fibList}`,
    signal.reasoning,
    "Not financial advice.",
  ].join("\n");
}
