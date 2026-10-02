/** Candle loading + full analysis for Nova Session Sweep (server only). */
import { getForexCandles } from "@/lib/forex-market";
import { computeSweepStats, runSessionSweep, type SweepBar } from "@/lib/session-sweep";
import {
  SESSION_SWEEP_LOOKBACKS,
  SESSION_SWEEP_SYMBOLS,
  SESSION_SWEEP_TIMEFRAMES,
  sweepLookbackLabel,
  type SessionSweepResult,
  type SessionSweepScanRow,
  type SweepChartBar,
  type SweepStopMode,
  type SweepSymbol,
  type SweepTimeframe,
} from "@/lib/session-sweep-types";

const HL_INFO = "https://api.hyperliquid.xyz/info";
const HL_MAX_CANDLES = 5000;
const HOUR_MS = 3_600_000;
const CACHE_TTL_MS = 60_000;
/** Extra history before the backtest window so session levels, swings and ATR exist from its first candle. */
const WARMUP_HOURS = 48;
const YAHOO_MAX_HOURS = 60 * 24;

const CHART_SPAN_HOURS: Record<SweepTimeframe, number> = { "5m": 36, "15m": 72, "30m": 120, "1h": 168 };

export const SESSION_SWEEP_RR = 3;

const barCache = new Map<string, { at: number; bars: Promise<SweepBar[]> }>();

export function resolveSweepSymbol(raw: string): SweepSymbol | null {
  const key = String(raw ?? "").trim().toUpperCase();
  return SESSION_SWEEP_SYMBOLS.find((s) => s.symbol === key) ?? null;
}

export function parseSweepTimeframe(raw: unknown): SweepTimeframe {
  return SESSION_SWEEP_TIMEFRAMES.some((t) => t.id === raw) ? (raw as SweepTimeframe) : "5m";
}

/** Accepts a lookback id ("24h", "7d") or a legacy day count. Returns hours. */
export function parseSweepLookbackHours(raw: unknown): number {
  const byId = SESSION_SWEEP_LOOKBACKS.find((l) => l.id === raw);
  if (byId) return byId.hours;
  const days = Number(raw);
  const byDays = SESSION_SWEEP_LOOKBACKS.find((l) => l.hours === days * 24);
  return byDays?.hours ?? 14 * 24;
}

export function parseSweepStopMode(raw: unknown): SweepStopMode {
  return raw === "sweep" ? "sweep" : "structure";
}

function tfMinutes(tf: SweepTimeframe): number {
  return SESSION_SWEEP_TIMEFRAMES.find((t) => t.id === tf)?.minutes ?? 5;
}

/** Hours of history the source can serve (Hyperliquid keeps only its latest 5,000 candles per interval). */
function maxSourceHours(market: SweepSymbol["market"], tf: SweepTimeframe): number {
  if (market === "crypto") return Math.floor((HL_MAX_CANDLES * tfMinutes(tf)) / 60);
  return YAHOO_MAX_HOURS;
}

async function fetchHyperliquidBars(coin: string, tf: SweepTimeframe, hours: number): Promise<SweepBar[]> {
  const tfMs = tfMinutes(tf) * 60_000;
  const end = Date.now();
  let cursor = end - hours * HOUR_MS;
  const byTs = new Map<number, SweepBar>();
  for (let page = 0; page < 6 && cursor < end; page++) {
    const res = await fetch(HL_INFO, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "candleSnapshot", req: { coin, interval: tf, startTime: cursor, endTime: end } }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`Hyperliquid candles unavailable for ${coin} (${res.status}).`);
    const raw = (await res.json()) as Array<{ t: number; o: string; h: string; l: string; c: string }>;
    if (!Array.isArray(raw) || raw.length === 0) break;
    for (const r of raw) {
      const bar = { t: Number(r.t), o: Number(r.o), h: Number(r.h), l: Number(r.l), c: Number(r.c) };
      if ([bar.t, bar.o, bar.h, bar.l, bar.c].every(Number.isFinite)) byTs.set(bar.t, bar);
    }
    const lastT = Number(raw[raw.length - 1]!.t);
    if (raw.length < HL_MAX_CANDLES || !Number.isFinite(lastT)) break;
    cursor = lastT + tfMs;
  }
  return Array.from(byTs.values()).sort((a, b) => a.t - b.t);
}

async function fetchYahooBars(symbol: string, tf: SweepTimeframe, hours: number): Promise<SweepBar[]> {
  const days = hours / 24;
  const range = days <= 5 ? "5d" : days <= 30 ? "1mo" : "60d";
  const candles = await getForexCandles(symbol, tf, 100_000, range);
  const bars: SweepBar[] = [];
  for (const c of candles) {
    const bar = { t: Number(c[0]), o: Number(c[1]), h: Number(c[2]), l: Number(c[3]), c: Number(c[4]) };
    if ([bar.t, bar.o, bar.h, bar.l, bar.c].every(Number.isFinite) && bar.h >= bar.l) bars.push(bar);
  }
  bars.sort((a, b) => a.t - b.t);
  const deduped: SweepBar[] = [];
  for (const bar of bars) {
    if (deduped.length && deduped[deduped.length - 1]!.t === bar.t) deduped[deduped.length - 1] = bar;
    else deduped.push(bar);
  }
  return deduped;
}

async function loadBarsUncached(sym: SweepSymbol, tf: SweepTimeframe, hours: number): Promise<SweepBar[]> {
  const tfMs = tfMinutes(tf) * 60_000;
  const raw =
    sym.market === "crypto" ? await fetchHyperliquidBars(sym.symbol, tf, hours) : await fetchYahooBars(sym.symbol, tf, hours);
  const now = Date.now();
  const from = now - hours * HOUR_MS;
  return raw.filter((b) => b.t >= from && b.t + tfMs <= now);
}

function loadSweepBars(sym: SweepSymbol, tf: SweepTimeframe, hours: number): Promise<SweepBar[]> {
  const key = `${sym.symbol}|${tf}|${hours}`;
  const hit = barCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.bars;
  const bars = loadBarsUncached(sym, tf, hours);
  barCache.set(key, { at: Date.now(), bars });
  bars.catch(() => barCache.delete(key));
  if (barCache.size > 200) {
    for (const [k, v] of barCache) if (Date.now() - v.at >= CACHE_TTL_MS) barCache.delete(k);
  }
  return bars;
}

function dataNoteFor(sym: SweepSymbol, tf: SweepTimeframe, requestedHours: number, usedHours: number): string {
  const source =
    sym.market === "crypto"
      ? `Hyperliquid ${sym.symbol}-USDC perpetual candles.`
      : sym.market === "metal"
        ? "Yahoo futures candles, shifted to Swissquote spot so levels line up with broker charts."
        : "Yahoo Finance FX candles (reference feed; your broker's prices can differ by a few pips).";
  const capped =
    usedHours >= requestedHours
      ? ""
      : sym.market === "crypto"
        ? ` Hyperliquid keeps only its latest 5,000 ${tf} candles, so this backtest covers the ${sweepLookbackLabel(usedHours)}. Use bigger candles for a longer backtest.`
        : ` Yahoo serves about 60 days of intraday candles and 2 days are used to warm up, so this backtest covers the ${sweepLookbackLabel(usedHours)}.`;
  return `${source}${capped}`;
}

export async function analyzeSessionSweep(input: {
  symbol: SweepSymbol;
  timeframe: SweepTimeframe;
  lookbackHours: number;
  stopMode: SweepStopMode;
  focusTs?: number | null;
}): Promise<SessionSweepResult> {
  const { symbol: sym, timeframe, stopMode } = input;
  const sourceHours = maxSourceHours(sym.market, timeframe);
  const usedHours = Math.max(1, Math.min(input.lookbackHours, sourceHours - WARMUP_HOURS));
  const fetchHours = Math.ceil((usedHours + WARMUP_HOURS) / 24) * 24;
  const bars = await loadSweepBars(sym, timeframe, Math.min(fetchHours, sourceHours));
  if (bars.length < 30) throw new Error(`Not enough ${timeframe} candles for ${sym.symbol} right now. Try again shortly.`);

  const run = runSessionSweep(bars, { tfMinutes: tfMinutes(timeframe), stopMode, rr: SESSION_SWEEP_RR });
  const lastTs = bars[bars.length - 1]!.t;
  const tfMs = tfMinutes(timeframe) * 60_000;
  const windowStartTs = lastTs + tfMs - usedHours * HOUR_MS;
  const windowTrades = run.trades.filter((tr) => tr.entryTs >= windowStartTs);
  const barsInWindow = bars.filter((b) => b.t >= windowStartTs);

  const spanMs = CHART_SPAN_HOURS[timeframe] * HOUR_MS;
  const firstTs = bars[0]!.t;
  const focus = input.focusTs && Number.isFinite(input.focusTs) ? input.focusTs : null;
  let toTs = focus ? focus + spanMs / 2 : lastTs + 1;
  if (toTs > lastTs + 1) toTs = lastTs + 1;
  let fromTs = toTs - spanMs;
  if (fromTs < firstTs) fromTs = firstTs;

  const chartBars: SweepChartBar[] = bars
    .filter((b) => b.t >= fromTs && b.t <= toTs)
    .map((b) => [b.t, b.o, b.h, b.l, b.c]);
  const overlaps = (start: number, end: number) => end >= fromTs && start <= toTs;
  const chartRanges = [...run.ranges, ...run.building].filter((r) => overlaps(r.startTs, r.endTs));
  const chartTrades = run.trades.filter((tr) => overlaps(tr.sweepTs, tr.exitTs ?? lastTs));

  return {
    symbol: sym.symbol,
    label: sym.label,
    market: sym.market,
    timeframe,
    lookbackHours: usedHours,
    windowStartTs,
    stopMode,
    rr: SESSION_SWEEP_RR,
    barsAnalyzed: barsInWindow.length,
    firstBarTs: barsInWindow[0]?.t ?? null,
    lastBarTs: lastTs,
    dataNote: dataNoteFor(sym, timeframe, input.lookbackHours, usedHours),
    live: run.live,
    levels: run.levels,
    forming: run.building,
    trades: [...windowTrades].reverse(),
    stats: computeSweepStats(windowTrades),
    chart: { bars: chartBars, ranges: chartRanges, trades: chartTrades, fromTs, toTs },
  };
}

export async function scanSessionSweep(input: {
  timeframe: SweepTimeframe;
  lookbackHours: number;
  stopMode: SweepStopMode;
}): Promise<SessionSweepScanRow[]> {
  const rows: SessionSweepScanRow[] = new Array(SESSION_SWEEP_SYMBOLS.length);
  let next = 0;
  const worker = async () => {
    while (next < SESSION_SWEEP_SYMBOLS.length) {
      const idx = next++;
      const sym = SESSION_SWEEP_SYMBOLS[idx]!;
      try {
        const r = await analyzeSessionSweep({ symbol: sym, ...input });
        rows[idx] = {
          symbol: sym.symbol,
          label: sym.label,
          market: sym.market,
          ok: true,
          live: r.live,
          stats: { trades: r.stats.trades, winRate: r.stats.winRate, totalR: r.stats.totalR, avgR: r.stats.avgR },
          lastTrade: r.trades[0] ?? null,
        };
      } catch (e) {
        rows[idx] = {
          symbol: sym.symbol,
          label: sym.label,
          market: sym.market,
          ok: false,
          error: e instanceof Error ? e.message : "Failed",
        };
      }
    }
  };
  await Promise.all(Array.from({ length: 5 }, worker));
  return rows;
}
