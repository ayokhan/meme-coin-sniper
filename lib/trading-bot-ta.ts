/**
 * Technical analysis for trading bot: EMA, SMA, RSI, S/R, MA crossover, candle rules.
 * Candles from Blofin: [ts, open, high, low, close, vol, volCurrency, volCurrencyQuote, confirm]
 */

export type Candle = [string, string, string, string, string, string, string, string, string];

function parseFloatSafe(s: string): number {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function getCloses(candles: Candle[]): number[] {
  return candles.map((c) => parseFloatSafe(c[4])).filter((c) => c > 0);
}

/** SMA(period) of last `period` closes. */
export function sma(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  const slice = closes.slice(0, period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

/** EMA(period). First EMA = SMA of first `period` values, then EMA = alpha * close + (1-alpha) * prevEMA. */
export function ema(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  const alpha = 2 / (period + 1);
  let emaVal = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < closes.length; i++) {
    emaVal = alpha * closes[i] + (1 - alpha) * emaVal;
  }
  return emaVal;
}

/** RSI(period). RSI = 100 - (100 / (1 + RS)), RS = avg gain / avg loss (Wilder smoothing). */
export function rsi(closes: number[], period: number): number | null {
  if (closes.length < period + 1) return null;
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i - 1]! - closes[i]!;
    if (diff > 0) avgGain += diff;
    else avgLoss -= diff;
  }
  avgGain /= period;
  avgLoss /= period;
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i - 1]! - closes[i]!;
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/** Local swing highs/lows over a window to derive support and resistance. */
export function findSupportResistance(candles: Candle[], lookback = 10): { support: number[]; resistance: number[] } {
  const highs = candles.map((c) => parseFloatSafe(c[2]));
  const lows = candles.map((c) => parseFloatSafe(c[3]));
  const support: number[] = [];
  const resistance: number[] = [];
  const half = Math.floor(lookback / 2);
  for (let i = half; i < candles.length - half; i++) {
    const windowLow = Math.min(...lows.slice(i - half, i + half + 1));
    const windowHigh = Math.max(...highs.slice(i - half, i + half + 1));
    if (lows[i] === windowLow && windowLow > 0) support.push(windowLow);
    if (highs[i] === windowHigh && windowHigh > 0) resistance.push(windowHigh);
  }
  return { support: [...new Set(support)].sort((a, b) => a - b), resistance: [...new Set(resistance)].sort((a, b) => b - a) };
}

/** MA crossover: true = fast crossed above slow (bullish), false = crossed below (bearish), null = no cross. */
export function maCrossoverSignal(
  closes: number[],
  fastPeriod: number,
  slowPeriod: number
): "long" | "short" | null {
  if (closes.length < slowPeriod + 2) return null;
  const fastPrev = sma(closes.slice(1), fastPeriod);
  const fastCur = sma(closes, fastPeriod);
  const slowPrev = sma(closes.slice(1), slowPeriod);
  const slowCur = sma(closes, slowPeriod);
  if (fastPrev == null || fastCur == null || slowPrev == null || slowCur == null) return null;
  if (fastPrev <= slowPrev && fastCur > slowCur) return "long";
  if (fastPrev >= slowPrev && fastCur < slowCur) return "short";
  return null;
}

/** Candle rules: bullish engulfing (last candle), bearish engulfing. */
export function candlePatternSignal(candles: Candle[]): "long" | "short" | null {
  if (candles.length < 2) return null;
  const last = candles[0]!;
  const prev = candles[1]!;
  const o0 = parseFloatSafe(last[1]);
  const c0 = parseFloatSafe(last[4]);
  const o1 = parseFloatSafe(prev[1]);
  const c1 = parseFloatSafe(prev[4]);
  const body0 = Math.abs(c0 - o0);
  const body1 = Math.abs(c1 - o1);
  if (body1 < 1e-12) return null;
  if (c0 > o0 && c1 < o1 && c0 > o1 && o0 < c1 && body0 > body1 * 1.2) return "long";
  if (c0 < o0 && c1 > o1 && c0 < o1 && o0 > c1 && body0 > body1 * 1.2) return "short";
  return null;
}

export type IndicatorsSignalOptions = {
  emaPeriod?: number;
  fastMA?: number;
  slowMA?: number;
  rsiPeriod?: number;
  rsiOversold?: number;
  rsiOverbought?: number;
  priceAboveEmaBullish?: boolean;
  requireConfluence?: boolean;
};

/**
 * Combined indicators signal: EMA200, MA crossover, RSI, S/R proximity, candle pattern.
 * Returns "long" | "short" | null and a score 0-100 (confidence).
 */
export function indicatorsSignal(
  candles: Candle[],
  currentPrice: number,
  options: IndicatorsSignalOptions = {}
): { signal: "long" | "short" | null; score: number; reasons: string[] } {
  const {
    emaPeriod = 200,
    fastMA = 9,
    slowMA = 21,
    rsiPeriod = 14,
    rsiOversold = 30,
    rsiOverbought = 70,
    priceAboveEmaBullish = true,
    requireConfluence = true,
  } = options;

  const closes = getCloses(candles);
  const reasons: string[] = [];
  let longScore = 0;
  let shortScore = 0;

  if (closes.length < Math.max(emaPeriod, slowMA) + 5) {
    return { signal: null, score: 0, reasons: ["Not enough data for indicators"] };
  }

  const emaVal = ema(closes, emaPeriod);
  if (emaVal != null) {
    if (currentPrice > emaVal) {
      longScore += 25;
      reasons.push(`Price above EMA(${emaPeriod})`);
    } else {
      shortScore += 25;
      reasons.push(`Price below EMA(${emaPeriod})`);
    }
  }

  const maCross = maCrossoverSignal(closes, fastMA, slowMA);
  if (maCross === "long") {
    longScore += 30;
    reasons.push(`MA(${fastMA}) crossed above MA(${slowMA})`);
  } else if (maCross === "short") {
    shortScore += 30;
    reasons.push(`MA(${fastMA}) crossed below MA(${slowMA})`);
  }

  const rsiVal = rsi(closes, rsiPeriod);
  if (rsiVal != null) {
    if (rsiVal <= rsiOversold) {
      longScore += 20;
      reasons.push(`RSI(${rsiPeriod})=${rsiVal.toFixed(0)} oversold`);
    } else if (rsiVal >= rsiOverbought) {
      shortScore += 20;
      reasons.push(`RSI(${rsiPeriod})=${rsiVal.toFixed(0)} overbought`);
    } else if (rsiVal > 50) {
      longScore += 5;
      reasons.push(`RSI=${rsiVal.toFixed(0)} bullish zone`);
    } else {
      shortScore += 5;
      reasons.push(`RSI=${rsiVal.toFixed(0)} bearish zone`);
    }
  }

  const { support, resistance } = findSupportResistance(candles, 8);
  const nearSupport = support.some((s) => Math.abs(currentPrice - s) / currentPrice < 0.005);
  const nearResistance = resistance.some((r) => Math.abs(currentPrice - r) / currentPrice < 0.005);
  if (nearSupport) {
    longScore += 15;
    reasons.push("Price near support");
  }
  if (nearResistance) {
    shortScore += 15;
    reasons.push("Price near resistance");
  }

  const candleSig = candlePatternSignal(candles);
  if (candleSig === "long") {
    longScore += 10;
    reasons.push("Bullish engulfing");
  } else if (candleSig === "short") {
    shortScore += 10;
    reasons.push("Bearish engulfing");
  }

  const minConfluence = 40;
  if (requireConfluence) {
    if (longScore >= minConfluence && longScore > shortScore) {
      return { signal: "long", score: Math.min(100, longScore), reasons };
    }
    if (shortScore >= minConfluence && shortScore > longScore) {
      return { signal: "short", score: Math.min(100, shortScore), reasons };
    }
    return { signal: null, score: Math.max(longScore, shortScore), reasons };
  }
  if (longScore > shortScore && longScore >= 30) return { signal: "long", score: Math.min(100, longScore), reasons };
  if (shortScore > longScore && shortScore >= 30) return { signal: "short", score: Math.min(100, shortScore), reasons };
  return { signal: null, score: Math.max(longScore, shortScore), reasons };
}
