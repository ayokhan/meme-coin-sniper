/**
 * Pivot points — Floor, Woodie, Camarilla, DeMark, Fibonacci (BabyPips set).
 * Use previous completed period OHLC. Not a trade signal.
 */

export type PivotMethod = "floor" | "woodie" | "camarilla" | "demark" | "fibonacci";

export type PivotOhlc = {
  open: number;
  high: number;
  low: number;
  close: number;
  ts?: string | null;
};

export type PivotLevels = {
  method: PivotMethod;
  label: string;
  pp: number | null;
  r1: number | null;
  r2: number | null;
  r3: number | null;
  r4: number | null;
  s1: number | null;
  s2: number | null;
  s3: number | null;
  s4: number | null;
};

export const PIVOT_METHODS: Array<{ id: PivotMethod; label: string }> = [
  { id: "floor", label: "Floor" },
  { id: "woodie", label: "Woodie" },
  { id: "camarilla", label: "Camarilla" },
  { id: "demark", label: "DeMark" },
  { id: "fibonacci", label: "Fibonacci" },
];

function ok(n: number): number | null {
  return Number.isFinite(n) && n > 0 ? n : null;
}

function floorPivots(h: number, l: number, c: number): PivotLevels {
  const pp = (h + l + c) / 3;
  const range = h - l;
  return {
    method: "floor",
    label: "Floor",
    pp,
    r1: 2 * pp - l,
    s1: 2 * pp - h,
    r2: pp + range,
    s2: pp - range,
    r3: h + 2 * (pp - l),
    s3: l - 2 * (h - pp),
    r4: h + 3 * (pp - l),
    s4: l - 3 * (h - pp),
  };
}

function woodiePivots(h: number, l: number, c: number): PivotLevels {
  const pp = (h + l + 2 * c) / 4;
  return {
    method: "woodie",
    label: "Woodie",
    pp,
    r1: 2 * pp - l,
    s1: 2 * pp - h,
    r2: pp + h - l,
    s2: pp - h + l,
    r3: null,
    s3: null,
    r4: null,
    s4: null,
  };
}

function camarillaPivots(h: number, l: number, c: number): PivotLevels {
  const range = h - l;
  return {
    method: "camarilla",
    label: "Camarilla",
    pp: (h + l + c) / 3,
    r1: c + (range * 1.1) / 12,
    r2: c + (range * 1.1) / 6,
    r3: c + (range * 1.1) / 4,
    r4: c + (range * 1.1) / 2,
    s1: c - (range * 1.1) / 12,
    s2: c - (range * 1.1) / 6,
    s3: c - (range * 1.1) / 4,
    s4: c - (range * 1.1) / 2,
  };
}

function demarkPivots(o: number, h: number, l: number, c: number): PivotLevels {
  let x: number;
  if (c < o) x = h + 2 * l + c;
  else if (c > o) x = 2 * h + l + c;
  else x = h + l + 2 * c;
  return {
    method: "demark",
    label: "DeMark",
    pp: x / 4,
    r1: x / 2 - l,
    s1: x / 2 - h,
    r2: null,
    s2: null,
    r3: null,
    s3: null,
    r4: null,
    s4: null,
  };
}

function fibonacciPivots(h: number, l: number, c: number): PivotLevels {
  const pp = (h + l + c) / 3;
  const range = h - l;
  return {
    method: "fibonacci",
    label: "Fibonacci",
    pp,
    r1: pp + range * 0.382,
    r2: pp + range * 0.618,
    r3: pp + range * 1.0,
    r4: pp + range * 1.618,
    s1: pp - range * 0.382,
    s2: pp - range * 0.618,
    s3: pp - range * 1.0,
    s4: pp - range * 1.618,
  };
}

export function computeAllPivots(ohlc: PivotOhlc): PivotLevels[] {
  const { open: o, high: h, low: l, close: c } = ohlc;
  if (!(h > 0) || !(l > 0) || !(c > 0) || h < l) return [];
  return [floorPivots(h, l, c), woodiePivots(h, l, c), camarillaPivots(h, l, c), demarkPivots(o > 0 ? o : c, h, l, c), fibonacciPivots(h, l, c)].map(
    (row) => ({
      ...row,
      pp: ok(row.pp ?? NaN),
      r1: ok(row.r1 ?? NaN),
      r2: ok(row.r2 ?? NaN),
      r3: ok(row.r3 ?? NaN),
      r4: ok(row.r4 ?? NaN),
      s1: ok(row.s1 ?? NaN),
      s2: ok(row.s2 ?? NaN),
      s3: ok(row.s3 ?? NaN),
      s4: ok(row.s4 ?? NaN),
    })
  );
}

/** Floor R1/S1 as a first ticket: long TP=R1 SL=S1 (flipped for short) when they sit on the correct side of entry. */
export function floorTicketFromPivots(
  side: "long" | "short",
  entry: number,
  floor: PivotLevels | undefined
): { takeProfit: number | null; stopLoss: number | null } {
  if (!floor || !(entry > 0)) return { takeProfit: null, stopLoss: null };
  if (side === "long") {
    return {
      takeProfit: floor.r1 != null && floor.r1 > entry ? floor.r1 : floor.r2 != null && floor.r2 > entry ? floor.r2 : null,
      stopLoss: floor.s1 != null && floor.s1 < entry ? floor.s1 : floor.s2 != null && floor.s2 < entry ? floor.s2 : null,
    };
  }
  return {
    takeProfit: floor.s1 != null && floor.s1 < entry ? floor.s1 : floor.s2 != null && floor.s2 < entry ? floor.s2 : null,
    stopLoss: floor.r1 != null && floor.r1 > entry ? floor.r1 : floor.r2 != null && floor.r2 > entry ? floor.r2 : null,
  };
}

export type AccountGainLoss = {
  startBalance: number;
  signedUsd: number;
  currentBalance: number;
  pctOfStart: number;
  /** After a loss: % gain on remaining equity to get back to start. */
  recoveryPct: number | null;
  /** After a gain: % you can lose from the new balance before back to start. */
  affordToLosePct: number | null;
};

export function accountGainLoss(startBalance: number, signedUsd: number): AccountGainLoss | null {
  if (!(startBalance > 0) || !Number.isFinite(signedUsd)) return null;
  const current = startBalance + signedUsd;
  const pctOfStart = (signedUsd / startBalance) * 100;
  let recoveryPct: number | null = null;
  let affordToLosePct: number | null = null;
  if (signedUsd < 0 && current > 0) {
    recoveryPct = ((startBalance - current) / current) * 100;
  } else if (signedUsd > 0 && current > 0) {
    affordToLosePct = ((current - startBalance) / current) * 100;
  }
  return { startBalance, signedUsd, currentBalance: current, pctOfStart, recoveryPct, affordToLosePct };
}
