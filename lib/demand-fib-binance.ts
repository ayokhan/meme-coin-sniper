import type { Candle } from "@/lib/demand-zone-fib-strategy";

const KLINES = "https://fapi.binance.com/fapi/v1/klines";
const PREMIUM = "https://fapi.binance.com/fapi/v1/premiumIndex";

/** Normalize user input: BTC/USDT, btc-usdt → BTCUSDT (Binance USDT-M). */
export function normalizePerpSymbol(input: string): string {
  let s = input.trim().toUpperCase().replace(/[/\s-]/g, "");
  if (/(USDT|USDC|BUSD)$/i.test(s)) return s;
  return `${s}USDT`;
}

export async function fetchBinanceFuturesKlines(
  symbol: string,
  interval: string,
  limit: number
): Promise<Candle[]> {
  const url = `${KLINES}?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=${limit}`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: { "User-Agent": "NovaStaris/1.0 (https://novastaris.ai)" },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(res.status === 400 ? `Invalid symbol or pair not on Binance USDT-M (${symbol}).` : `Klines ${res.status}: ${t.slice(0, 120)}`);
  }
  const raw = (await res.json()) as number[][];
  if (!Array.isArray(raw)) throw new Error("Unexpected klines response.");
  return raw.map((row) => ({
    time: Math.floor(Number(row[0]) / 1000),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5]),
  }));
}

export async function fetchFundingRate(symbol: string): Promise<number | undefined> {
  try {
    const url = `${PREMIUM}?symbol=${encodeURIComponent(symbol)}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return undefined;
    const j = (await res.json()) as { lastFundingRate?: string };
    const r = j.lastFundingRate != null ? Number(j.lastFundingRate) : NaN;
    return Number.isFinite(r) ? r : undefined;
  } catch {
    return undefined;
  }
}
