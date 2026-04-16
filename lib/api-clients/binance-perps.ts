const BINANCE_FUTURES_24H = "https://fapi.binance.com/fapi/v1/ticker/24hr";
const BINANCE_FUTURES_KLINES = "https://fapi.binance.com/fapi/v1/klines";

export type BinancePerpTicker = {
  symbol: string;
  priceChangePercent: string;
  lastPrice: string;
  volume: string;
  quoteVolume: string;
};

export type PerpRadarItem = {
  exchange: "binance" | "hyperliquid";
  symbol: string;
  base: string;
  quote: string;
  change24hPct: number;
  lastPrice: number;
  volume24h: number;
  quoteVolume24h: number;
  pct5m?: number;
  pct15m?: number;
  pct30m?: number;
  pct1h?: number;
  pct4h?: number;
};

/** Fetch one kline and return % change (open to close). Returns null on error or 451. */
async function fetchBinanceKlinePct(symbol: string, interval: string): Promise<number | null> {
  try {
    const url = `${BINANCE_FUTURES_KLINES}?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=2`;
    const res = await fetch(url, { cache: "no-store", headers: { "User-Agent": "NovaStaris/1.0 (https://novastaris.ai)" } });
    if (!res.ok) return null;
    const arr = (await res.json()) as Array<[number, string, string, string, string, ...string[]]>;
    if (!Array.isArray(arr) || arr.length < 1) return null;
    const c = arr[0];
    const open = Number(c?.[1]);
    const close = Number(c?.[4]);
    if (!Number.isFinite(open) || !Number.isFinite(close) || open === 0) return null;
    return ((close - open) / open) * 100;
  } catch {
    return null;
  }
}

/** Enrich up to `maxItems` with 5m, 15m, 30m, 1h, 4h from Binance klines. Skips on 451. */
export async function enrichPerpRadarWithKlines(items: PerpRadarItem[], maxItems: number): Promise<PerpRadarItem[]> {
  const toEnrich = items.slice(0, maxItems);
  const intervals = ["5m", "15m", "30m", "1h", "4h"] as const;
  const enriched = await Promise.all(
    toEnrich.map(async (item) => {
      const [pct5m, pct15m, pct30m, pct1h, pct4h] = await Promise.all(
        intervals.map((int) => fetchBinanceKlinePct(item.symbol, int))
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

/** Macro-related perp bases (energy, metals, indices). */
const MACRO_BASES = /^(CRUDE|XBR|OIL|WTI|BRENT|CL|NG|NATURALGAS|GAS|XAU|GOLD|XAG|SILVER|SPX|SPX500|SP500|NDX|NAS100|DJI|US30)$/i;
const METALS_BASES = /^(XAU|GOLD|XAG|SILVER)$/i;
/** Pinned macro symbols should always be visible in macro view (even if change/volume filters would hide them). */
const PINNED_MACRO_BASES = /^(XAU|XAG|SPX)$/i;
const PINNED_METALS_BASES = /^(XAU|XAG)$/i;

/** Fetch high-level perp stats from Binance USDT-margined futures for radar. */
export async function getBinancePerpRadar(options?: {
  minChangePct?: number;
  minQuoteVolume?: number;
  limit?: number;
  category?: "macro" | "metals";
}): Promise<PerpRadarItem[]> {
  const minChangePct = options?.minChangePct ?? 3; // 3%+ movers so list is usually non-empty
  const minQuoteVolume = options?.minQuoteVolume ?? 100_000; // $100k+ notional
  const limit = Math.min(options?.limit ?? 150, 200);
  const macroOnly = options?.category === "macro";
  const metalsOnly = options?.category === "metals";

  const res = await fetch(BINANCE_FUTURES_24H, {
    cache: "no-store",
    headers: { "User-Agent": "NovaStaris/1.0 (https://novastaris.ai)" },
  });
  if (res.status === 451) throw new Error("BINANCE_451: Binance restricts API access from this server's region. Use «Load from my browser» if you're in an allowed region, or try Trending perps (Hyperliquid) for similar movers.");
  if (!res.ok) throw new Error(`Binance API error: ${res.status}`);
  const data = (await res.json()) as BinancePerpTicker[] | BinancePerpTicker | { code?: number; msg?: string };
  if (data && typeof data === "object" && !Array.isArray(data) && ("code" in data || "msg" in data)) {
    const msg = "msg" in data && typeof (data as { msg?: string }).msg === "string" ? (data as { msg: string }).msg : `Binance error`;
    throw new Error(msg);
  }
  const arr: BinancePerpTicker[] = Array.isArray(data) ? data : [data as BinancePerpTicker];
  const out: PerpRadarItem[] = [];
  for (const t of arr) {
    if (!t?.symbol?.endsWith("USDT")) continue;
    const base = t.symbol.replace("USDT", "");
    if (macroOnly && !MACRO_BASES.test(base)) continue;
    if (metalsOnly && !METALS_BASES.test(base)) continue;

    const change = Number(t.priceChangePercent ?? "0");
    const quoteVol = Number(t.quoteVolume ?? "0");
    if (!Number.isFinite(change) || !Number.isFinite(quoteVol)) continue;
    const forceIncludePinnedMacro = macroOnly && PINNED_MACRO_BASES.test(base);
    const forceIncludePinnedMetals = metalsOnly && PINNED_METALS_BASES.test(base);
    if (!macroOnly && !metalsOnly && (Math.abs(change) < minChangePct || quoteVol < minQuoteVolume)) continue;
    if (macroOnly && !forceIncludePinnedMacro && quoteVol < (options?.minQuoteVolume ?? 0)) continue;
    if (metalsOnly && !forceIncludePinnedMetals && quoteVol < (options?.minQuoteVolume ?? 0)) continue;

    const last = Number(t.lastPrice ?? "0");
    const vol = Number(t.volume ?? "0");
    if (!Number.isFinite(last) || !Number.isFinite(vol)) continue;

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

