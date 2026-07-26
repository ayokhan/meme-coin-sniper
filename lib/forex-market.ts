/**
 * Forex / CFD / index symbols with OHLC via Yahoo Finance, with **spot calibration**
 * for XAUUSD / XAGUSD (Swissquote live mid) so levels align with TradingView / broker spot.
 */
import type { Candle } from "@/lib/hyperliquid";
import {
  calibrateCandlesToSpotMid,
  getForexSpotMid,
  usesSpotCalibration,
} from "@/lib/forex-spot-feed";

export type ForexSymbolEntry = {
  symbol: string;
  label: string;
  category: "forex" | "index" | "stock" | "metal";
  yahoo: string;
  venueNote: string;
};

/** Plan / UI leverage cap for Nova Forex Scalp (MT accounts often use 1:500–1:2000). */
export const FOREX_SCALP_MAX_LEVERAGE = 2000;

/** Curated list — expandable; user can also type any symbol we can map. */
export const FOREX_MARKET_WATCH: ForexSymbolEntry[] = [
  { symbol: "XAUUSD", label: "Gold vs US Dollar", category: "metal", yahoo: "GC=F", venueNote: "Live mid prefers your connected MT broker when linked; else Swissquote spot mid. OHLC shape from Yahoo GC=F, level-shifted to that mid. TradingView may differ if you chart another broker." },
  { symbol: "XAGUSD", label: "Silver vs US Dollar", category: "metal", yahoo: "SI=F", venueNote: "Live mid prefers your connected MT broker when linked; else Swissquote spot mid. OHLC shape from Yahoo SI=F, level-shifted to that mid." },
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

/** Crypto perp tickers — not valid on Nova Forex Scalp (Yahoo "BTC" ≠ Bitcoin). */
const CRYPTO_PERP_SYMBOLS = new Set([
  "BTC",
  "ETH",
  "SOL",
  "DOGE",
  "XRP",
  "ADA",
  "AVAX",
  "LINK",
  "BNB",
  "MATIC",
  "DOT",
  "UNI",
  "ATOM",
  "LTC",
  "BCH",
  "NEAR",
  "APT",
  "ARB",
  "OP",
  "SUI",
  "PEPE",
  "WIF",
  "BONK",
]);

export function validateForexScalpSymbol(raw: string): { ok: true; symbol: string } | { ok: false; error: string } {
  const symbol = normalizeForexSymbol(raw);
  if (!symbol) {
    return { ok: false, error: "Enter a symbol (e.g. XAUUSD, EURUSD, NAS100)." };
  }
  if (CRYPTO_PERP_SYMBOLS.has(symbol)) {
    return {
      ok: false,
      error: `${symbol} is a crypto perp — use NovaForecast → Nova Scalp for ${symbol}. Nova Forex Scalp is for gold, FX, indices, and stocks (XAUUSD, EURUSD, NAS100, TSLA).`,
    };
  }
  if (!resolveYahooTicker(symbol)) {
    return {
      ok: false,
      error: `Unknown symbol ${symbol}. Use Market Watch symbols: XAUUSD, EURUSD, NAS100, TSLA, etc.`,
    };
  }
  return { ok: true, symbol };
}

export function isForexMarketWatchSymbol(raw: string): boolean {
  const key = normalizeForexSymbol(raw);
  return !!key && (BY_SYMBOL.has(key) || (!!resolveYahooTicker(key) && !CRYPTO_PERP_SYMBOLS.has(key)));
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
  if (entry) {
    const via = usesSpotCalibration(entry.symbol)
      ? "Yahoo OHLC + Swissquote spot calibration"
      : "Yahoo Finance chart API";
    return `${entry.symbol} (${entry.label}): ${entry.venueNote} Data via ${via}.`;
  }
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
  rangeOverride?: string,
  /** When set (e.g. broker mid), calibrate metal OHLC to this instead of Swissquote alone. */
  spotMidOverride?: number | null
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
  let out = rows.slice(0, Math.max(1, limit));

  if (usesSpotCalibration(key)) {
    const spotMid =
      spotMidOverride != null && Number.isFinite(spotMidOverride) && spotMidOverride > 0
        ? spotMidOverride
        : await getForexSpotMid(key);
    if (spotMid != null) out = calibrateCandlesToSpotMid(out, spotMid);
  }

  return out;
}

export async function getForexTicker(symbol: string): Promise<{ last: string } | null> {
  const candles = await getForexCandles(symbol, "1m", 2).catch(() => null);
  if (!candles?.length) return null;
  const last = Number(candles[0]![4]);
  if (!Number.isFinite(last)) return null;
  return { last: String(last) };
}

export const FOREX_FORECAST_DEFAULT_SYMBOLS = FOREX_MARKET_WATCH.map((e) => e.symbol);
