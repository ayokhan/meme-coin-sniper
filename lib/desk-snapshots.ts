/**
 * Public desk snapshots for /enter — shared cache, no sub-daily Vercel cron.
 * Hobby plan only allows daily crons; TTL refresh on demand is intentional.
 */

import { unstable_cache } from "next/cache";
import { getTrendingPerps } from "@/lib/api-clients/hyperliquid";
import {
  getForexCandles,
  getForexTicker,
  normalizeForexSymbol,
} from "@/lib/forex-market";
import {
  combineStructureAndTrendline,
  highLowFromCandles,
  structureDirectionFromCloses,
  trendlineRegressionFromCloses,
  type CandleTuple,
} from "@/lib/nova-q-analytics";

/** Majors only — keeps guest refresh cheap. */
export const FOREX_DESK_SNAPSHOT_SYMBOLS = [
  "XAUUSD",
  "XAGUSD",
  "EURUSD",
  "GBPUSD",
  "NAS100",
  "US30",
] as const;

export type ForexDeskRow = {
  symbol: string;
  currentPrice: number | null;
  high: number | null;
  low: number | null;
  direction: "bullish" | "bearish" | "sideways";
  insight: string;
};

export type FuturesDeskRow = {
  symbol: string;
  markPx: number | null;
  dayChangePct: number | null;
  volume24h: number | null;
};

export type DeskSnapshots = {
  forex: {
    rows: ForexDeskRow[];
    asOf: string;
    staleAfterMinutes: number;
    note: string;
  };
  futures: {
    rows: FuturesDeskRow[];
    asOf: string;
    staleAfterMinutes: number;
    note: string;
  };
};

const FOREX_TTL_SEC = 30 * 60; // 30 min — fine after Pro cancel
const FUTURES_TTL_SEC = 15 * 60;

async function buildForexSnapshot(): Promise<DeskSnapshots["forex"]> {
  const rows: ForexDeskRow[] = [];
  for (const raw of FOREX_DESK_SNAPSHOT_SYMBOLS) {
    const sym = normalizeForexSymbol(raw) || raw;
    try {
      const candles = await getForexCandles(sym, "1h", 48);
      const hl = highLowFromCandles(candles as CandleTuple[]);
      const ticker = await getForexTicker(sym);
      const currentPrice = ticker?.last
        ? Number(ticker.last)
        : Number(candles[0]?.[4]) || null;
      const structureDirection = structureDirectionFromCloses(candles as CandleTuple[]);
      const tl = trendlineRegressionFromCloses(candles as CandleTuple[]) ?? { bias: "flat" as const };
      const direction = combineStructureAndTrendline(structureDirection, tl.bias);
      let insight = "Mid-range — wait for a clear edge.";
      if (hl && currentPrice != null) {
        const mid = (hl.high + hl.low) / 2;
        if (currentPrice > mid) insight = "Above mid — shorts favor high retests.";
        else if (currentPrice < mid) insight = "Below mid — longs favor low retests.";
      }
      rows.push({
        symbol: sym,
        currentPrice,
        high: hl?.high ?? null,
        low: hl?.low ?? null,
        direction,
        insight,
      });
    } catch {
      rows.push({
        symbol: sym,
        currentPrice: null,
        high: null,
        low: null,
        direction: "sideways",
        insight: "Snapshot unavailable for this symbol.",
      });
    }
  }
  return {
    rows,
    asOf: new Date().toISOString(),
    staleAfterMinutes: FOREX_TTL_SEC / 60,
    note: "Delayed Market Watch desk for guests. Live Nova Forex Agent is VIP.",
  };
}

async function buildFuturesSnapshot(): Promise<DeskSnapshots["futures"]> {
  const perps = await getTrendingPerps(12).catch(() => []);
  const rows: FuturesDeskRow[] = (perps ?? [])
    .slice(0, 10)
    .map((p) => ({
      symbol: String(p.coin ?? "").toUpperCase(),
      markPx: p.markPx != null ? Number(p.markPx) : null,
      dayChangePct: Number.isFinite(p.dayPct) ? p.dayPct : null,
      volume24h: p.dayNtlVlm != null ? Number(p.dayNtlVlm) : null,
    }))
    .filter((r) => r.symbol);

  return {
    rows,
    asOf: new Date().toISOString(),
    staleAfterMinutes: FUTURES_TTL_SEC / 60,
    note: "Curated opportunity rail. Open Chart AI or Liquidation Map from the desk.",
  };
}

export const getDeskSnapshots = unstable_cache(
  async (): Promise<DeskSnapshots> => {
    const [forex, futures] = await Promise.all([buildForexSnapshot(), buildFuturesSnapshot()]);
    return { forex, futures };
  },
  ["novastaris-desk-snapshots-v1"],
  { revalidate: FOREX_TTL_SEC }
);
