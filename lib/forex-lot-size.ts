/**
 * Approximate MT4/MT5 lot size from USD margin × leverage.
 * Brokers differ on contract size — treat this as a starting estimate; users can edit lots.
 * Prefer quantizeForexLots with live MetaAPI symbol specification when placing orders.
 *
 * Important: MT account leverage (e.g. 1:2000) is usually **FX max**. Stocks / indices use
 * much lower margin leverage — we cap effective leverage so $10 margin does not estimate
 * 60+ lots of AAPL.
 */
import { normalizeForexSymbol } from "@/lib/forex-market";

/** Standard contract size (units per 1.0 lot) for common CFD symbols. */
export function forexContractSize(symbolRaw: string): number {
  const s = normalizeForexSymbol(symbolRaw) || String(symbolRaw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  // Metals (including broker suffixes like XAUUSDM, GOLD.m stripped via normalize)
  if (s === "XAUUSD" || s.startsWith("XAU") || s === "GOLD" || s.includes("GOLD")) return 100; // 100 oz
  if (s === "XAGUSD" || s.startsWith("XAG") || s === "SILVER" || s.includes("SILVER")) return 5000;
  if (s === "NAS100" || s === "US30" || s === "SPX500" || s.includes("NAS") || s.includes("USTEC")) return 1;
  if (s === "TSLA" || s === "AAPL" || s === "NVDA" || s === "SHOP") return 1;
  // Majors / most FX: 100,000 base units per lot
  if (s.length === 6 && /^[A-Z]{6}$/.test(s)) return 100_000;
  return 100_000;
}

const EQUITY_CFD = new Set(["TSLA", "AAPL", "NVDA", "SHOP"]);
const INDEX_CFD = new Set(["NAS100", "US30", "SPX500"]);

/** Broker single-name stock CFDs (volume often ≈ shares). */
export function isEquityCfdSymbol(symbolRaw: string): boolean {
  const s = normalizeForexSymbol(symbolRaw) || String(symbolRaw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return EQUITY_CFD.has(s);
}

export function isIndexCfdSymbol(symbolRaw: string): boolean {
  const s = normalizeForexSymbol(symbolRaw) || String(symbolRaw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (INDEX_CFD.has(s)) return true;
  return s.includes("NAS") || s.includes("USTEC") || s.includes("US30") || s.includes("SPX");
}

/**
 * Cap leverage used for lot estimates. Account 1:2000 on Vantage-style books is for FX;
 * equity CFDs are typically ~1:5–1:20 and indices ~1:50–1:200.
 */
export function effectiveSizingLeverage(symbolRaw: string, accountLeverage: number): number {
  const lev = Math.max(1, Number(accountLeverage) || 1);
  if (isEquityCfdSymbol(symbolRaw)) return Math.min(lev, 20);
  if (isIndexCfdSymbol(symbolRaw)) return Math.min(lev, 100);
  return lev;
}

export type ForexVolumeRules = {
  minVolume?: number;
  maxVolume?: number;
  volumeStep?: number;
  /** Broker contract size (units per 1.0 lot). Overrides forexContractSize when set. */
  contractSize?: number;
};

/**
 * Clamp and snap lots to broker volumeStep / min / max.
 * Returns 0 if even minVolume is not representable.
 */
export function quantizeForexLots(rawLots: number, rules?: ForexVolumeRules): number {
  const minV = Math.max(0.01, Number(rules?.minVolume) || 0.01);
  const maxV = Math.max(minV, Number(rules?.maxVolume) || 100);
  const step = Math.max(0.01, Number(rules?.volumeStep) || 0.01);
  if (!Number.isFinite(rawLots) || rawLots <= 0) return 0;
  // Floor to step so we never exceed intended size / affordability
  let lots = Math.floor(rawLots / step + 1e-9) * step;
  // Fix float noise (e.g. 0.30000000004)
  const stepDigits = Math.min(8, Math.max(0, Math.ceil(-Math.log10(step)) + 1));
  lots = Number(lots.toFixed(stepDigits));
  if (lots < minV) {
    // Only bump to min if raw was at least min (caller wanted a real size)
    if (rawLots + 1e-9 >= minV) lots = minV;
    else return 0;
  }
  if (lots > maxV) lots = Math.floor(maxV / step + 1e-9) * step;
  lots = Number(lots.toFixed(stepDigits));
  if (lots < minV || lots <= 0) return 0;
  return lots;
}

function contractFor(symbol: string, rules?: ForexVolumeRules): number {
  const c = Number(rules?.contractSize);
  if (Number.isFinite(c) && c > 0) return c;
  return forexContractSize(symbol);
}

/**
 * lots ≈ (marginUsd × effectiveLeverage) / (contractSize × entryPrice)
 * Floored to broker volume step (default 0.01).
 */
export function estimateForexLotsFromMargin(input: {
  symbol: string;
  entryPrice: number;
  marginUsd: number;
  leverage: number;
  rules?: ForexVolumeRules;
  /** Set true to skip equity/index leverage caps (rare). */
  useRawAccountLeverage?: boolean;
}): number {
  const price = Number(input.entryPrice);
  const margin = Math.max(0, Number(input.marginUsd));
  const accountLev = Math.max(1, Number(input.leverage) || 1);
  const lev = input.useRawAccountLeverage
    ? accountLev
    : effectiveSizingLeverage(input.symbol, accountLev);
  if (!Number.isFinite(price) || price <= 0 || margin <= 0) {
    return quantizeForexLots(0.01, input.rules) || 0.01;
  }
  const contract = contractFor(input.symbol, input.rules);
  const notional = margin * lev;
  const raw = notional / (contract * price);
  const lots = quantizeForexLots(raw, input.rules);
  return lots > 0 ? lots : quantizeForexLots(0.01, input.rules) || 0.01;
}

/** Inverse estimate: margin ≈ (lots × contractSize × price) / effectiveLeverage */
export function estimateForexMarginFromLots(input: {
  symbol: string;
  entryPrice: number;
  lotSize: number;
  leverage: number;
  rules?: ForexVolumeRules;
  useRawAccountLeverage?: boolean;
}): number {
  const price = Number(input.entryPrice);
  const lots = Math.max(0.01, Number(input.lotSize) || 0.01);
  const accountLev = Math.max(1, Number(input.leverage) || 1);
  const lev = input.useRawAccountLeverage
    ? accountLev
    : effectiveSizingLeverage(input.symbol, accountLev);
  if (!Number.isFinite(price) || price <= 0) return 0;
  const contract = contractFor(input.symbol, input.rules);
  const notional = lots * contract * price;
  return Math.round((notional / lev) * 100) / 100;
}

/**
 * Largest volume-step lot size that fits in freeMargin (uses ~90% buffer for broker padding).
 * Returns 0 if even min lots won't fit.
 */
export function maxForexLotsForFreeMargin(input: {
  symbol: string;
  entryPrice: number;
  freeMarginUsd: number;
  leverage: number;
  /** Fraction of free margin to use (default 0.9). */
  buffer?: number;
  rules?: ForexVolumeRules;
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
    rules: input.rules,
  });
  const minLot = quantizeForexLots(Number(input.rules?.minVolume) || 0.01, input.rules) || 0.01;
  const needMin = estimateForexMarginFromLots({
    symbol: input.symbol,
    entryPrice: price,
    lotSize: minLot,
    leverage: lev,
    rules: input.rules,
  });
  if (needMin > usable) return 0;
  return raw;
}

/** Round price to tick size (for SL/TP). */
export function roundForexPriceToTick(price: number, tickSize?: number, digits?: number): number {
  if (!Number.isFinite(price) || price <= 0) return price;
  if (tickSize != null && Number.isFinite(tickSize) && tickSize > 0) {
    const n = Math.round(price / tickSize) * tickSize;
    const d =
      digits != null && Number.isFinite(digits)
        ? Math.max(0, Math.min(8, Math.floor(digits)))
        : Math.min(8, Math.max(0, Math.ceil(-Math.log10(tickSize)) + 1));
    return Number(n.toFixed(d));
  }
  if (digits != null && Number.isFinite(digits)) {
    return Number(price.toFixed(Math.max(0, Math.min(8, Math.floor(digits)))));
  }
  return price;
}
