/**
 * Nova Extra — intraday time-of-day bias from hourly candle history.
 * Buckets by local hour (IANA timezone) where price tended to rise (long) or fall (short).
 */
import type { Candle } from "@/lib/hyperliquid";
import { getPerpSpecFromMeta, instIdToCoin, toHyperliquidInterval } from "@/lib/hyperliquid";
import {
  blofinMetalContractDescription,
  getBlofinMetalCandles,
  isBlofinMetal,
  normalizeMetalBase,
  type BlofinMetal,
} from "@/lib/blofin-metals";
import {
  forexContractDescription,
  getForexCandles,
  normalizeForexSymbol,
  resolveForexEntry,
  resolveYahooTicker,
} from "@/lib/forex-market";

const HL_INFO_BASE = "https://api.hyperliquid.xyz/info";

export const NOVA_EXTRA_LOOKBACK_DAYS = 35;
export const NOVA_EXTRA_MIN_SAMPLES_PER_HOUR = 4;
export const NOVA_EXTRA_HIGH_WIN_RATE_PCT = 58;

export type NovaExtraLookbackId =
  | "24h"
  | "48h"
  | "72h"
  | "5d"
  | "1w"
  | "2w"
  | "6w"
  | "1y"
  | "2y";

export const NOVA_EXTRA_LOOKBACK_OPTIONS: { id: NovaExtraLookbackId; label: string; hours: number }[] = [
  { id: "24h", label: "24 hours", hours: 24 },
  { id: "48h", label: "48 hours", hours: 48 },
  { id: "72h", label: "72 hours", hours: 72 },
  { id: "5d", label: "5 days", hours: 120 },
  { id: "1w", label: "1 week", hours: 168 },
  { id: "2w", label: "2 weeks", hours: 336 },
  { id: "6w", label: "6 weeks", hours: 1008 },
  { id: "1y", label: "1 year", hours: 8760 },
  { id: "2y", label: "2 years", hours: 17520 },
];

export const NOVA_EXTRA_TIMEZONE_OPTIONS: { id: string; label: string }[] = [
  { id: "UTC", label: "UTC" },
  { id: "America/New_York", label: "Eastern (US)" },
  { id: "America/Chicago", label: "Central (US)" },
  { id: "America/Denver", label: "Mountain (US)" },
  { id: "America/Los_Angeles", label: "Pacific (US)" },
  { id: "Europe/London", label: "London" },
  { id: "Europe/Paris", label: "Paris / CET" },
  { id: "Europe/Berlin", label: "Berlin" },
  { id: "Asia/Dubai", label: "Dubai" },
  { id: "Asia/Singapore", label: "Singapore" },
  { id: "Asia/Tokyo", label: "Tokyo" },
  { id: "Asia/Hong_Kong", label: "Hong Kong" },
  { id: "Australia/Sydney", label: "Sydney" },
];

export type HourBias = "long" | "short" | "neutral";

export type NovaExtraHourStat = {
  hourLocal: number;
  label: string;
  avgReturnPct: number;
  medianReturnPct: number;
  winRatePct: number;
  samples: number;
  bias: HourBias;
  strength: "strong" | "moderate" | "weak";
  highSuccessRate: boolean;
  /** Average hour open → close in price terms (symbol units). */
  avgOpen: number;
  avgClose: number;
  typicalPriceRange: string;
};

/** Best single-hour (or window) entry timing with typical price path. */
export type NovaExtraLockInTime = {
  side: "long" | "short";
  timeLabel: string;
  avgReturnPct: number;
  winRatePct: number;
  samples: number;
  avgOpen: number;
  avgClose: number;
  priceRange: string;
  confidence: "high" | "medium" | "low";
};

export type NovaExtraTimeWindow = {
  startHourLocal: number;
  endHourLocal: number;
  label: string;
  bias: "long" | "short";
  avgReturnPct: number;
  avgWinRatePct: number;
  hourCount: number;
  samples: number;
  confidence: "high" | "medium" | "low";
};

export type NovaExtraResult = {
  symbol: string;
  timezone: string;
  lookbackId: NovaExtraLookbackId;
  lookbackLabel: string;
  lookbackHours: number;
  totalCandles: number;
  timezoneNote: string;
  dataSource: string;
  contractNote: string;
  hours: NovaExtraHourStat[];
  bestLongWindows: NovaExtraTimeWindow[];
  bestShortWindows: NovaExtraTimeWindow[];
  /** Headline copy for suggested entry hours (with typical price move). */
  recommendedLockInSummary: string;
  recommendedLong: NovaExtraLockInTime | null;
  recommendedShort: NovaExtraLockInTime | null;
  summary: string;
  longTradeHint: string;
  shortTradeHint: string;
  disclaimer: string;
};

type HourBucket = {
  returns: number[];
  opens: number[];
  closes: number[];
};

export function formatNovaExtraPrice(symbol: string, price: number): string {
  if (!Number.isFinite(price)) return "—";
  const s = symbol.toUpperCase();
  if (s === "BTC" || s === "ETH" || s === "SOL" || s === "BNB") {
    return price >= 100 ? Math.round(price).toLocaleString("en-US") : price.toFixed(2);
  }
  if (s === "XAU" || s === "XAG" || s.includes("XAU") || s.includes("XAG")) {
    return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (price >= 100) return price.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (price < 1) return price.toFixed(5);
  return price.toFixed(2);
}

function buildPriceMoveLabel(symbol: string, avgOpen: number, avgClose: number): string {
  return `${formatNovaExtraPrice(symbol, avgOpen)} → ${formatNovaExtraPrice(symbol, avgClose)}`;
}

function confidenceFromSamples(samples: number): NovaExtraLockInTime["confidence"] {
  if (samples >= 20) return "high";
  if (samples >= 5) return "medium";
  return "low";
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function hourInWindow(hourLocal: number, start: number, end: number): boolean {
  if (start <= end) return hourLocal >= start && hourLocal <= end;
  return hourLocal >= start || hourLocal <= end;
}

function lockInFromHour(h: NovaExtraHourStat, symbol: string, side: "long" | "short"): NovaExtraLockInTime | null {
  if (h.samples < 1 || !Number.isFinite(h.avgOpen) || h.avgOpen <= 0) return null;
  return {
    side,
    timeLabel: h.label,
    avgReturnPct: h.avgReturnPct,
    winRatePct: h.winRatePct,
    samples: h.samples,
    avgOpen: h.avgOpen,
    avgClose: h.avgClose,
    priceRange: h.typicalPriceRange || buildPriceMoveLabel(symbol, h.avgOpen, h.avgClose),
    confidence: confidenceFromSamples(h.samples),
  };
}

function lockInFromWindow(
  w: NovaExtraTimeWindow,
  buckets: HourBucket[],
  symbol: string,
  side: "long" | "short"
): NovaExtraLockInTime | null {
  const opens: number[] = [];
  const closes: number[] = [];
  for (let h = 0; h < 24; h++) {
    if (!hourInWindow(h, w.startHourLocal, w.endHourLocal)) continue;
    opens.push(...buckets[h]!.opens);
    closes.push(...buckets[h]!.closes);
  }
  if (opens.length === 0) return null;
  const avgOpen = avg(opens);
  const avgClose = avg(closes);
  return {
    side,
    timeLabel: w.label,
    avgReturnPct: w.avgReturnPct,
    winRatePct: w.avgWinRatePct,
    samples: w.samples,
    avgOpen,
    avgClose,
    priceRange: buildPriceMoveLabel(symbol, avgOpen, avgClose),
    confidence: w.confidence,
  };
}

function buildRecommendedLockInSummary(
  symbol: string,
  lookbackLabel: string,
  tzLabel: string,
  longLock: NovaExtraLockInTime | null,
  shortLock: NovaExtraLockInTime | null
): string {
  let s = `Based on ${lookbackLabel} of 1-hour candles, ${symbol} intraday seasonality in ${tzLabel}.`;
  if (longLock) {
    s += ` Recommended lock-in for long: ${longLock.timeLabel} — price tended ${longLock.priceRange} (avg +${longLock.avgReturnPct}% / ${longLock.winRatePct}% up, ${longLock.samples} sample${longLock.samples === 1 ? "" : "s"}).`;
  }
  if (shortLock) {
    const downPct = Math.round(100 - shortLock.winRatePct);
    s += ` Recommended lock-in for short: ${shortLock.timeLabel} — price tended ${shortLock.priceRange} (avg ${shortLock.avgReturnPct}% / ${downPct}% down, ${shortLock.samples} sample${shortLock.samples === 1 ? "" : "s"}).`;
  }
  return s;
}

export function isValidNovaExtraTimezone(tz: string): boolean {
  const t = String(tz ?? "").trim();
  if (!t || t.length > 64) return false;
  try {
    Intl.DateTimeFormat("en-US", { timeZone: t });
    return true;
  } catch {
    return false;
  }
}

export function resolveNovaExtraLookback(id: string): { id: NovaExtraLookbackId; label: string; hours: number } {
  const found = NOVA_EXTRA_LOOKBACK_OPTIONS.find((o) => o.id === id);
  return found ?? NOVA_EXTRA_LOOKBACK_OPTIONS.find((o) => o.id === "6w")!;
}

function minSamplesForLookbackHours(hours: number): number {
  if (hours <= 72) return 1;
  if (hours <= 168) return 2;
  if (hours <= 24 * 14) return 3;
  return NOVA_EXTRA_MIN_SAMPLES_PER_HOUR;
}

function yahooRangeForLookbackHours(hours: number): string {
  if (hours <= 168) return "1mo";
  if (hours <= 24 * 90) return "3mo";
  if (hours <= 24 * 180) return "6mo";
  if (hours <= 24 * 365) return "1y";
  return "2y";
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

export function getLocalHour(ts: number, timeZone: string): number {
  const h = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    hour12: false,
  }).format(new Date(ts));
  return parseInt(h, 10) % 24;
}

function formatLocalHourLabel(hourLocal: number, timeZone: string): string {
  const period = hourLocal < 12 ? "AM" : "PM";
  const h12 = hourLocal % 12 || 12;
  return `${h12}:00 ${period} (${timezoneShortName(timeZone)})`;
}

function windowLabel(start: number, end: number, timeZone: string): string {
  if (start === end) return formatLocalHourLabel(start, timeZone);
  return `${formatLocalHourLabel(start, timeZone)} – ${formatLocalHourLabel(end, timeZone)}`;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

function classifyStrength(avgReturnPct: number, winRatePct: number): "strong" | "moderate" | "weak" {
  const edge = Math.abs(avgReturnPct);
  const wrEdge = Math.abs(winRatePct - 50);
  if (edge >= 0.06 && wrEdge >= 12) return "strong";
  if (edge >= 0.025 && wrEdge >= 6) return "moderate";
  return "weak";
}

function classifyBias(avgReturnPct: number, winRatePct: number): HourBias {
  if (avgReturnPct >= 0.02 && winRatePct >= 52) return "long";
  if (avgReturnPct <= -0.02 && winRatePct <= 48) return "short";
  return "neutral";
}

function isHighSuccessRate(bias: HourBias, winRatePct: number, samples: number, minSamples: number): boolean {
  if (samples < minSamples || bias === "neutral") return false;
  if (bias === "long") return winRatePct >= NOVA_EXTRA_HIGH_WIN_RATE_PCT;
  return winRatePct <= 100 - NOVA_EXTRA_HIGH_WIN_RATE_PCT;
}

async function fetchHlHourlyCandles(coin: string, hoursNeeded: number): Promise<Candle[]> {
  const interval = toHyperliquidInterval("1h");
  const intervalMs = 3_600_000;
  const maxPerShot = 4000;
  let end = Date.now();
  const startCutoff = end - hoursNeeded * intervalMs;
  const merged: Candle[] = [];
  const seen = new Set<string>();

  while (end > startCutoff && merged.length < hoursNeeded + 96) {
    const span = Math.min(maxPerShot, Math.ceil((end - startCutoff) / intervalMs) + 4);
    const start = Math.max(startCutoff, end - span * intervalMs);
    const res = await fetch(HL_INFO_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "candleSnapshot",
        req: { coin, interval, startTime: start, endTime: end },
      }),
      cache: "no-store",
    });
    if (!res.ok) break;
    const raw = (await res.json()) as Array<{ t?: number; T?: number; o: string; h: string; l: string; c: string; v: string }>;
    if (!Array.isArray(raw) || raw.length === 0) break;

    let oldest = end;
    for (const c of raw) {
      const ts = Number(c.T ?? c.t ?? 0);
      if (!Number.isFinite(ts) || ts < startCutoff) continue;
      const key = String(ts);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push([key, c.o, c.h, c.l, c.c, c.v, "USDC", "USDC", "1"]);
      if (ts < oldest) oldest = ts;
    }
    if (oldest <= start || raw.length < 10) break;
    end = oldest - 1;
  }

  merged.sort((a, b) => Number(b[0]) - Number(a[0]));
  return merged;
}

function filterCandlesByLookback(candles: Candle[], lookbackHours: number): Candle[] {
  const cutoff = Date.now() - lookbackHours * 3_600_000;
  return candles.filter((c) => Number(c[0]) >= cutoff);
}

async function fetchHourlyCandles(
  rawSymbol: string,
  lookbackHours: number
): Promise<{ candles: Candle[]; dataSource: string; contractNote: string; symbol: string }> {
  const sym = String(rawSymbol ?? "").trim().toUpperCase();
  if (!sym) throw new Error("Enter a symbol (e.g. BTC, XAU, XAUUSD).");

  const limit = Math.min(20_000, lookbackHours + 96);
  const yahooRange = yahooRangeForLookbackHours(lookbackHours);
  const metal = normalizeMetalBase(sym);

  if (isBlofinMetal(metal)) {
    const raw = await getBlofinMetalCandles(metal as BlofinMetal, "1h", Math.min(1440, limit));
    return {
      candles: filterCandlesByLookback(raw, lookbackHours),
      dataSource: "Blofin (1h)",
      contractNote: blofinMetalContractDescription(metal as BlofinMetal),
      symbol: metal,
    };
  }

  const forexKey = normalizeForexSymbol(sym);
  const forexEntry = resolveForexEntry(forexKey);
  if (forexEntry) {
    const raw = await getForexCandles(forexKey, "1h", limit, yahooRange);
    return {
      candles: filterCandlesByLookback(raw, lookbackHours),
      dataSource: "Yahoo Finance (1h)",
      contractNote: forexContractDescription(forexKey),
      symbol: forexKey,
    };
  }

  try {
    const coin = instIdToCoin(sym);
    const spec = await getPerpSpecFromMeta(sym);
    const raw = await fetchHlHourlyCandles(coin, lookbackHours);
    if (raw.length > 0 && spec) {
      return {
        candles: filterCandlesByLookback(raw, lookbackHours),
        dataSource: "Hyperliquid (1h)",
        contractNote: `${spec.name}: Hyperliquid USDC-margined perpetual.`,
        symbol: sym,
      };
    }
    if (raw.length > 0) {
      return {
        candles: filterCandlesByLookback(raw, lookbackHours),
        dataSource: "Hyperliquid (1h)",
        contractNote: `${sym}: Hyperliquid perpetual.`,
        symbol: sym,
      };
    }
  } catch {
    // fall through to Yahoo
  }

  if (resolveYahooTicker(forexKey) && forexKey.length >= 6) {
    const raw = await getForexCandles(forexKey, "1h", limit, yahooRange);
    return {
      candles: filterCandlesByLookback(raw, lookbackHours),
      dataSource: "Yahoo Finance (1h)",
      contractNote: forexContractDescription(forexKey),
      symbol: forexKey,
    };
  }

  throw new Error(
    `No hourly data for ${sym}. Try BTC, ETH, XAU (Blofin), or XAUUSD / EURUSD (Yahoo).`
  );
}

function buildTimeWindows(
  hours: NovaExtraHourStat[],
  bias: "long" | "short",
  minHoursInWindow: number,
  timeZone: string,
  minSamples: number
): NovaExtraTimeWindow[] {
  const eligible = hours.filter((h) => h.bias === bias && h.strength !== "weak" && h.samples >= minSamples);
  if (eligible.length === 0) return [];

  const sorted = [...eligible].sort((a, b) => a.hourLocal - b.hourLocal);

  type Run = { start: number; end: number; items: NovaExtraHourStat[] };
  const runs: Run[] = [];
  let open: Run | undefined;

  const flush = () => {
    if (open && open.items.length >= minHoursInWindow) runs.push(open);
    open = undefined;
  };

  for (const s of sorted) {
    const h = s.hourLocal;
    if (!open) {
      open = { start: h, end: h, items: [s] };
      continue;
    }
    if (h === open.end + 1 || (open.end === 23 && h === 0)) {
      open.end = h;
      open.items.push(s);
    } else {
      flush();
      open = { start: h, end: h, items: [s] };
    }
  }
  flush();

  return runs
    .map((run) => {
      const avgReturnPct = run.items.reduce((a, x) => a + x.avgReturnPct, 0) / run.items.length;
      const avgWinRatePct = run.items.reduce((a, x) => a + x.winRatePct, 0) / run.items.length;
      const samples = run.items.reduce((a, x) => a + x.samples, 0);
      const strengthScore = run.items.filter((x) => x.strength === "strong").length;
      const confidence: NovaExtraTimeWindow["confidence"] =
        strengthScore >= 2 && samples >= 40 ? "high" : samples >= 20 ? "medium" : "low";
      return {
        startHourLocal: run.start,
        endHourLocal: run.end,
        label: windowLabel(run.start, run.end, timeZone),
        bias,
        avgReturnPct: Math.round(avgReturnPct * 1000) / 1000,
        avgWinRatePct: Math.round(avgWinRatePct * 10) / 10,
        hourCount: run.items.length,
        samples,
        confidence,
      };
    })
    .sort((a, b) => Math.abs(b.avgReturnPct) - Math.abs(a.avgReturnPct))
    .slice(0, 4);
}

export async function analyzeNovaExtra(
  rawSymbol: string,
  options?: {
    lookbackId?: string;
    lookbackDays?: number;
    timezone?: string;
  }
): Promise<NovaExtraResult> {
  const lookback = options?.lookbackId
    ? resolveNovaExtraLookback(options.lookbackId)
    : options?.lookbackDays
      ? {
          id: "6w" as NovaExtraLookbackId,
          label: `~${Math.floor(options.lookbackDays)} days`,
          hours: Math.min(17520, Math.max(24, Math.floor(options.lookbackDays) * 24)),
        }
      : resolveNovaExtraLookback("6w");

  const lookbackHours = lookback.hours;
  const minSamples = minSamplesForLookbackHours(lookbackHours);

  const tzRaw = String(options?.timezone ?? "UTC").trim();
  const timeZone = isValidNovaExtraTimezone(tzRaw) ? tzRaw : "UTC";

  const { candles, dataSource, contractNote, symbol } = await fetchHourlyCandles(rawSymbol, lookbackHours);

  const buckets: HourBucket[] = Array.from({ length: 24 }, () => ({
    returns: [],
    opens: [],
    closes: [],
  }));

  for (const c of candles) {
    const ts = Number(c[0]);
    const open = Number(c[1]);
    const close = Number(c[4]);
    if (!Number.isFinite(ts) || !Number.isFinite(open) || !Number.isFinite(close) || open <= 0) continue;
    const hourLocal = getLocalHour(ts, timeZone);
    const retPct = ((close - open) / open) * 100;
    const b = buckets[hourLocal]!;
    b.returns.push(retPct);
    b.opens.push(open);
    b.closes.push(close);
  }

  const hours: NovaExtraHourStat[] = [];
  for (let h = 0; h < 24; h++) {
    const rets = buckets[h]!.returns;
    const opens = buckets[h]!.opens;
    const closes = buckets[h]!.closes;
    const avgOpenVal = avg(opens);
    const avgCloseVal = avg(closes);
    const priceRange =
      opens.length > 0 ? buildPriceMoveLabel(symbol, avgOpenVal, avgCloseVal) : "—";

    if (rets.length < minSamples) {
      hours.push({
        hourLocal: h,
        label: formatLocalHourLabel(h, timeZone),
        avgReturnPct: 0,
        medianReturnPct: 0,
        winRatePct: 50,
        samples: rets.length,
        bias: "neutral",
        strength: "weak",
        highSuccessRate: false,
        avgOpen: avgOpenVal,
        avgClose: avgCloseVal,
        typicalPriceRange: priceRange,
      });
      continue;
    }
    const avgReturnPct = rets.reduce((a, b) => a + b, 0) / rets.length;
    const medianReturnPct = median(rets);
    const winRatePct = (rets.filter((r) => r > 0).length / rets.length) * 100;
    const bias = classifyBias(avgReturnPct, winRatePct);
    const strength = classifyStrength(avgReturnPct, winRatePct);
    hours.push({
      hourLocal: h,
      label: formatLocalHourLabel(h, timeZone),
      avgReturnPct: Math.round(avgReturnPct * 1000) / 1000,
      medianReturnPct: Math.round(medianReturnPct * 1000) / 1000,
      winRatePct: Math.round(winRatePct * 10) / 10,
      samples: rets.length,
      bias,
      strength,
      highSuccessRate: isHighSuccessRate(bias, winRatePct, rets.length, minSamples),
      avgOpen: Math.round(avgOpenVal * 100) / 100,
      avgClose: Math.round(avgCloseVal * 100) / 100,
      typicalPriceRange: priceRange,
    });
  }

  const bestLongWindows = buildTimeWindows(hours, "long", 2, timeZone, minSamples);
  const bestShortWindows = buildTimeWindows(hours, "short", 2, timeZone, minSamples);

  const topLong = [...hours]
    .filter((h) => h.bias === "long" && h.samples >= minSamples)
    .sort((a, b) => b.avgReturnPct - a.avgReturnPct)[0];
  const topShort = [...hours]
    .filter((h) => h.bias === "short" && h.samples >= minSamples)
    .sort((a, b) => a.avgReturnPct - b.avgReturnPct)[0];

  const tzLabel = timezoneShortName(timeZone);

  const recommendedLong =
    bestLongWindows.length > 0 && bestLongWindows[0]!.confidence !== "low"
      ? lockInFromWindow(bestLongWindows[0]!, buckets, symbol, "long")
      : topLong
        ? lockInFromHour(topLong, symbol, "long")
        : null;
  const recommendedShort =
    bestShortWindows.length > 0 && bestShortWindows[0]!.confidence !== "low"
      ? lockInFromWindow(bestShortWindows[0]!, buckets, symbol, "short")
      : topShort
        ? lockInFromHour(topShort, symbol, "short")
        : null;

  const recommendedLockInSummary = buildRecommendedLockInSummary(
    symbol,
    lookback.label,
    tzLabel,
    recommendedLong,
    recommendedShort
  );

  let summary = recommendedLockInSummary;
  if (bestLongWindows.length > 0 && !recommendedLong) {
    summary += ` Strongest long-bias window: ${bestLongWindows[0]!.label} (avg ${bestLongWindows[0]!.avgReturnPct >= 0 ? "+" : ""}${bestLongWindows[0]!.avgReturnPct}% per hour).`;
  }
  if (bestShortWindows.length > 0 && !recommendedShort) {
    summary += ` Strongest short-bias window: ${bestShortWindows[0]!.label} (avg ${bestShortWindows[0]!.avgReturnPct}% per hour).`;
  }

  const longTradeHint =
    recommendedLong
      ? `Suggested long lock-in: ${recommendedLong.timeLabel}. In this sample, that hour averaged ${recommendedLong.priceRange} (open → close) with +${recommendedLong.avgReturnPct}% and ${recommendedLong.winRatePct}% up bars (${recommendedLong.confidence} confidence, ${recommendedLong.samples} samples).`
      : bestLongWindows.length > 0
        ? `Consider long exposure during ${bestLongWindows.map((w) => w.label).join(", ")} when your higher-timeframe bias agrees.`
        : topLong
          ? `Lean long around ${topLong.label} if structure supports it — typical move ${topLong.typicalPriceRange}, avg +${topLong.avgReturnPct}% that hour.`
          : "No reliable long-bias hour cluster in this sample; use NovaQ / NovaSmart for direction.";

  const shortTradeHint =
    recommendedShort
      ? `Suggested short lock-in: ${recommendedShort.timeLabel}. In this sample, that hour averaged ${recommendedShort.priceRange} (open → close) with ${recommendedShort.avgReturnPct}% and ${Math.round(100 - recommendedShort.winRatePct)}% down bars (${recommendedShort.confidence} confidence, ${recommendedShort.samples} samples).`
      : bestShortWindows.length > 0
        ? `Consider short exposure during ${bestShortWindows.map((w) => w.label).join(", ")} when your higher-timeframe bias agrees.`
        : topShort
          ? `Lean short around ${topShort.label} if structure supports it — typical move ${topShort.typicalPriceRange}, avg ${topShort.avgReturnPct}% that hour.`
          : "No reliable short-bias hour cluster in this sample; use NovaQ / NovaSmart for direction.";

  const highSuccessHours = hours.filter((h) => h.highSuccessRate);

  return {
    symbol,
    timezone: timeZone,
    lookbackId: lookback.id,
    lookbackLabel: lookback.label,
    lookbackHours,
    totalCandles: candles.length,
    timezoneNote: `All times are in ${timeZone} (${tzLabel}). Hours follow your selected timezone (including DST where applicable).${highSuccessHours.length > 0 ? ` ${highSuccessHours.length} hour(s) hit ≥${NOVA_EXTRA_HIGH_WIN_RATE_PCT}% directional success in this sample.` : ""}`,
    dataSource,
    contractNote,
    hours,
    bestLongWindows,
    bestShortWindows,
    recommendedLockInSummary,
    recommendedLong,
    recommendedShort,
    summary,
    longTradeHint,
    shortTradeHint,
    disclaimer:
      "Past hour-of-day stats are not a guarantee. News, funding, and regime shifts can override seasonal timing. Not financial advice.",
  };
}
