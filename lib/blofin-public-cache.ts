/**
 * Shared Blofin public-market cache + gentle rate limiting.
 * Prevents 429s from auto-refresh / parallel candle enrichment hammering Blofin.
 */

import type { Candle } from "@/lib/blofin";

export type BlofinSwapTicker = {
  instId: string;
  last: string;
  open24h: string;
  high24h: string;
  low24h: string;
  volCurrency24h: string;
  vol24h: string;
};

const LIVE_BASE = "https://openapi.blofin.com";
const BLOFIN_SWAP_TICKERS = `${LIVE_BASE}/api/v1/market/tickers?instType=SWAP`;
const USER_AGENT = "NovaStaris/1.0 (https://novastaris.ai)";

const TICKER_TTL_MS = 90_000;
const STALE_SERVE_MS = 10 * 60_000;
const CANDLE_TTL_MS = 90_000;

let tickerCache: { data: BlofinSwapTicker[]; at: number } | null = null;
let tickerInflight: Promise<{ data: BlofinSwapTicker[]; stale: boolean }> | null = null;

const candleCache = new Map<string, { data: Candle[]; at: number }>();
const candleInflight = new Map<string, Promise<Candle[]>>();

let activeSlots = 0;
const MAX_CONCURRENT = 6;
const slotQueue: Array<() => void> = [];

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  while (activeSlots >= MAX_CONCURRENT) {
    await new Promise<void>((resolve) => slotQueue.push(resolve));
  }
  activeSlots++;
  try {
    return await fn();
  } finally {
    activeSlots--;
    const next = slotQueue.shift();
    if (next) next();
  }
}

export async function fetchBlofinSwapTickersCached(): Promise<{ data: BlofinSwapTicker[]; stale: boolean }> {
  const now = Date.now();
  if (tickerCache && now - tickerCache.at < TICKER_TTL_MS) {
    return { data: tickerCache.data, stale: false };
  }
  if (tickerInflight) return tickerInflight;

  tickerInflight = (async () => {
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await withSlot(() =>
            fetch(BLOFIN_SWAP_TICKERS, {
              cache: "no-store",
              headers: { "User-Agent": USER_AGENT },
            })
          );

          if (res.status === 429) {
            if (tickerCache && Date.now() - tickerCache.at < STALE_SERVE_MS) {
              return { data: tickerCache.data, stale: true };
            }
            await sleep(800 * (attempt + 1));
            continue;
          }

          if (!res.ok) {
            if (tickerCache && Date.now() - tickerCache.at < STALE_SERVE_MS) {
              return { data: tickerCache.data, stale: true };
            }
            throw new Error(`Blofin tickers error: ${res.status}`);
          }

          const json = (await res.json()) as { code?: string; data?: BlofinSwapTicker[] };
          if (json.code !== "0" || !Array.isArray(json.data)) {
            if (tickerCache && Date.now() - tickerCache.at < STALE_SERVE_MS) {
              return { data: tickerCache.data, stale: true };
            }
            return { data: [], stale: false };
          }

          tickerCache = { data: json.data, at: Date.now() };
          return { data: json.data, stale: false };
        } catch (e) {
          if (tickerCache && Date.now() - tickerCache.at < STALE_SERVE_MS) {
            return { data: tickerCache.data, stale: true };
          }
          if (attempt === 2) throw e;
          await sleep(600 * (attempt + 1));
        }
      }

      if (tickerCache) return { data: tickerCache.data, stale: true };
      throw new Error("Blofin tickers error: 429");
    } finally {
      tickerInflight = null;
    }
  })();

  return tickerInflight;
}

/** Cached Blofin candles (public market API). */
export async function fetchBlofinCandlesCached(instId: string, bar: string, limit = 1): Promise<Candle[]> {
  const key = `${instId}:${bar}:${limit}`;
  const now = Date.now();
  const hit = candleCache.get(key);
  if (hit && now - hit.at < CANDLE_TTL_MS) return hit.data;

  const pending = candleInflight.get(key);
  if (pending) return pending;

  const promise = (async () => {
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        const url = `${LIVE_BASE}/api/v1/market/candles?instId=${encodeURIComponent(instId)}&bar=${encodeURIComponent(bar)}&limit=${limit}`;
        const res = await withSlot(() =>
          fetch(url, { cache: "no-store", headers: { "User-Agent": USER_AGENT } })
        );

        if (res.status === 429) {
          if (hit) return hit.data;
          await sleep(500 * (attempt + 1));
          continue;
        }

        if (!res.ok) {
          if (hit) return hit.data;
          return [];
        }

        const json = (await res.json()) as { code?: string; data?: Candle[] };
        const data = json.code === "0" && Array.isArray(json.data) ? json.data : [];
        candleCache.set(key, { data, at: Date.now() });
        return data;
      }
      return hit?.data ?? [];
    } finally {
      candleInflight.delete(key);
    }
  })();

  candleInflight.set(key, promise);
  return promise;
}
