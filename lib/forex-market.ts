/**
 * Forex / CFD / index symbols (Market Watch style) with OHLC via Yahoo Finance chart API.
 * Aligns with common FOREX.com / TradingView tickers where possible.
 */
import type { Candle } from "@/lib/hyperliquid";

export type ForexSymbolEntry = {
  symbol: string;
  label: string;
  category: "forex" | "index" | "stock" | "metal";
  yahoo: string;
  venueNote: string;
};

/** Curated list — expandable; user can also type any symbol we can map. */
export const FOREX_MARKET_WATCH: ForexSymbolEntry[] = [
  { symbol: "XAUUSD", label: "Gold vs US Dollar", category: "metal", yahoo: "GC=F", venueNote: "Gold futures proxy (COMEX GC). Compare with broker XAUUSD spot." },
  { symbol: "XAGUSD", label: "Silver vs US Dollar", category: "metal", yahoo: "SI=F", venueNote: "Silver futures proxy (COMEX SI). Compare with broker XAGUSD spot." },
  { symbol: "EURUSD", label: "Euro vs US Dollar", category: "forex", yahoo: "EURUSD=X", venueNote: "Major FX pair." },
  { symbol: "GBPUSD", label: "British Pound vs USD", category: "forex", yahoo: "GBPUSD=X", venueNote: "Major FX pair." },
  { symbol: "USDJPY", label: "US Dollar vs Yen", category: "forex", yahoo: "USDJPY=X", venueNote: "Major FX pair." },
  { symbol: "AUDUSD", label: "Australian Dollar vs USD", category: "forex", yahoo: "AUDUSD=X", venueNote: "Major FX pair." },
  { symbol: "USDCAD", label: "US Dollar vs Canadian Dollar", category: "forex", yahoo: "USDCAD=X", venueNote: "Major FX pair." },
  { symbol: "NAS100", label: "Nasdaq 100", category: "index", yahoo: "NQ=F", venueNote: "Nasdaq 100 E-mini futures proxy (Yahoo)." },
  { symbol: "US30", label: "Dow Jones 30", category: "index", yahoo: "YM=F", venueNote: "Dow mini futures proxy (Yahoo)." },
  { symbol: "SPX500", label: "S&P 500", category: "index", yahoo: "ES=F", venueNote: "S&P 500 E-mini futures proxy (Yahoo)." },
  { symbol: "TSLA", label: "Tesla Motors", category: "stock", yahoo: "TSLA", venueNote: "NASDAQ equity." },
  { symbol: "AAPL", label: "Apple", category: "stock", yahoo: "AAPL", venueNote: "NASDAQ equity." },
  { symbol: "NVDA", label: "Nvidia", category: "stock", yahoo: "NVDA", venueNote: "NASDAQ equity." },
  { symbol: "SHOP", label: "Shopify Inc", category: "stock", yahoo: "SHOP", venueNote: "NYSE equity." },
];

const BY_SYMBOL = new Map(FOREX_MARKET_WATCH.map((e) => [e.symbol, e]));

const ALIASES: Record<string, string> = {
  GOLD: "XAUUSD",
  XAU: "XAUUSD",
  SILVER: "XAGUSD",
  XAG: "XAGUSD",
  NASDAQ: "NAS100",
  US100: "NAS100",
  DJ30: "US30",
  DOW: "US30",
  SP500: "SPX500",
  SPX: "SPX500",
  TESLA: "TSLA",
  APPLE: "AAPL",
  NVIDIA: "NVDA",
  SHOPIFY: "SHOP",
};

export function normalizeForexSymbol(raw: string): string {
  const upper = String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9]/g, "");
  if (!upper) return "";
  if (ALIASES[upper]) return ALIASES[upper];
  if (BY_SYMBOL.has(upper)) return upper;
  if (upper.endsWith("USD") && upper.length >= 6 && upper.length <= 7) return upper;
  return upper;
}

export function resolveForexEntry(symbol: string): ForexSymbolEntry | null {
  const key = normalizeForexSymbol(symbol);
  return BY_SYMBOL.get(key) ?? null;
}

/** Yahoo ticker for unknown 6–7 letter FX pairs (EURUSD → EURUSD=X). */
export function resolveYahooTicker(symbol: string): string | null {
  const key = normalizeForexSymbol(symbol);
  const entry = BY_SYMBOL.get(key);
  if (entry) return entry.yahoo;
  if (/^[A-Z]{6,7}$/.test(key) && key.endsWith("USD")) return `${key}=X`;
  if (/^[A-Z]{1,5}$/.test(key)) return key;
  return null;
}

export function forexContractDescription(symbol: string): string {
  const entry = resolveForexEntry(symbol);
  if (entry) return `${entry.symbol} (${entry.label}): ${entry.venueNote} Data via Yahoo Finance chart API (reference prices; your broker may differ).`;
  const yahoo = resolveYahooTicker(symbol);
  if (yahoo) return `${symbol}: OHLC from Yahoo (${yahoo}). Reference only—not live FOREX.com feed.`;
  return `${symbol}: Symbol not in the Market Watch catalog. Try XAUUSD, EURUSD, NAS100, TSLA, etc.`;
}

type IntervalMap = { yahooInterval: string; range: string };

function mapHlIntervalToYahoo(hlInterval: string, limit: number): IntervalMap {
  const n = Math.max(1, limit);
  switch (hlInterval) {
    case "1m":
      if (n <= 60) return { yahooInterval: "1m", range: "1d" };
      return { yahooInterval: "1m", range: "5d" };
    case "5m":
      return { yahooInterval: "5m", range: n <= 48 ? "5d" : "1mo" };
    case "15m":
      return { yahooInterval: "15m", range: n <= 96 ? "5d" : "1mo" };
    case "1h":
      return { yahooInterval: "1h", range: n <= 168 ? "1mo" : "3mo" };
    case "1d":
      if (n <= 30) return { yahooInterval: "1d", range: "1mo" };
      if (n <= 90) return { yahooInterval: "1d", range: "3mo" };
      if (n <= 180) return { yahooInterval: "1d", range: "6mo" };
      return { yahooInterval: "1d", range: "2y" };
    default:
      return { yahooInterval: "15m", range: "5d" };
  }
}

function toHlCandle(ts: number, o: number, h: number, l: number, c: number, v: number): Candle {
  return [
    String(ts),
    String(o),
    String(h),
    String(l),
    String(c),
    String(v),
    "0",
    "0",
    "0",
  ];
}

export async function getForexCandles(
  symbol: string,
  hlInterval: string,
  limit: number,
  rangeOverride?: string
): Promise<Candle[]> {
  const key = normalizeForexSymbol(symbol);
  const yahoo = resolveYahooTicker(key);
  if (!yahoo) throw new Error(`Unknown forex symbol: ${symbol}. Pick from Market Watch or try XAUUSD, EURUSD, NAS100.`);

  const { yahooInterval, range } = rangeOverride
    ? { yahooInterval: mapHlIntervalToYahoo(hlInterval, limit).yahooInterval, range: rangeOverride }
    : mapHlIntervalToYahoo(hlInterval, limit);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahoo)}?interval=${yahooInterval}&range=${range}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; NovaStaris/1.0)" },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Market data unavailable for ${key} (${res.status}).`);
  const json = (await res.json()) as {
    chart?: {
      result?: Array<{
        timestamp?: number[];
        indicators?: { quote?: Array<{ open?: number[]; high?: number[]; low?: number[]; close?: number[]; volume?: number[] }> };
      }>;
    };
  };
  const result = json.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const quote = result?.indicators?.quote?.[0];
  if (!quote || timestamps.length === 0) throw new Error(`No candle data for ${key}.`);

  const rows: Candle[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const o = quote.open?.[i];
    const h = quote.high?.[i];
    const l = quote.low?.[i];
    const c = quote.close?.[i];
    if (o == null || h == null || l == null || c == null || !Number.isFinite(c)) continue;
    rows.push(toHlCandle(timestamps[i]! * 1000, o, h, l, c, quote.volume?.[i] ?? 0));
  }
  rows.reverse();
  return rows.slice(0, Math.max(1, limit));
}

export async function getForexTicker(symbol: string): Promise<{ last: string } | null> {
  const candles = await getForexCandles(symbol, "1m", 2).catch(() => null);
  if (!candles?.length) return null;
  const last = Number(candles[0]![4]);
  if (!Number.isFinite(last)) return null;
  return { last: String(last) };
}

export const FOREX_FORECAST_DEFAULT_SYMBOLS = FOREX_MARKET_WATCH.map((e) => e.symbol);
