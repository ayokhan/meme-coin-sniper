import type { PerpRadarItem } from "@/lib/api-clients/binance-perps";
import {
  fetchBlofinCandlesCached,
  fetchBlofinSwapTickersCached,
  type BlofinSwapTicker,
} from "@/lib/blofin-public-cache";

export type { BlofinSwapTicker };

/** Always visible in Blofin Perp Radar (even when not top movers). */
const PINNED_BLOFIN_BASES = new Set(["SPCX", "XAU", "XAG"]);

function parseUsdtInstId(instId: string): { base: string; quote: string } | null {
  if (!instId.endsWith("-USDT")) return null;
  const base = instId.slice(0, -"-USDT".length).trim();
  if (!base) return null;
  return { base, quote: "USDT" };
}

function blofinCandlePct(candles: Array<[string, string, string, string, string, ...string[]]>): number | null {
  const c = candles[0];
  if (!c?.[1] || !c?.[4]) return null;
  const open = Number(c[1]);
  const close = Number(c[4]);
  return open > 0 ? ((close - open) / open) * 100 : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function fetchBlofinSwapTickers(): Promise<BlofinSwapTicker[]> {
  const { data } = await fetchBlofinSwapTickersCached();
  return data;
}

/** Blofin USDT-margined swap movers for Perp Radar. */
export async function getBlofinPerpRadar(options?: {
  minChangePct?: number;
  minQuoteVolume?: number;
  limit?: number;
}): Promise<{ items: PerpRadarItem[]; stale: boolean }> {
  const minChangePct = options?.minChangePct ?? 3;
  const minQuoteVolume = options?.minQuoteVolume ?? 50_000;
  const limit = Math.min(options?.limit ?? 150, 200);

  const { data: tickers, stale } = await fetchBlofinSwapTickersCached();
  const movers: PerpRadarItem[] = [];
  const pinned: PerpRadarItem[] = [];

  for (const t of tickers) {
    const parsed = parseUsdtInstId(t.instId);
    if (!parsed) continue;

    const last = Number(t.last);
    const open = Number(t.open24h);
    const quoteVol = Number(t.volCurrency24h ?? 0);
    if (!Number.isFinite(last) || last <= 0 || !Number.isFinite(open) || open <= 0) continue;

    const change24hPct = ((last - open) / open) * 100;
    const isPinned = PINNED_BLOFIN_BASES.has(parsed.base);
    if (!isPinned && (Math.abs(change24hPct) < minChangePct || quoteVol < minQuoteVolume)) continue;

    const item = blofinTickerToItem(t);
    if (!item) continue;
    if (isPinned) pinned.push(item);
    else movers.push(item);
  }

  movers.sort((a, b) => Math.abs(b.change24hPct) - Math.abs(a.change24hPct));

  const seen = new Set<string>();
  const merged: PerpRadarItem[] = [];
  for (const row of [...pinned, ...movers]) {
    if (seen.has(row.base)) continue;
    seen.add(row.base);
    merged.push(row);
  }
  return { items: merged.slice(0, limit), stale };
}

function blofinTickerToItem(t: BlofinSwapTicker): PerpRadarItem | null {
  const parsed = parseUsdtInstId(t.instId);
  if (!parsed) return null;
  const last = Number(t.last);
  const open = Number(t.open24h);
  const quoteVol = Number(t.volCurrency24h ?? 0);
  if (!Number.isFinite(last) || last <= 0 || !Number.isFinite(open) || open <= 0) return null;
  const change24hPct = ((last - open) / open) * 100;
  return {
    exchange: "blofin",
    symbol: `${parsed.base}/${parsed.quote}`,
    base: parsed.base,
    quote: parsed.quote,
    change24hPct,
    lastPrice: last,
    volume24h: Number(t.vol24h ?? 0) || 0,
    quoteVolume24h: quoteVol,
  };
}

/** Load specific Blofin bases (e.g. user favorites) even when they are not top movers. */
export async function getBlofinPerpItemsByBases(bases: string[]): Promise<{ items: PerpRadarItem[]; stale: boolean }> {
  const want = new Set(bases.map((b) => b.trim().toUpperCase()).filter(Boolean));
  if (want.size === 0) return { items: [], stale: false };

  const { data: tickers, stale } = await fetchBlofinSwapTickersCached();
  const items: PerpRadarItem[] = [];
  for (const t of tickers) {
    const item = blofinTickerToItem(t);
    if (!item || !want.has(item.base)) continue;
    items.push(item);
    want.delete(item.base);
  }
  return { items, stale };
}

async function enrichOneBlofinItem(item: PerpRadarItem): Promise<PerpRadarItem> {
  const instId = `${item.base}-USDT`;
  const intervals = ["5m", "15m", "30m", "1h", "4h"] as const;
  const pcts: Partial<Record<(typeof intervals)[number], number | null>> = {};
  for (const int of intervals) {
    try {
      const candles = await fetchBlofinCandlesCached(instId, int, 1);
      pcts[int] = blofinCandlePct(candles);
    } catch {
      pcts[int] = null;
    }
  }
  return {
    ...item,
    pct5m: pcts["5m"] ?? undefined,
    pct15m: pcts["15m"] ?? undefined,
    pct30m: pcts["30m"] ?? undefined,
    pct1h: pcts["1h"] ?? undefined,
    pct4h: pcts["4h"] ?? undefined,
  };
}

/** Enrich top rows with 5m–4h % from Blofin candles (batched to avoid 429). */
export async function enrichBlofinPerpRadarWithKlines(items: PerpRadarItem[], maxItems: number): Promise<PerpRadarItem[]> {
  const head = items.slice(0, maxItems);
  const tail = items.slice(maxItems);
  const enriched: PerpRadarItem[] = [];
  const batchSize = 4;

  for (let i = 0; i < head.length; i += batchSize) {
    const batch = head.slice(i, i + batchSize);
    const part = await Promise.all(batch.map((item) => enrichOneBlofinItem(item)));
    enriched.push(...part);
    if (i + batchSize < head.length) await sleep(120);
  }

  return [...enriched, ...tail];
}
