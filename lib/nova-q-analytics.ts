/** NovaQ: structure + regression “trendline” + demand/supply touch heuristics (no chart drawing). */

export type CandleTuple = [string, string, string, string, string, ...string[]];

export type Dir3 = "bullish" | "bearish" | "sideways";
export type TrendlineBias = "up" | "down" | "flat";

export function highLowFromCandles(candles: CandleTuple[]): { high: number; low: number } | null {
  if (!candles.length) return null;
  const highs = candles.map((c) => Number(c[2])).filter((n) => Number.isFinite(n));
  const lows = candles.map((c) => Number(c[3])).filter((n) => Number.isFinite(n));
  if (highs.length === 0 || lows.length === 0) return null;
  return { high: Math.max(...highs), low: Math.min(...lows) };
}

/** Count candles that trade near period support (min low) / resistance (max high). */
export function countSupportResistanceTouches(
  candles: CandleTuple[],
  support: number,
  resistance: number
): { supportTouches: number; resistanceTouches: number } {
  if (!candles.length || !Number.isFinite(support) || !Number.isFinite(resistance)) {
    return { supportTouches: 0, resistanceTouches: 0 };
  }
  const range = resistance - support;
  const mid = (resistance + support) / 2;
  const tol = Math.min(Math.max(mid * 0.0008, range * 0.012, 1e-12), Math.max(range * 0.2, mid * 0.002));
  let supportTouches = 0;
  let resistanceTouches = 0;
  for (const c of candles) {
    const hi = Number(c[2]);
    const lo = Number(c[3]);
    if (!Number.isFinite(hi) || !Number.isFinite(lo)) continue;
    if (lo <= support + tol) supportTouches += 1;
    if (hi >= resistance - tol) resistanceTouches += 1;
  }
  return { supportTouches, resistanceTouches };
}

function touchTolerance(candles: CandleTuple[], levelA: number, levelB: number): number {
  const highs = candles.map((c) => Number(c[2])).filter((n) => Number.isFinite(n));
  const lows = candles.map((c) => Number(c[3])).filter((n) => Number.isFinite(n));
  if (!highs.length || !lows.length) return 1e-12;
  const range = Math.max(...highs) - Math.min(...lows);
  const mid = (levelA + levelB) / 2;
  return Math.min(Math.max(mid * 0.0008, range * 0.012, 1e-12), Math.max(range * 0.2, mid * 0.002));
}

/** Count candles that traded near entry / exit targets in the window (Nova Scalp). */
export function countEntryExitTouches(
  candles: CandleTuple[],
  entry: number,
  exit: number,
  side: "long" | "short"
): { entryTouches: number; exitTouches: number } {
  if (!candles.length || !Number.isFinite(entry) || !Number.isFinite(exit)) {
    return { entryTouches: 0, exitTouches: 0 };
  }
  const tol = touchTolerance(candles, entry, exit);
  let entryTouches = 0;
  let exitTouches = 0;
  for (const c of candles) {
    const hi = Number(c[2]);
    const lo = Number(c[3]);
    if (!Number.isFinite(hi) || !Number.isFinite(lo)) continue;
    if (side === "long") {
      if (lo <= entry + tol) entryTouches += 1;
      if (hi >= exit - tol) exitTouches += 1;
    } else {
      if (hi >= entry - tol) entryTouches += 1;
      if (lo <= exit + tol) exitTouches += 1;
    }
  }
  return { entryTouches, exitTouches };
}

function linReg(xs: number[], ys: number[]): { m: number; b: number } {
  const n = xs.length;
  if (n < 2) return { m: 0, b: ys[0] ?? 0 };
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  if (den === 0) return { m: 0, b: my };
  const m = num / den;
  const b = my - m * mx;
  return { m, b };
}

/** Same half-window close average logic as legacy NovaQ. */
export function structureDirectionFromCloses(candles: CandleTuple[]): Dir3 {
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

/** Least-squares line through chronological closes — “trendline” proxy, not hand-drawn diagonals. */
export function trendlineRegressionFromCloses(candles: CandleTuple[]): {
  bias: TrendlineBias;
  slopePctWindow: number;
  closeVsLinePct: number;
  read: string;
} | null {
  const closesChrono = [...candles].reverse().map((c) => Number(c[4])).filter((n) => Number.isFinite(n));
  if (closesChrono.length < 5) return null;
  const n = closesChrono.length;
  const xs = closesChrono.map((_, i) => i);
  const { m, b } = linReg(xs, closesChrono);
  const y0 = b;
  const y1 = m * (n - 1) + b;
  const denom = Math.max(Math.abs(y0), 1e-12);
  const slopePctWindow = ((y1 - y0) / denom) * 100;
  const lastClose = closesChrono[n - 1]!;
  const lineAtLast = m * (n - 1) + b;
  const closeVsLinePct = Math.abs(lineAtLast) > 1e-12 ? ((lastClose - lineAtLast) / Math.abs(lineAtLast)) * 100 : 0;

  const flatThresh = n < 12 ? 0.045 : 0.028;
  let bias: TrendlineBias = "flat";
  if (slopePctWindow > flatThresh) bias = "up";
  else if (slopePctWindow < -flatThresh) bias = "down";

  const read =
    bias === "up"
      ? `Close regression slopes up (~${slopePctWindow.toFixed(2)}% over window); last close ${closeVsLinePct >= 0 ? "above" : "below"} the line by ~${Math.abs(closeVsLinePct).toFixed(2)}% (trendline-style read, not a drawn chart line).`
      : bias === "down"
        ? `Close regression slopes down (~${Math.abs(slopePctWindow).toFixed(2)}% over window); last close ${closeVsLinePct >= 0 ? "above" : "below"} the line by ~${Math.abs(closeVsLinePct).toFixed(2)}%.`
        : `Close regression is nearly flat (~${Math.abs(slopePctWindow).toFixed(3)}% drift); treat as range unless S/R breaks.`;

  return { bias, slopePctWindow, closeVsLinePct, read };
}

export function demandSupplyRead(
  support: number,
  resistance: number,
  supportTouches: number,
  resistanceTouches: number
): string {
  const s = Number(support);
  const r = Number(resistance);
  const band = Number.isFinite(s) && Number.isFinite(r) && r > s ? r - s : 0;
  const mid = Number.isFinite(s) && Number.isFinite(r) ? (r + s) / 2 : 0;
  const bandLabel =
    band > 0 && mid > 0 ? `Window range ≈ ${((band / mid) * 100).toFixed(2)}% of mid.` : "";
  return `Demand proxy: lows near period support retested ~${supportTouches}×; supply proxy: highs near resistance retested ~${resistanceTouches}×. ${bandLabel} Heuristic only—not full order-book depth.`.trim();
}

/** When structure and regression disagree, bias to sideways (chop risk). */
export function combineStructureAndTrendline(struct: Dir3, trend: TrendlineBias | null): Dir3 {
  if (!trend || trend === "flat") return struct;
  const up = trend === "up";
  const down = trend === "down";
  if (up && struct === "bullish") return "bullish";
  if (down && struct === "bearish") return "bearish";
  if (up && struct === "bearish") return "sideways";
  if (down && struct === "bullish") return "sideways";
  if (struct === "sideways") return up ? "bullish" : down ? "bearish" : "sideways";
  return struct;
}

export function overallTrendlineSummary(rows: Array<{ trendlineBias: TrendlineBias }>): string {
  if (!rows.length) return "";
  const up = rows.filter((r) => r.trendlineBias === "up").length;
  const down = rows.filter((r) => r.trendlineBias === "down").length;
  const flat = rows.length - up - down;
  if (up > down && up >= flat) return `Trendline (close regression): rising in ${up} of ${rows.length} selected frame(s).`;
  if (down > up && down >= flat) return `Trendline (close regression): falling in ${down} of ${rows.length} selected frame(s).`;
  return `Trendline (close regression): mixed—${up} up, ${down} down, ${flat} flat across selected frames.`;
}
