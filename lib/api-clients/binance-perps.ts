const BINANCE_FUTURES_24H = "https://fapi.binance.com/fapi/v1/ticker/24hr";

export type BinancePerpTicker = {
  symbol: string;
  priceChangePercent: string;
  lastPrice: string;
  volume: string;
  quoteVolume: string;
};

export type PerpRadarItem = {
  exchange: "binance";
  symbol: string;
  base: string;
  quote: string;
  change24hPct: number;
  lastPrice: number;
  volume24h: number;
  quoteVolume24h: number;
};

/** Fetch high-level perp stats from Binance USDT-margined futures for radar. */
export async function getBinancePerpRadar(options?: {
  minChangePct?: number;
  minQuoteVolume?: number;
  limit?: number;
}): Promise<PerpRadarItem[]> {
  const minChangePct = options?.minChangePct ?? 3; // 3%+ movers so list is usually non-empty
  const minQuoteVolume = options?.minQuoteVolume ?? 100_000; // $100k+ notional
  const limit = options?.limit ?? 80;

  const res = await fetch(BINANCE_FUTURES_24H, { cache: "no-store" });
  if (!res.ok) return [];
  const data = (await res.json()) as BinancePerpTicker[] | BinancePerpTicker;
  const arr = Array.isArray(data) ? data : [data];

  const out: PerpRadarItem[] = [];
  for (const t of arr) {
    // Only USDT perps
    if (!t.symbol.endsWith("USDT")) continue;
    const change = Number(t.priceChangePercent ?? "0");
    const quoteVol = Number(t.quoteVolume ?? "0");
    if (!Number.isFinite(change) || !Number.isFinite(quoteVol)) continue;
    if (Math.abs(change) < minChangePct || quoteVol < minQuoteVolume) continue;

    const last = Number(t.lastPrice ?? "0");
    const vol = Number(t.volume ?? "0");
    if (!Number.isFinite(last) || !Number.isFinite(vol)) continue;

    const base = t.symbol.replace("USDT", "");
    out.push({
      exchange: "binance",
      symbol: t.symbol,
      base,
      quote: "USDT",
      change24hPct: change,
      lastPrice: last,
      volume24h: vol,
      quoteVolume24h: quoteVol,
    });
  }

  out.sort((a, b) => Math.abs(b.change24hPct) - Math.abs(a.change24hPct));
  return out.slice(0, limit);
}

