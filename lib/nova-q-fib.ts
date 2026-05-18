/**
 * NovaQ Fib — Fibonacci retracement layer (separate from NovaQ classic in nova-q-analytics).
 * Uses pivot swing high/low per window; does not modify NovaQ structure/trendline logic.
 */
import type { Candle } from "@/lib/demand-zone-fib-strategy";
import { calculateFibLevels, type FibLevels } from "@/lib/demand-zone-fib-strategy";
import { highLowFromCandles, type CandleTuple } from "@/lib/nova-q-analytics";

export const NOVA_Q_FIB_TIMEFRAMES = [
  { id: "5m", label: "5 mins", interval: "1m", limit: 5 },
  { id: "15m", label: "15 mins", interval: "1m", limit: 15 },
  { id: "30m", label: "30 mins", interval: "1m", limit: 30 },
  { id: "1h", label: "1 hour", interval: "1m", limit: 60 },
  { id: "2h", label: "2 hours", interval: "5m", limit: 24 },
  { id: "4h", label: "4 hours", interval: "5m", limit: 48 },
  { id: "6h", label: "6 hours", interval: "15m", limit: 24 },
  { id: "12h", label: "12 hours", interval: "15m", limit: 48 },
  { id: "24h", label: "24 hours", interval: "1h", limit: 24 },
  { id: "48h", label: "48 hours", interval: "1h", limit: 48 },
  { id: "1w", label: "1 week", interval: "1d", limit: 7 },
  { id: "2w", label: "2 weeks", interval: "1d", limit: 14 },
  { id: "4w", label: "4 weeks", interval: "1d", limit: 28 },
] as const;

export type NovaQFibTfId = (typeof NOVA_Q_FIB_TIMEFRAMES)[number]["id"];

export type FibLevelRow = {
  key: string;
  pct: number;
  price: number;
};

export type NovaQFibTimeframeResult = {
  id: string;
  label: string;
  swingHigh: number;
  swingLow: number;
  swingLeg: "up" | "down";
  periodSupport: number;
  periodResistance: number;
  retracementPct: number | null;
  nearestFibLabel: string;
  zoneRead: string;
  fibBias: "bullish_pullback" | "bearish_pullback" | "extended" | "breakdown_risk" | "neutral";
  levels: FibLevelRow[];
};

export type NovaQFibResult = {
  symbol: string;
  currentPrice: number | null;
  contractDescription: string;
  overallFibBias: "bullish_pullback" | "bearish_pullback" | "extended" | "breakdown_risk" | "neutral" | "mixed";
  overallRead: string;
  timeframes: NovaQFibTimeframeResult[];
};

/** HL/Blofin tuples are newest-first; convert to chronological candles. */
export function candleTuplesToCandles(rows: CandleTuple[]): Candle[] {
  return [...rows]
    .reverse()
    .map((c) => ({
      time: Number(c[0]) || 0,
      open: Number(c[1]),
      high: Number(c[2]),
      low: Number(c[3]),
      close: Number(c[4]),
    }))
    .filter((c) => Number.isFinite(c.close) && c.close > 0);
}

function findRecentSwingAnchors(
  candles: Candle[],
  pivotStrength = 2
): { swingHigh: number; swingLow: number; highIndex: number; lowIndex: number } | null {
  if (candles.length < pivotStrength * 2 + 3) return null;

  const pivotHighs: { price: number; index: number }[] = [];
  const pivotLows: { price: number; index: number }[] = [];

  for (let i = pivotStrength; i < candles.length - pivotStrength; i++) {
    const current = candles[i]!;
    const isPivotHigh =
      candles.slice(i - pivotStrength, i).every((c) => c.high <= current.high) &&
      candles.slice(i + 1, i + pivotStrength + 1).every((c) => c.high <= current.high);
    const isPivotLow =
      candles.slice(i - pivotStrength, i).every((c) => c.low >= current.low) &&
      candles.slice(i + 1, i + pivotStrength + 1).every((c) => c.low >= current.low);
    if (isPivotHigh) pivotHighs.push({ price: current.high, index: i });
    if (isPivotLow) pivotLows.push({ price: current.low, index: i });
  }

  if (pivotHighs.length === 0 || pivotLows.length === 0) {
    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);
    return {
      swingHigh: Math.max(...highs),
      swingLow: Math.min(...lows),
      highIndex: highs.indexOf(Math.max(...highs)),
      lowIndex: lows.indexOf(Math.min(...lows)),
    };
  }

  const lastHigh = pivotHighs[pivotHighs.length - 1]!;
  const lastLow = pivotLows[pivotLows.length - 1]!;
  return {
    swingHigh: lastHigh.price,
    swingLow: lastLow.price,
    highIndex: lastHigh.index,
    lowIndex: lastLow.index,
  };
}

function fibLevelsToRows(fibs: FibLevels): FibLevelRow[] {
  return [
    { key: "0%", pct: 0, price: fibs.level_0 },
    { key: "23.6%", pct: 23.6, price: fibs.level_236 },
    { key: "38.2%", pct: 38.2, price: fibs.level_382 },
    { key: "50%", pct: 50, price: fibs.level_500 },
    { key: "61.8%", pct: 61.8, price: fibs.level_618 },
    { key: "78.6%", pct: 78.6, price: fibs.level_786 },
    { key: "88.6%", pct: 88.6, price: fibs.level_886 },
    { key: "100%", pct: 100, price: fibs.level_100 },
  ];
}

function nearestFibLabel(price: number, rows: FibLevelRow[]): string {
  let best = rows[0]!;
  let bestDist = Math.abs(price - best.price);
  for (const r of rows) {
    const d = Math.abs(price - r.price);
    if (d < bestDist) {
      bestDist = d;
      best = r;
    }
  }
  return best.key;
}

function classifyFibPosition(
  retracementPct: number,
  swingLeg: "up" | "down"
): { fibBias: NovaQFibTimeframeResult["fibBias"]; zoneRead: string } {
  if (swingLeg === "up") {
    if (retracementPct <= 12) {
      return {
        fibBias: "extended",
        zoneRead: "Price is near the swing high (shallow retrace)—extension / exhaustion risk on longs until deeper pullback.",
      };
    }
    if (retracementPct >= 88) {
      return {
        fibBias: "breakdown_risk",
        zoneRead: "Price is near the swing low (deep retrace)—trend leg may be resetting; wait for base or new swing.",
      };
    }
    if (retracementPct >= 61.8 && retracementPct <= 88.6) {
      return {
        fibBias: "bullish_pullback",
        zoneRead: "Deep Fib pocket (61.8–88.6%) after an up leg—classic long pullback zone if structure holds.",
      };
    }
    if (retracementPct >= 38.2 && retracementPct < 61.8) {
      return {
        fibBias: "bullish_pullback",
        zoneRead: "Mid retracement (38.2–61.8%)—healthy pullback in an up leg; watch confluence with period support.",
      };
    }
    if (retracementPct < 38.2) {
      return {
        fibBias: "neutral",
        zoneRead: "Shallow pullback (<38.2%)—may need more retrace before ideal long add.",
      };
    }
    return { fibBias: "neutral", zoneRead: "Mid-range vs Fib anchors." };
  }

  // Down leg: swing high before swing low — bounce retracement from low
  if (retracementPct <= 12) {
    return {
      fibBias: "breakdown_risk",
      zoneRead: "Price is near the swing low after a down leg—weak bounce / breakdown risk for shorts covering.",
    };
  }
  if (retracementPct >= 88) {
    return {
      fibBias: "extended",
      zoneRead: "Price has retraced most of the down leg (near prior high)—relief rally / short-covering zone.",
    };
  }
  if (retracementPct >= 50 && retracementPct <= 78.6) {
    return {
      fibBias: "bearish_pullback",
      zoneRead: "Bounce into 50–78.6% retrace of the down leg—potential short continuation zone if rejected.",
    };
  }
  if (retracementPct >= 38.2) {
    return {
      fibBias: "bearish_pullback",
      zoneRead: "38.2%+ retrace after down leg—watch period resistance for fade setups.",
    };
  }
  return { fibBias: "neutral", zoneRead: "Early bounce vs Fib—no clear pocket yet." };
}

export function analyzeNovaQFibTimeframe(
  candleRows: CandleTuple[],
  currentPrice: number | null,
  label: string,
  id: string
): NovaQFibTimeframeResult | null {
  const candles = candleTuplesToCandles(candleRows);
  if (candles.length < 8) return null;

  const anchors = findRecentSwingAnchors(candles);
  if (!anchors) return null;

  const { swingHigh, swingLow, highIndex, lowIndex } = anchors;
  if (!(swingHigh > swingLow)) return null;

  const fibs = calculateFibLevels(swingHigh, swingLow);
  const levels = fibLevelsToRows(fibs);
  const swingLeg: "up" | "down" = lowIndex < highIndex ? "up" : "down";

  const hl = highLowFromCandles(candleRows);
  const periodSupport = hl?.low ?? swingLow;
  const periodResistance = hl?.high ?? swingHigh;

  const price =
    currentPrice != null && Number.isFinite(currentPrice) && currentPrice > 0
      ? currentPrice
      : candles[candles.length - 1]!.close;

  const range = swingHigh - swingLow;
  const retracementPct = range > 0 ? ((swingHigh - price) / range) * 100 : null;
  const nearestFibLabelText = nearestFibLabel(price, levels);
  const { fibBias, zoneRead } =
    retracementPct != null
      ? classifyFibPosition(retracementPct, swingLeg)
      : { fibBias: "neutral" as const, zoneRead: "Could not place price in Fib range." };

  return {
    id,
    label,
    swingHigh,
    swingLow,
    swingLeg,
    periodSupport,
    periodResistance,
    retracementPct,
    nearestFibLabel: nearestFibLabelText,
    zoneRead,
    fibBias,
    levels,
  };
}

export function aggregateOverallFibBias(
  rows: NovaQFibTimeframeResult[]
): NovaQFibResult["overallFibBias"] {
  if (!rows.length) return "neutral";
  let bull = 0;
  let bear = 0;
  let ext = 0;
  let breakdown = 0;
  for (const r of rows) {
    if (r.fibBias === "bullish_pullback") bull += 1;
    if (r.fibBias === "bearish_pullback") bear += 1;
    if (r.fibBias === "extended") ext += 1;
    if (r.fibBias === "breakdown_risk") breakdown += 1;
  }
  const max = Math.max(bull, bear, ext, breakdown);
  const tied = [bull, bear, ext, breakdown].filter((n) => n === max).length > 1;
  if (tied) return "mixed";
  if (max === bull) return "bullish_pullback";
  if (max === bear) return "bearish_pullback";
  if (max === ext) return "extended";
  return "breakdown_risk";
}

export function buildOverallFibRead(bias: NovaQFibResult["overallFibBias"], rows: NovaQFibTimeframeResult[]): string {
  const legUp = rows.filter((r) => r.swingLeg === "up").length;
  const legDown = rows.length - legUp;
  const base =
    bias === "bullish_pullback"
      ? "Majority of frames show price in a constructive Fib pullback zone after an up leg."
      : bias === "bearish_pullback"
        ? "Majority of frames show price retracing a down leg into potential continuation-short zones."
        : bias === "extended"
          ? "Majority of frames show shallow retrace (near swing high)—caution chasing longs."
          : bias === "breakdown_risk"
            ? "Majority of frames show price near the swing low—leg may be resetting."
            : bias === "mixed"
              ? "Fib reads conflict across timeframes—use NovaQ classic for bias vote and treat Fib as context."
              : "Neutral Fib positioning across selected frames.";

  return `${base} Swing context: ${legUp} up-leg frame(s), ${legDown} down-leg frame(s). Compare with NovaQ tab for structure/trendline (no Fib there).`;
}
