/**
 * Nova Scalp market data from Blofin USDT-margined swaps (matches Blofin Trade UI).
 * Metals (XAU/XAG) still use Blofin candles; spot calibration stays in analyze/price routes.
 */
import type { TrendingPerp } from "@/lib/api-clients/hyperliquid";
import { TOP_ALTCOINS } from "@/lib/api-clients/hyperliquid";
import {
  getCandles as getBlofinCandles,
  getInstrument as getBlofinInstrument,
  getTicker as getBlofinTicker,
  toBlofinBar,
} from "@/lib/blofin";
import {
  getBlofinMetalCandles,
  getBlofinMetalTicker,
  isBlofinMetal,
  toBlofinInstId,
  type BlofinMetal,
} from "@/lib/blofin-metals";
import { fetchBlofinSwapTickersCached, type BlofinSwapTicker } from "@/lib/blofin-public-cache";
import type { Candle } from "@/lib/hyperliquid";

const TICK_TTL_MS = 60 * 60 * 1000;
const tickByInst = new Map<string, { tick: number; at: number }>();
const tickInflight = new Map<string, Promise<number | null>>();

/** Blofin tickSize for a scalp symbol (SOL → SOL-USDT). Cached ~1h. */
export async function getNovaScalpTickSize(symbol: string): Promise<number | null> {
  const instId = toBlofinInstId(symbol).toUpperCase();
  const now = Date.now();
  const hit = tickByInst.get(instId);
  if (hit && now - hit.at < TICK_TTL_MS) return hit.tick;

  const pending = tickInflight.get(instId);
  if (pending) return pending;

  const promise = (async () => {
    try {
      const inst = await getBlofinInstrument(instId);
      const tick = inst?.tickSize ? Number(inst.tickSize) : NaN;
      if (!Number.isFinite(tick) || tick <= 0) return null;
      tickByInst.set(instId, { tick, at: Date.now() });
      return tick;
    } catch {
      return null;
    } finally {
      tickInflight.delete(instId);
    }
  })();

  tickInflight.set(instId, promise);
  return promise;
}

export async function getNovaScalpCandles(
  symbol: string,
  hlInterval: string,
  limit: number
): Promise<Candle[]> {
  if (isBlofinMetal(symbol)) {
    return getBlofinMetalCandles(symbol as BlofinMetal, hlInterval, limit);
  }
  const instId = toBlofinInstId(symbol);
  const rows = await getBlofinCandles(instId, toBlofinBar(hlInterval), limit);
  return rows as Candle[];
}

export async function getNovaScalpTicker(symbol: string): Promise<{ last: string } | null> {
  if (isBlofinMetal(symbol)) {
    return getBlofinMetalTicker(symbol as BlofinMetal);
  }
  return getBlofinTicker(toBlofinInstId(symbol));
}

function parseUsdtBase(instId: string): string | null {
  if (!instId.endsWith("-USDT")) return null;
  const base = instId.slice(0, -"-USDT".length).trim().toUpperCase();
  return base || null;
}

function tickerToTrendingPerp(t: BlofinSwapTicker): TrendingPerp | null {
  const coin = parseUsdtBase(t.instId);
  if (!coin) return null;
  const last = Number(t.last);
  const open = Number(t.open24h);
  if (!Number.isFinite(last) || last <= 0 || !Number.isFinite(open) || open <= 0) return null;
  const dayPct = ((last - open) / open) * 100;
  return {
    coin,
    markPx: String(last),
    prevDayPx: String(open),
    dayPct,
    dayNtlVlm: String(t.volCurrency24h ?? "0"),
    openInterest: "0",
  };
}

/** Resolve a Blofin USDT swap by base (e.g. SNXX) for tools that import Blofin positions. */
export async function getBlofinTrendingPerpBySymbol(symbol: string): Promise<TrendingPerp | null> {
  const base = String(symbol ?? "")
    .trim()
    .toUpperCase()
    .replace(/-USDT$/i, "")
    .split(/[\/\-\s]/)[0];
  if (!base) return null;

  const { data: tickers } = await fetchBlofinSwapTickersCached();
  for (const t of tickers) {
    const row = tickerToTrendingPerp(t);
    if (row?.coin === base) return row;
  }

  try {
    const ticker = await getBlofinTicker(toBlofinInstId(base));
    const last = ticker?.last ? Number(ticker.last) : NaN;
    if (!Number.isFinite(last) || last <= 0) return null;
    return {
      coin: base,
      markPx: String(last),
      prevDayPx: String(last),
      dayPct: 0,
      dayNtlVlm: "0",
      openInterest: "0",
    };
  } catch {
    return null;
  }
}

/**
 * Quick Wins universe from Blofin: priority majors/alts that list on Blofin + top movers by |24h %|.
 */
export async function resolveNovaScalpQuickWinUniverse(limit = 32): Promise<TrendingPerp[]> {
  const { data: tickers } = await fetchBlofinSwapTickersCached();
  const byCoin = new Map<string, TrendingPerp>();
  for (const t of tickers) {
    const row = tickerToTrendingPerp(t);
    if (!row) continue;
    byCoin.set(row.coin, row);
  }

  const out: TrendingPerp[] = [];
  const seen = new Set<string>();
  for (const coin of TOP_ALTCOINS) {
    const row = byCoin.get(coin.toUpperCase());
    if (!row || seen.has(row.coin)) continue;
    seen.add(row.coin);
    out.push(row);
  }

  const movers = [...byCoin.values()]
    .filter((p) => !seen.has(p.coin))
    .sort((a, b) => Math.abs(b.dayPct) - Math.abs(a.dayPct));

  for (const row of movers) {
    if (out.length >= limit) break;
    seen.add(row.coin);
    out.push(row);
  }

  return out.slice(0, limit);
}
