/**
 * Pip size / pip value for Nova Pulse Calculate PnL and MT bots.
 * Desk conventions — confirm on your broker; metals especially differ (point vs pip).
 */
import {
  forexContractSize,
  isEquityCfdSymbol,
  isIndexCfdSymbol,
} from "@/lib/forex-lot-size";
import { normalizeForexSymbol } from "@/lib/forex-market";

/** Pip size by instrument family — JPY pairs 0.01, metals 0.1, indices 1.0, equities 0.01, else 0.0001. */
export function pipSizeForForexSymbol(symbol: string): number {
  const s = normalizeForexSymbol(symbol);
  if (isEquityCfdSymbol(s)) return 0.01;
  if (
    isIndexCfdSymbol(s) ||
    /^(NAS100|US30|SPX500|US100|UK100|GER40|JPN225)/.test(s)
  ) {
    return 1.0;
  }
  if (s.includes("JPY")) return 0.01;
  if (s === "XAUUSD" || s === "XAGUSD") return 0.1;
  return 0.0001;
}

export function pipsToPrice(symbol: string, pips: number): number {
  return pips * pipSizeForForexSymbol(symbol);
}

export function priceDistanceToPips(symbol: string, from: number, to: number): number {
  const pip = pipSizeForForexSymbol(symbol);
  if (!(pip > 0) || !Number.isFinite(from) || !Number.isFinite(to)) return 0;
  return (to - from) / pip;
}

function quoteCurrency(symbol: string): string {
  const s = normalizeForexSymbol(symbol);
  if (s.length >= 6 && /^[A-Z]{6,}$/.test(s)) return s.slice(3, 6);
  if (isIndexCfdSymbol(s) || isEquityCfdSymbol(s) || s === "XAUUSD" || s === "XAGUSD") return "USD";
  return "USD";
}

/**
 * Approximate USD value of 1 pip on 1.0 lot.
 * XXXUSD / metals / indices / equities: quote is USD.
 * USDJPY / USDCHF / USDCAD: divide by price (quote per 1 USD).
 * EURJPY etc.: divide by usdJpy when provided, else a conservative 150 fallback.
 */
export function pipValueUsdPerLot(
  symbol: string,
  price: number,
  opts?: { usdJpy?: number | null }
): number {
  const s = normalizeForexSymbol(symbol);
  const pip = pipSizeForForexSymbol(s);
  const contract = forexContractSize(s);
  const rawQuote = pip * contract;
  if (!(rawQuote > 0) || !(price > 0)) return 0;

  const quote = quoteCurrency(s);
  if (quote === "USD" || isIndexCfdSymbol(s) || isEquityCfdSymbol(s)) return rawQuote;
  if (s === "USDJPY" || (s.startsWith("USD") && s.length === 6 && quote !== "USD")) {
    return rawQuote / price;
  }
  if (quote === "JPY") {
    const usdJpy =
      opts?.usdJpy != null && Number.isFinite(opts.usdJpy) && opts.usdJpy > 0 ? opts.usdJpy : null;
    if (usdJpy) return rawQuote / usdJpy;
    return rawQuote / 150;
  }
  return rawQuote;
}

export function lotsBreakdown(
  lots: number,
  symbol?: string
): {
  units: number;
  standardLots: number;
  miniLots: number;
  microLots: number;
} {
  const n = Math.max(0, Number(lots) || 0);
  const contract = symbol ? forexContractSize(symbol) : 100_000;
  return {
    units: n * contract,
    standardLots: n,
    miniLots: n * 10,
    microLots: n * 100,
  };
}
