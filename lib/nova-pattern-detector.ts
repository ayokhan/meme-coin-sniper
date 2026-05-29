/**
 * Nova Pattern Detector v2 — behavioral / calendar edges (day-of-week, 48h cycles, weekly rhythm).
 * Distinct from NovaQ (S/R levels) and Nova Extra (hour-of-day seasonality).
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
import { isValidNovaExtraTimezone } from "@/lib/nova-extra";

type CandleTuple = [string, string, string, string, string, string, string, string, string];

export const NOVA_PATTERN_LOOKBACK_OPTIONS: { id: string; label: string; hours: number }[] = [
  { id: "48h", label: "48 hours", hours: 48 },
  { id: "72h", label: "72 hours", hours: 72 },
  { id: "1w", label: "1 week", hours: 7 * 24 },
  { id: "2w", label: "2 weeks", hours: 14 * 24 },
  { id: "4w", label: "4 weeks", hours: 4 * 7 * 24 },
  { id: "6w", label: "6 weeks", hours: 6 * 7 * 24 },
  { id: "8w", label: "8 weeks", hours: 8 * 7 * 24 },
  { id: "12w", label: "12 weeks", hours: 12 * 7 * 24 },
];

/** Day-of-week stats need ~1 sample per weekday; shorter windows are best for 48h-cycle focus. */
export function isShortPatternLookback(hours: number): boolean {
  return hours < 14 * 24;
}

export const NOVA_PATTERN_TYPE_OPTIONS: { id: NovaPatternTypeId; label: string }[] = [
  { id: "playbook", label: "Full playbook (all patterns)" },
  { id: "day_of_week", label: "Day of week" },
  { id: "cycle_48h", label: "48-hour cycle" },
  { id: "weekly_rhythm", label: "Weekly rhythm" },
];

export type NovaPatternTypeId = "playbook" | "day_of_week" | "cycle_48h" | "weekly_rhythm";

const WEEKDAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

export type NovaPatternWeekdaySample = {
  ts: number;
  dateLabel: string;
  open: number;
  high: number;
  low: number;
  close: number;
  returnPct: number;
  rangePct: number;
  moveLabel: string;
};

export type NovaPatternWeekdayRow = {
  dayIndex: number;
  label: string;
  avgReturnPct: number;
  winRatePct: number;
  avgRangePct: number;
  typicalRangeLabel: string;
  samples: number;
  bias: "long" | "short" | "neutral";
  strength: "strong" | "moderate" | "weak";
  /** Calendar dates in the lookback that fell on this weekday (newest first). */
  sampleDetails: NovaPatternWeekdaySample[];
};

export type NovaPlaybookTradeIdea = {
  style: "scalp" | "swing";
  side: "long" | "short";
  biasDay: string;
  timing: string;
  entry: string;
  entryPrice: number;
  takeProfit: string;
  takeProfitPrice: number;
  stopLoss: string;
  stopLossPrice: number;
  rationale: string;
  confidence: "low" | "medium" | "high";
};

export type NovaPattern48hCycleStats = {
  rallyThresholdPct: number;
  samplesAfterRally: number;
  samplesAfterDrop: number;
  afterRallyNext48hAvgPct: number;
  afterRallyRetraceRatePct: number;
  afterDropNext48hAvgPct: number;
  afterDropBounceRatePct: number;
  median48hReturnPct: number;
  total48hWindows: number;
};

export type NovaPatternWeeklyRhythmRow = {
  id: string;
  label: string;
  description: string;
  samples: number;
  hitRatePct: number;
  avgFollowThroughPct: number | null;
};

export type NovaPatternResult = {
  symbol: string;
  dataSource: string;
  contractNote: string;
  lookbackId: string;
  lookbackLabel: string;
  patternTypeId: NovaPatternTypeId;
  patternTypeLabel: string;
  timezone: string;
  timezoneLabel: string;
  currentPrice: number | null;
  traderBrief: string;
  playbookHeadline: string;
  dayOfWeek: NovaPatternWeekdayRow[];
  bestLongDay: NovaPatternWeekdayRow | null;
  bestShortDay: NovaPatternWeekdayRow | null;
  cycle48h: NovaPattern48hCycleStats | null;
  weeklyRhythm: NovaPatternWeeklyRhythmRow[];
  tradeIdeas: NovaPlaybookTradeIdea[];
  howToUse: string[];
  lookbackWarning: string | null;
  observations: string[];
  disclaimer: string;
};

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function classifyStrength(avgReturnPct: number, winRatePct: number): NovaPatternWeekdayRow["strength"] {
  const edge = Math.abs(avgReturnPct);
  const wrEdge = Math.abs(winRatePct - 50);
  if (edge >= 0.12 && wrEdge >= 12) return "strong";
  if (edge >= 0.04 && wrEdge >= 6) return "moderate";
  return "weak";
}

function classifyBias(avgReturnPct: number, winRatePct: number): NovaPatternWeekdayRow["bias"] {
  if (avgReturnPct >= 0.03 && winRatePct >= 52) return "long";
  if (avgReturnPct <= -0.03 && winRatePct <= 48) return "short";
  return "neutral";
}

function timezoneShortName(timeZone: string): string {
  try {
    return (
      new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" })
        .formatToParts(new Date())
        .find((p) => p.type === "timeZoneName")?.value ?? timeZone
    );
  } catch {
    return timeZone;
  }
}

export function getLocalWeekdayIndex(ts: number, timeZone: string): number {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(new Date(ts));
  const map: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  return map[wd] ?? 0;
}

function formatWeekdayDateLabel(ts: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(ts));
}

function buildMoveLabel(open: number, close: number): string {
  return `${formatQuotePriceUsd(open)} → ${formatQuotePriceUsd(close)}`;
}

function getIsoWeekKey(ts: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(ts));
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const d = Number(parts.find((p) => p.type === "day")?.value);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
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

/** Oldest → newest. */
function sortCandlesAsc(candles: CandleTuple[]): CandleTuple[] {
  return [...candles].sort((a, b) => Number(a[0]) - Number(b[0]));
}

function analyzeDayOfWeek(
  dailyCandles: CandleTuple[],
  timeZone: string,
  cutoffTs: number
): NovaPatternWeekdayRow[] {
  const buckets: NovaPatternWeekdaySample[][] = Array.from({ length: 7 }, () => []);

  for (const c of dailyCandles) {
    const ts = Number(c[0]);
    if (!Number.isFinite(ts) || ts < cutoffTs) continue;
    const o = Number(c[1]);
    const hi = Number(c[2]);
    const lo = Number(c[3]);
    const cl = Number(c[4]);
    if (!Number.isFinite(o) || !Number.isFinite(cl) || o <= 0) continue;
    const ret = ((cl - o) / o) * 100;
    const rangePct =
      Number.isFinite(hi) && Number.isFinite(lo) && hi >= lo && o > 0 ? ((hi - lo) / o) * 100 : Math.abs(ret);
    const day = getLocalWeekdayIndex(ts, timeZone);
    buckets[day].push({
      ts,
      dateLabel: formatWeekdayDateLabel(ts, timeZone),
      open: o,
      high: Number.isFinite(hi) ? hi : Math.max(o, cl),
      low: Number.isFinite(lo) ? lo : Math.min(o, cl),
      close: cl,
      returnPct: Math.round(ret * 100) / 100,
      rangePct: Math.round(rangePct * 100) / 100,
      moveLabel: buildMoveLabel(o, cl),
    });
  }

  return WEEKDAY_LABELS.map((label, dayIndex) => {
    const details = [...buckets[dayIndex]].sort((a, b) => b.ts - a.ts);
    const returns = details.map((d) => d.returnPct);
    const ranges = details.map((d) => d.rangePct);
    const samples = returns.length;
    const avgReturnPct = samples > 0 ? avg(returns) : 0;
    const avgRangePct = samples > 0 ? avg(ranges) : 0;
    const winRatePct = samples > 0 ? (returns.filter((r) => r > 0).length / samples) * 100 : 50;
    const bias = classifyBias(avgReturnPct, winRatePct);
    const rawStrength = classifyStrength(avgReturnPct, winRatePct);
    const strength = samples < 3 ? "weak" : rawStrength;
    const typicalRangeLabel =
      samples > 0 ? `Avg H–L ${(Math.round(avgRangePct * 100) / 100).toFixed(2)}% of open` : "—";
    return {
      dayIndex,
      label,
      avgReturnPct: Math.round(avgReturnPct * 100) / 100,
      winRatePct: Math.round(winRatePct * 10) / 10,
      avgRangePct: Math.round(avgRangePct * 100) / 100,
      typicalRangeLabel,
      samples,
      bias,
      strength,
      sampleDetails: details,
    };
  });
}

function pickBestDays(rows: NovaPatternWeekdayRow[]): {
  bestLongDay: NovaPatternWeekdayRow | null;
  bestShortDay: NovaPatternWeekdayRow | null;
} {
  const withSamples = rows.filter((r) => r.samples >= 3);
  const longCandidates = withSamples.filter((r) => r.bias === "long").sort((a, b) => b.avgReturnPct - a.avgReturnPct);
  const shortCandidates = withSamples.filter((r) => r.bias === "short").sort((a, b) => a.avgReturnPct - b.avgReturnPct);
  return {
    bestLongDay: longCandidates[0] ?? null,
    bestShortDay: shortCandidates[0] ?? null,
  };
}

function analyze48hCycles(hourlyCandles: CandleTuple[], cutoffTs: number): NovaPattern48hCycleStats | null {
  const sorted = sortCandlesAsc(hourlyCandles).filter((c) => Number(c[0]) >= cutoffTs);
  if (sorted.length < 96) return null;

  const windowReturns: number[] = [];
  for (let i = 0; i + 47 < sorted.length; i += 48) {
    const o = Number(sorted[i][1]);
    const cl = Number(sorted[i + 47][4]);
    if (!Number.isFinite(o) || !Number.isFinite(cl) || o <= 0) continue;
    windowReturns.push(((cl - o) / o) * 100);
  }
  if (windowReturns.length < 3) return null;

  const rallyThresholdPct = 0.35;
  const afterRallyNext: number[] = [];
  const afterDropNext: number[] = [];

  for (let i = 0; i < windowReturns.length - 1; i++) {
    const cur = windowReturns[i];
    const next = windowReturns[i + 1];
    if (cur >= rallyThresholdPct) afterRallyNext.push(next);
    if (cur <= -rallyThresholdPct) afterDropNext.push(next);
  }

  const median48h =
    [...windowReturns].sort((a, b) => a - b)[Math.floor(windowReturns.length / 2)] ?? 0;

  return {
    rallyThresholdPct,
    samplesAfterRally: afterRallyNext.length,
    samplesAfterDrop: afterDropNext.length,
    afterRallyNext48hAvgPct: afterRallyNext.length ? Math.round(avg(afterRallyNext) * 100) / 100 : 0,
    afterRallyRetraceRatePct: afterRallyNext.length
      ? Math.round((afterRallyNext.filter((r) => r < 0).length / afterRallyNext.length) * 1000) / 10
      : 0,
    afterDropNext48hAvgPct: afterDropNext.length ? Math.round(avg(afterDropNext) * 100) / 100 : 0,
    afterDropBounceRatePct: afterDropNext.length
      ? Math.round((afterDropNext.filter((r) => r > 0).length / afterDropNext.length) * 1000) / 10
      : 0,
    median48hReturnPct: Math.round(median48h * 100) / 100,
    total48hWindows: windowReturns.length,
  };
}

type DailyBar = { ts: number; open: number; close: number; weekday: number };

function buildDailyBars(dailyCandles: CandleTuple[], timeZone: string, cutoffTs: number): DailyBar[] {
  return sortCandlesAsc(dailyCandles)
    .map((c) => {
      const ts = Number(c[0]);
      const open = Number(c[1]);
      const close = Number(c[4]);
      if (!Number.isFinite(ts) || ts < cutoffTs || !Number.isFinite(open) || !Number.isFinite(close)) return null;
      return { ts, open, close, weekday: getLocalWeekdayIndex(ts, timeZone) };
    })
    .filter((b): b is DailyBar => b != null);
}

function analyzeWeeklyRhythm(
  dailyBars: DailyBar[],
  timeZone: string
): NovaPatternWeeklyRhythmRow[] {
  const byWeek = new Map<string, DailyBar[]>();
  for (const bar of dailyBars) {
    const key = getIsoWeekKey(bar.ts, timeZone);
    const list = byWeek.get(key) ?? [];
    list.push(bar);
    byWeek.set(key, list);
  }

  const rows: NovaPatternWeeklyRhythmRow[] = [];

  let monUpTueDown = 0;
  let monUpTueDownTotal = 0;
  let earlyUpLateFade = 0;
  let earlyUpLateFadeTotal = 0;
  let greenWeekAfterRedStart = 0;
  let greenWeekAfterRedStartTotal = 0;

  for (const bars of byWeek.values()) {
    if (bars.length < 4) continue;
    bars.sort((a, b) => a.ts - b.ts);

    const mon = bars.find((b) => b.weekday === 0);
    const tue = bars.find((b) => b.weekday === 1);
    if (mon && tue && mon.open > 0) {
      const monRet = ((mon.close - mon.open) / mon.open) * 100;
      const tueRet = ((tue.close - tue.open) / tue.open) * 100;
      if (monRet > 0.05) {
        monUpTueDownTotal++;
        if (tueRet < 0) monUpTueDown++;
      }
    }

    const early = bars.filter((b) => b.weekday <= 2);
    const late = bars.filter((b) => b.weekday >= 3);
    if (early.length >= 2 && late.length >= 1) {
      const earlyOpen = early[0].open;
      const earlyClose = early[early.length - 1].close;
      const weekOpen = bars[0].open;
      const weekClose = bars[bars.length - 1].close;
      if (earlyOpen > 0 && weekOpen > 0) {
        const earlyRet = ((earlyClose - earlyOpen) / earlyOpen) * 100;
        const weekRet = ((weekClose - weekOpen) / weekOpen) * 100;
        if (earlyRet > 0.2) {
          earlyUpLateFadeTotal++;
          if (weekRet < earlyRet * 0.5) earlyUpLateFade++;
        }
      }
    }

    const first = bars[0];
    const last = bars[bars.length - 1];
    if (first.open > 0) {
      const firstDayRet = ((first.close - first.open) / first.open) * 100;
      const weekRet = ((last.close - first.open) / first.open) * 100;
      if (firstDayRet < -0.1) {
        greenWeekAfterRedStartTotal++;
        if (weekRet > 0) greenWeekAfterRedStart++;
      }
    }
  }

  if (monUpTueDownTotal >= 3) {
    rows.push({
      id: "mon_up_tue_fade",
      label: "Monday up → Tuesday fade",
      description: "Weeks where Monday closed green, how often Tuesday closed red.",
      samples: monUpTueDownTotal,
      hitRatePct: Math.round((monUpTueDown / monUpTueDownTotal) * 1000) / 10,
      avgFollowThroughPct: null,
    });
  }

  if (earlyUpLateFadeTotal >= 3) {
    rows.push({
      id: "early_rally_late_fade",
      label: "Mon–Wed rally, week gives back",
      description: "When Mon–Wed gained >0.2%, full week return was less than half the early leg (fade).",
      samples: earlyUpLateFadeTotal,
      hitRatePct: Math.round((earlyUpLateFade / earlyUpLateFadeTotal) * 1000) / 10,
      avgFollowThroughPct: null,
    });
  }

  if (greenWeekAfterRedStartTotal >= 3) {
    rows.push({
      id: "red_monday_green_week",
      label: "Red Monday → green week",
      description: "Weeks that opened weak on day one but finished the week positive.",
      samples: greenWeekAfterRedStartTotal,
      hitRatePct: Math.round((greenWeekAfterRedStart / greenWeekAfterRedStartTotal) * 1000) / 10,
      avgFollowThroughPct: null,
    });
  }

  return rows;
}

function buildTradeIdeas(params: {
  symbol: string;
  currentPrice: number;
  dayOfWeek: NovaPatternWeekdayRow[];
  bestLongDay: NovaPatternWeekdayRow | null;
  bestShortDay: NovaPatternWeekdayRow | null;
  cycle48h: NovaPattern48hCycleStats | null;
  tzLabel: string;
}): NovaPlaybookTradeIdea[] {
  const { symbol, currentPrice, dayOfWeek, bestLongDay, bestShortDay, cycle48h, tzLabel } = params;
  const ideas: NovaPlaybookTradeIdea[] = [];

  const longDay =
    bestLongDay ??
    [...dayOfWeek].filter((r) => r.bias === "long" && r.samples >= 1).sort((a, b) => b.avgReturnPct - a.avgReturnPct)[0] ??
    null;
  const shortDay =
    bestShortDay ??
    [...dayOfWeek].filter((r) => r.bias === "short" && r.samples >= 1).sort((a, b) => a.avgReturnPct - b.avgReturnPct)[0] ??
    null;

  function addPlan(row: NovaPatternWeekdayRow, side: "long" | "short", style: "scalp" | "swing") {
    if (row.samples < 1 || row.bias === "neutral") return;
    const conf: NovaPlaybookTradeIdea["confidence"] =
      row.samples >= 5 && row.strength !== "weak" ? "high" : row.samples >= 3 ? "medium" : "low";
    const ret = Math.max(0.08, Math.abs(row.avgReturnPct));
    const range = Math.max(0.25, row.avgRangePct || ret);
    const targetPct = style === "scalp" ? Math.min(1.2, ret * 0.55) : Math.min(2.8, ret * 1.15);
    const stopPct = style === "scalp" ? Math.max(0.22, range * 0.38) : Math.max(0.42, range * 0.55);

    const pullbackPct = style === "scalp" ? 0.06 : 0.12;
    let entryPrice: number;
    let takeProfitPrice: number;
    let stopLossPrice: number;

    if (side === "long") {
      entryPrice = currentPrice * (1 - pullbackPct / 100);
      takeProfitPrice = entryPrice * (1 + targetPct / 100);
      stopLossPrice = entryPrice * (1 - stopPct / 100);
    } else {
      entryPrice = currentPrice * (1 + pullbackPct / 100);
      takeProfitPrice = entryPrice * (1 - targetPct / 100);
      stopLossPrice = entryPrice * (1 + stopPct / 100);
    }

    const lastSample = row.sampleDetails[0];
    const dateHint = lastSample ? ` Last ${row.label} in sample: ${lastSample.dateLabel}.` : "";

    ideas.push({
      style,
      side,
      biasDay: row.label,
      timing: `Bias ${row.label} session (${tzLabel}) — plan before that day’s open; confirm on your Blofin chart.`,
      entry: formatQuotePriceUsd(entryPrice),
      entryPrice: Math.round(entryPrice * 100) / 100,
      takeProfit: formatQuotePriceUsd(takeProfitPrice),
      takeProfitPrice: Math.round(takeProfitPrice * 100) / 100,
      stopLoss: formatQuotePriceUsd(stopLossPrice),
      stopLossPrice: Math.round(stopLossPrice * 100) / 100,
      rationale: `${symbol} ${row.label}s averaged ${row.avgReturnPct >= 0 ? "+" : ""}${row.avgReturnPct}% over ${row.samples} sample(s); avg day range ${row.avgRangePct}%. Heuristic ${style} levels from spot — not a live order.${dateHint}`,
      confidence: conf,
    });
  }

  if (longDay) {
    addPlan(longDay, "long", "scalp");
    addPlan(longDay, "long", "swing");
  }
  if (shortDay) {
    addPlan(shortDay, "short", "scalp");
    addPlan(shortDay, "short", "swing");
  }

  if (cycle48h && cycle48h.samplesAfterRally >= 2 && cycle48h.afterRallyRetraceRatePct >= 55) {
    const stopPct = 0.35;
    const targetPct = 0.45;
    const entryPrice = currentPrice;
    ideas.push({
      style: "scalp",
      side: "short",
      biasDay: "48h fade",
      timing: `After a +${cycle48h.rallyThresholdPct}% or greater 48h rally (${tzLabel} candles).`,
      entry: formatQuotePriceUsd(entryPrice),
      entryPrice,
      takeProfit: formatQuotePriceUsd(entryPrice * (1 - targetPct / 100)),
      takeProfitPrice: Math.round(entryPrice * (1 - targetPct / 100) * 100) / 100,
      stopLoss: formatQuotePriceUsd(entryPrice * (1 + stopPct / 100)),
      stopLossPrice: Math.round(entryPrice * (1 + stopPct / 100) * 100) / 100,
      rationale: `Next 48h retraced ${cycle48h.afterRallyRetraceRatePct}% of the time after sharp rallies (n=${cycle48h.samplesAfterRally}). Mean-reversion scalp only.`,
      confidence: cycle48h.samplesAfterRally >= 5 ? "medium" : "low",
    });
  }

  return ideas.slice(0, 6);
}

function buildHowToUse(
  lookbackLabel: string,
  tzLabel: string,
  lookbackWarning: string | null
): string[] {
  const tips = [
    `Each row is a weekday label in ${tzLabel}, not “every future Monday.” The Sample dates column lists the actual calendar days in your ${lookbackLabel} window.`,
    "Use Avg % and Green % to see which sessions tended to rise or fall; use Avg H–L range for how far price typically swung that day.",
    "Suggested plans are heuristic entry / TP / SL from spot and historical averages — confirm with NovaQ, your chart, and risk size before trading.",
    "Prefer Learn from 4w+ for weekday stats; 1w only gives one date per weekday (n=1) and overstates “strong edge.”",
  ];
  if (lookbackWarning) tips.unshift(lookbackWarning);
  return tips;
}

function buildTraderBrief(params: {
  symbol: string;
  lookbackLabel: string;
  tzLabel: string;
  dayOfWeek: NovaPatternWeekdayRow[];
  bestLongDay: NovaPatternWeekdayRow | null;
  bestShortDay: NovaPatternWeekdayRow | null;
  cycle48h: NovaPattern48hCycleStats | null;
  weeklyRhythm: NovaPatternWeeklyRhythmRow[];
  currentPrice: number | null;
}): { traderBrief: string; playbookHeadline: string; observations: string[] } {
  const obs: string[] = [];
  const { symbol, lookbackLabel, tzLabel, dayOfWeek, bestLongDay, bestShortDay, cycle48h, weeklyRhythm, currentPrice } =
    params;

  if (bestLongDay) {
    obs.push(
      `${bestLongDay.label}s averaged ${bestLongDay.avgReturnPct >= 0 ? "+" : ""}${bestLongDay.avgReturnPct}% (${bestLongDay.winRatePct}% green days, n=${bestLongDay.samples}) in ${tzLabel}.`
    );
  }
  if (bestShortDay) {
    const downPct = Math.round(100 - bestShortDay.winRatePct);
    obs.push(
      `${bestShortDay.label}s averaged ${bestShortDay.avgReturnPct}% (${downPct}% red days, n=${bestShortDay.samples}) — lean short or take profit into that session.`
    );
  }

  if (cycle48h && cycle48h.samplesAfterRally >= 2) {
    obs.push(
      `After a +${cycle48h.rallyThresholdPct}% (or more) 48h rally, the next 48h averaged ${cycle48h.afterRallyNext48hAvgPct}% with a ${cycle48h.afterRallyRetraceRatePct}% retrace rate (n=${cycle48h.samplesAfterRally}).`
    );
  }
  if (cycle48h && cycle48h.samplesAfterDrop >= 2) {
    obs.push(
      `After a −${cycle48h.rallyThresholdPct}% (or more) 48h drop, the next 48h averaged ${cycle48h.afterDropNext48hAvgPct}% with a ${cycle48h.afterDropBounceRatePct}% bounce rate (n=${cycle48h.samplesAfterDrop}).`
    );
  }

  for (const w of weeklyRhythm.slice(0, 3)) {
    obs.push(`${w.label}: ${w.hitRatePct}% of cases (${w.samples} samples) — ${w.description}`);
  }

  const weakDays = dayOfWeek.filter((d) => d.samples >= 2 && d.strength === "weak");
  if (weakDays.length >= 5) {
    obs.push("No single weekday shows a strong edge — size down or rely on other Nova tools for entries.");
  }

  let headline = `${symbol} behavioral playbook (${lookbackLabel})`;
  if (bestLongDay && bestShortDay) {
    headline = `Historical lean: long bias ${bestLongDay.label}, short/fade bias ${bestShortDay.label} (${lookbackLabel})`;
  } else if (bestLongDay) {
    headline = `${bestLongDay.label} showed the strongest long bias (${lookbackLabel})`;
  } else if (bestShortDay) {
    headline = `${bestShortDay.label} showed the strongest short / fade bias (${lookbackLabel})`;
  }

  const priceBit =
    currentPrice != null ? ` Spot ${formatQuotePriceUsd(currentPrice)}.` : "";

  const traderBrief = [
    `Nova Agent studied ${lookbackLabel} of ${symbol} candles in ${tzLabel}.${priceBit}`,
    bestLongDay
      ? ` Days that tended to rise: ${bestLongDay.label} (avg ${bestLongDay.avgReturnPct >= 0 ? "+" : ""}${bestLongDay.avgReturnPct}%, ${bestLongDay.winRatePct}% green days, n=${bestLongDay.samples}) — not a guaranteed long signal.`
      : "",
    bestShortDay
      ? ` Days that tended to fall: ${bestShortDay.label} (avg ${bestShortDay.avgReturnPct}%, n=${bestShortDay.samples}) — consider shorts or taking profit, not blind entries.`
      : "",
    cycle48h && cycle48h.samplesAfterRally >= 2
      ? ` 48h cycle: after a sharp 48h rally, next 48h retraced ${cycle48h.afterRallyRetraceRatePct}% of the time.`
      : "",
    " Compare with your Blofin chart and risk plan — patterns are historical tendencies, not guarantees.",
  ]
    .filter(Boolean)
    .join("");

  return { traderBrief, playbookHeadline: headline, observations: obs };
}

export function resolveNovaPatternLookback(id: string) {
  return NOVA_PATTERN_LOOKBACK_OPTIONS.find((o) => o.id === id) ?? NOVA_PATTERN_LOOKBACK_OPTIONS.find((o) => o.id === "6w")!;
}

export function resolveNovaPatternType(id: string): { id: NovaPatternTypeId; label: string } {
  return NOVA_PATTERN_TYPE_OPTIONS.find((o) => o.id === id) ?? NOVA_PATTERN_TYPE_OPTIONS[0];
}

export async function analyzeNovaPattern(
  rawSymbol: string,
  options: { lookbackId: string; patternTypeId: string; timezone?: string }
): Promise<NovaPatternResult> {
  const symbol = normalizeMetalBase(rawSymbol) || "BTC";
  const lookback = resolveNovaPatternLookback(options.lookbackId);
  const patternType = resolveNovaPatternType(options.patternTypeId);
  const timezone = isValidNovaExtraTimezone(options.timezone ?? "")
    ? String(options.timezone).trim()
    : "America/New_York";
  const tzLabel = timezoneShortName(timezone);
  const cutoffTs = Date.now() - lookback.hours * 3_600_000;

  const useBlofin = isBlofinMetal(symbol);
  const contractNote = useBlofin
    ? blofinMetalContractDescription(symbol as BlofinMetal)
    : `${symbol}: Hyperliquid USDC-margined perpetual candles.`;
  const dataSource = useBlofin ? "Blofin" : "Hyperliquid";

  const dailyLimit = Math.min(400, Math.ceil(lookback.hours / 24) + 14);
  const hourlyLimit = Math.min(1440, lookback.hours + 48);

  const [dailyCandles, hourlyCandles, currentPrice] = await Promise.all([
    fetchCandles(symbol, "1d", dailyLimit),
    fetchCandles(symbol, "1h", hourlyLimit),
    fetchTicker(symbol),
  ]);

  if (dailyCandles.length < 5 && hourlyCandles.length < 48) {
    throw new Error(`Not enough candle data for ${symbol}. Try another symbol or a shorter lookback.`);
  }

  const includeDow = patternType.id === "playbook" || patternType.id === "day_of_week";
  const include48h = patternType.id === "playbook" || patternType.id === "cycle_48h";
  const includeWeekly = patternType.id === "playbook" || patternType.id === "weekly_rhythm";

  const dayOfWeek = includeDow ? analyzeDayOfWeek(dailyCandles, timezone, cutoffTs) : [];
  const { bestLongDay, bestShortDay } = includeDow ? pickBestDays(dayOfWeek) : { bestLongDay: null, bestShortDay: null };
  const cycle48h = include48h ? analyze48hCycles(hourlyCandles, cutoffTs) : null;
  const dailyBars = includeWeekly ? buildDailyBars(dailyCandles, timezone, cutoffTs) : [];
  const weeklyRhythm = includeWeekly ? analyzeWeeklyRhythm(dailyBars, timezone) : [];

  const lookbackWarning = isShortPatternLookback(lookback.hours)
    ? `⚠ ${lookback.label} lookback: only ~1 calendar day per weekday — expand to 4w+ for reliable day-of-week stats. Sample dates show which Mondays/Tuesdays were counted.`
    : null;

  const tradeIdeas =
    currentPrice != null && currentPrice > 0
      ? buildTradeIdeas({
          symbol,
          currentPrice,
          dayOfWeek,
          bestLongDay,
          bestShortDay,
          cycle48h,
          tzLabel,
        })
      : [];

  const howToUse = buildHowToUse(lookback.label, tzLabel, lookbackWarning);

  const { traderBrief, playbookHeadline, observations } = buildTraderBrief({
    symbol,
    lookbackLabel: lookback.label,
    tzLabel,
    dayOfWeek,
    bestLongDay,
    bestShortDay,
    cycle48h,
    weeklyRhythm,
    currentPrice,
  });

  return {
    symbol,
    dataSource,
    contractNote,
    lookbackId: lookback.id,
    lookbackLabel: lookback.label,
    patternTypeId: patternType.id,
    patternTypeLabel: patternType.label,
    timezone,
    timezoneLabel: tzLabel,
    currentPrice,
    traderBrief,
    playbookHeadline,
    dayOfWeek,
    bestLongDay,
    bestShortDay,
    cycle48h,
    weeklyRhythm,
    tradeIdeas,
    howToUse,
    lookbackWarning,
    observations,
    disclaimer:
      "Historical calendar and cycle statistics on OHLC data — not financial advice. Past weekday or 48h behavior does not guarantee future results. Use with your exchange chart and risk controls.",
  };
}
