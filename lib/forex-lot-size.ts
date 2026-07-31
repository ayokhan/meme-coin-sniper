/**
 * Approximate MT4/MT5 lot size from USD margin × leverage.
 * Brokers differ on contract size — treat this as a starting estimate; users can edit lots.
 */
import { normalizeForexSymbol } from "@/lib/forex-market";

/** Standard contract size (units per 1.0 lot) for common CFD symbols. */
export function forexContractSize(symbolRaw: string): number {
  const s = normalizeForexSymbol(symbolRaw);
  if (s === "XAUUSD") return 100; // 100 oz
  if (s === "XAGUSD") return 5000;
  if (s === "NAS100" || s === "US30" || s === "SPX500") return 1;
  if (s === "TSLA" || s === "AAPL" || s === "NVDA" || s === "SHOP") return 1;
  // Majors / most FX: 100,000 base units per lot
  return 100_000;
}

/**
 * lots ≈ (marginUsd × leverage) / (contractSize × entryPrice)
 * Floored to 0.01 lot minimum (common MT step).
 */
export function estimateForexLotsFromMargin(input: {
  symbol: string;
  entryPrice: number;
  marginUsd: number;
  leverage: number;
}): number {
  const price = Number(input.entryPrice);
  const margin = Math.max(0, Number(input.marginUsd));
  const lev = Math.max(1, Number(input.leverage) || 1);
  if (!Number.isFinite(price) || price <= 0 || margin <= 0) return 0.01;
  const contract = forexContractSize(input.symbol);
  const notional = margin * lev;
  const raw = notional / (contract * price);
  const lots = Math.floor(raw * 100) / 100; // 0.01 step
  return Math.max(0.01, lots || 0.01);
}

/** Inverse estimate: margin ≈ (lots × contractSize × price) / leverage */
export function estimateForexMarginFromLots(input: {
  symbol: string;
  entryPrice: number;
  lotSize: number;
  leverage: number;
}): number {
  const price = Number(input.entryPrice);
  const lots = Math.max(0.01, Number(input.lotSize) || 0.01);
  const lev = Math.max(1, Number(input.leverage) || 1);
  if (!Number.isFinite(price) || price <= 0) return 0;
  const contract = forexContractSize(input.symbol);
  const notional = lots * contract * price;
  return Math.round((notional / lev) * 100) / 100;
}

/**
 * Largest 0.01-step lot size that fits in freeMargin (uses ~90% buffer for broker padding).
 * Returns 0 if even 0.01 lots won't fit.
 */
export function maxForexLotsForFreeMargin(input: {
  symbol: string;
  entryPrice: number;
  freeMarginUsd: number;
  leverage: number;
  /** Fraction of free margin to use (default 0.9). */
  buffer?: number;
}): number {
  const price = Number(input.entryPrice);
  const free = Math.max(0, Number(input.freeMarginUsd));
  const lev = Math.max(1, Number(input.leverage) || 1);
  const buffer = input.buffer ?? 0.9;
  if (!Number.isFinite(price) || price <= 0 || free <= 0) return 0;
  const usable = free * buffer;
  const raw = estimateForexLotsFromMargin({
    symbol: input.symbol,
    entryPrice: price,
    marginUsd: usable,
    leverage: lev,
  });
  // estimateForexLotsFromMargin floors to min 0.01 — verify 0.01 actually fits
  const needMin = estimateForexMarginFromLots({
    symbol: input.symbol,
    entryPrice: price,
    lotSize: 0.01,
    leverage: lev,
  });
  if (needMin > usable) return 0;
  return raw;
}

