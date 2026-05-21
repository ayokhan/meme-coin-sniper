/**
 * Nova Extra — intraday time-of-day bias from hourly candle history.
 * Identifies UTC hours and ranges where price tended to rise (long) or fall (short).
 */
import type { Candle } from "@/lib/hyperliquid";
import { getCandles as getHlCandles, getPerpSpecFromMeta } from "@/lib/hyperliquid";
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

export const NOVA_EXTRA_LOOKBACK_DAYS = 35;
export const NOVA_EXTRA_MIN_SAMPLES_PER_HOUR = 4;

export type HourBias = "long" | "short" | "neutral";

export type NovaExtraHourStat = {
  hourUtc: number;
  label: string;
  avgReturnPct: number;
  medianReturnPct: number;
  winRatePct: number;
  samples: number;
  bias: HourBias;
  strength: "strong" | "moderate" | "weak";
};

export type NovaExtraTimeWindow = {
  startHourUtc: number;
  endHourUtc: number;
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
  lookbackDays: number;
  totalCandles: number;
  timezoneNote: string;
  dataSource: string;
  contractNote: string;
  hours: NovaExtraHourStat[];
  bestLongWindows: NovaExtraTimeWindow[];
  bestShortWindows: NovaExtraTimeWindow[];
  summary: string;
  longTradeHint: string;
  shortTradeHint: string;
  disclaimer: string;
};

function hourLabel(h: number): string {
  return `${String(h).padStart(2, "0")}:00 UTC`;
}

function windowLabel(start: number, end: number): string {
  if (start === end) return hourLabel(start);
  return `${hourLabel(start)} – ${hourLabel(end)}`;
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

async function fetchHourlyCandles(
  rawSymbol: string,
  lookbackDays: number
): Promise<{ candles: Candle[]; dataSource: string; contractNote: string; symbol: string }> {
  const sym = String(rawSymbol ?? "").trim().toUpperCase();
  if (!sym) throw new Error("Enter a symbol (e.g. BTC, XAU, XAUUSD).");

  const limit = Math.min(1200, lookbackDays * 24 + 48);
  const metal = normalizeMetalBase(sym);

  if (isBlofinMetal(metal)) {
    const candles = await getBlofinMetalCandles(metal as BlofinMetal, "1h", limit);
    return {
      candles,
      dataSource: "Blofin (1h)",
      contractNote: blofinMetalContractDescription(metal as BlofinMetal),
      symbol: metal,
    };
  }

  const forexKey = normalizeForexSymbol(sym);
  const forexEntry = resolveForexEntry(forexKey);
  if (forexEntry) {
    const candles = await getForexCandles(forexKey, "1h", limit);
    return {
      candles,
      dataSource: "Yahoo Finance (1h)",
      contractNote: forexContractDescription(forexKey),
      symbol: forexKey,
    };
  }

  try {
    const spec = await getPerpSpecFromMeta(sym);
    const candles = await getHlCandles(sym, "1h", limit);
    if (candles.length > 0 && spec) {
      return {
        candles,
        dataSource: "Hyperliquid (1h)",
        contractNote: `${spec.name}: Hyperliquid USDC-margined perpetual.`,
        symbol: sym,
      };
    }
    if (candles.length > 0) {
      return {
        candles,
        dataSource: "Hyperliquid (1h)",
        contractNote: `${sym}: Hyperliquid perpetual.`,
        symbol: sym,
      };
    }
  } catch {
    // fall through to Yahoo for typed FX pairs
  }

  if (resolveYahooTicker(forexKey) && forexKey.length >= 6) {
    const candles = await getForexCandles(forexKey, "1h", limit);
    return {
      candles,
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
  minHoursInWindow: number
): NovaExtraTimeWindow[] {
  const eligible = hours.filter((h) => h.bias === bias && h.strength !== "weak" && h.samples >= NOVA_EXTRA_MIN_SAMPLES_PER_HOUR);
  if (eligible.length === 0) return [];

  const sorted = [...eligible].sort((a, b) => a.hourUtc - b.hourUtc);

  type Run = { start: number; end: number; items: NovaExtraHourStat[] };
  const runs: Run[] = [];
  let open: Run | undefined;

  const flush = () => {
    if (open && open.items.length >= minHoursInWindow) runs.push(open);
    open = undefined;
  };

  for (const s of sorted) {
    const h = s.hourUtc;
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
        startHourUtc: run.start,
        endHourUtc: run.end,
        label: windowLabel(run.start, run.end),
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
  lookbackDays = NOVA_EXTRA_LOOKBACK_DAYS
): Promise<NovaExtraResult> {
  const days = Math.min(90, Math.max(14, Math.floor(lookbackDays)));
  const { candles, dataSource, contractNote, symbol } = await fetchHourlyCandles(rawSymbol, days);

  const returnsByHour: number[][] = Array.from({ length: 24 }, () => []);

  for (const c of candles) {
    const ts = Number(c[0]);
    const open = Number(c[1]);
    const close = Number(c[4]);
    if (!Number.isFinite(ts) || !Number.isFinite(open) || !Number.isFinite(close) || open <= 0) continue;
    const hourUtc = new Date(ts).getUTCHours();
    const retPct = ((close - open) / open) * 100;
    returnsByHour[hourUtc]!.push(retPct);
  }

  const hours: NovaExtraHourStat[] = [];
  for (let h = 0; h < 24; h++) {
    const rets = returnsByHour[h]!;
    if (rets.length < NOVA_EXTRA_MIN_SAMPLES_PER_HOUR) {
      hours.push({
        hourUtc: h,
        label: hourLabel(h),
        avgReturnPct: 0,
        medianReturnPct: 0,
        winRatePct: 50,
        samples: rets.length,
        bias: "neutral",
        strength: "weak",
      });
      continue;
    }
    const avgReturnPct = rets.reduce((a, b) => a + b, 0) / rets.length;
    const medianReturnPct = median(rets);
    const winRatePct = (rets.filter((r) => r > 0).length / rets.length) * 100;
    const bias = classifyBias(avgReturnPct, winRatePct);
    const strength = classifyStrength(avgReturnPct, winRatePct);
    hours.push({
      hourUtc: h,
      label: hourLabel(h),
      avgReturnPct: Math.round(avgReturnPct * 1000) / 1000,
      medianReturnPct: Math.round(medianReturnPct * 1000) / 1000,
      winRatePct: Math.round(winRatePct * 10) / 10,
      samples: rets.length,
      bias,
      strength,
    });
  }

  const bestLongWindows = buildTimeWindows(hours, "long", 2);
  const bestShortWindows = buildTimeWindows(hours, "short", 2);

  const topLong = [...hours]
    .filter((h) => h.bias === "long" && h.samples >= NOVA_EXTRA_MIN_SAMPLES_PER_HOUR)
    .sort((a, b) => b.avgReturnPct - a.avgReturnPct)[0];
  const topShort = [...hours]
    .filter((h) => h.bias === "short" && h.samples >= NOVA_EXTRA_MIN_SAMPLES_PER_HOUR)
    .sort((a, b) => a.avgReturnPct - b.avgReturnPct)[0];

  let summary = `Based on ~${days} days of 1-hour candles, ${symbol} shows mixed intraday seasonality (UTC).`;
  if (bestLongWindows.length > 0) {
    summary += ` Strongest long-bias window: ${bestLongWindows[0]!.label} (avg ${bestLongWindows[0]!.avgReturnPct >= 0 ? "+" : ""}${bestLongWindows[0]!.avgReturnPct}% per hour).`;
  } else if (topLong) {
    summary += ` Best single hour to lean long: ${topLong.label} (avg +${topLong.avgReturnPct}% / ${topLong.winRatePct}% up).`;
  }
  if (bestShortWindows.length > 0) {
    summary += ` Strongest short-bias window: ${bestShortWindows[0]!.label} (avg ${bestShortWindows[0]!.avgReturnPct}% per hour).`;
  } else if (topShort) {
    summary += ` Best single hour to lean short: ${topShort.label} (avg ${topShort.avgReturnPct}% / ${(100 - topShort.winRatePct).toFixed(0)}% down).`;
  }

  const longTradeHint =
    bestLongWindows.length > 0
      ? `Consider long exposure during ${bestLongWindows.map((w) => w.label).join(", ")} (UTC) when your higher-timeframe bias agrees.`
      : topLong
        ? `Lean long around ${topLong.label} if structure supports it — historical avg +${topLong.avgReturnPct}% that hour.`
        : "No reliable long-bias hour cluster in this sample; use NovaQ / NovaSmart for direction.";

  const shortTradeHint =
    bestShortWindows.length > 0
      ? `Consider short exposure during ${bestShortWindows.map((w) => w.label).join(", ")} (UTC) when your higher-timeframe bias agrees.`
      : topShort
        ? `Lean short around ${topShort.label} if structure supports it — historical avg ${topShort.avgReturnPct}% that hour.`
        : "No reliable short-bias hour cluster in this sample; use NovaQ / NovaSmart for direction.";

  return {
    symbol,
    lookbackDays: days,
    totalCandles: candles.length,
    timezoneNote:
      "All times are UTC (Coordinated Universal Time). Crypto perps trade 24/7; forex/metals sessions still show hour-of-day patterns in this reference data.",
    dataSource,
    contractNote,
    hours,
    bestLongWindows,
    bestShortWindows,
    summary,
    longTradeHint,
    shortTradeHint,
    disclaimer:
      "Past hour-of-day stats are not a guarantee. News, funding, and regime shifts can override seasonal timing. Not financial advice.",
  };
}
