import { getCandles as getBlofinCandles } from "@/lib/blofin";
import type { PerpRadarItem } from "@/lib/api-clients/binance-perps";

const BLOFIN_SWAP_TICKERS = "https://openapi.blofin.com/api/v1/market/tickers?instType=SWAP";

export type BlofinSwapTicker = {
  instId: string;
  last: string;
  open24h: string;
  high24h: string;
  low24h: string;
  volCurrency24h: string;
  vol24h: string;
};

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

export async function fetchBlofinSwapTickers(): Promise<BlofinSwapTicker[]> {
  const res = await fetch(BLOFIN_SWAP_TICKERS, {
    cache: "no-store",
    headers: { "User-Agent": "NovaStaris/1.0 (https://novastaris.ai)" },
  });
  if (!res.ok) throw new Error(`Blofin tickers error: ${res.status}`);
  const json = (await res.json()) as { code?: string; data?: BlofinSwapTicker[] };
  if (json.code !== "0" || !Array.isArray(json.data)) return [];
  return json.data;
}

/** Blofin USDT-margined swap movers for Perp Radar. */
export async function getBlofinPerpRadar(options?: {
  minChangePct?: number;
  minQuoteVolume?: number;
  limit?: number;
}): Promise<PerpRadarItem[]> {
  const minChangePct = options?.minChangePct ?? 3;
  const minQuoteVolume = options?.minQuoteVolume ?? 50_000;
  const limit = Math.min(options?.limit ?? 150, 200);

  const tickers = await fetchBlofinSwapTickers();
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

    const item: PerpRadarItem = {
      exchange: "blofin",
      symbol: `${parsed.base}/${parsed.quote}`,
      base: parsed.base,
      quote: parsed.quote,
      change24hPct,
      lastPrice: last,
      volume24h: Number(t.vol24h ?? 0) || 0,
      quoteVolume24h: quoteVol,
    };
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
  return merged.slice(0, limit);
}

/** Enrich top rows with 5m–4h % from Blofin candles. */
export async function enrichBlofinPerpRadarWithKlines(items: PerpRadarItem[], maxItems: number): Promise<PerpRadarItem[]> {
  const head = items.slice(0, maxItems);
  const intervals = ["5m", "15m", "30m", "1h", "4h"] as const;
  const enriched = await Promise.all(
    head.map(async (item) => {
      const instId = `${item.base}-USDT`;
      const [pct5m, pct15m, pct30m, pct1h, pct4h] = await Promise.all(
        intervals.map(async (int) => {
          try {
            const candles = await getBlofinCandles(instId, int, 1);
            return blofinCandlePct(candles);
          } catch {
            return null;
          }
        })
      );
      return {
        ...item,
        pct5m: pct5m ?? undefined,
        pct15m: pct15m ?? undefined,
        pct30m: pct30m ?? undefined,
        pct1h: pct1h ?? undefined,
        pct4h: pct4h ?? undefined,
      };
    })
  );
  return [...enriched, ...items.slice(maxItems)];
}
