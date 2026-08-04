/**
 * Map Nova Forex symbols → names commonly used on MT4/MT5 brokers (Vantage, TIO, Assex, etc.).
 * Order matters: first match that MetaAPI can price wins.
 */

import { normalizeForexSymbol } from "@/lib/forex-market";

/** Alphanumeric upper key so XAUUSD.m / XAUUSDm / xauusd# compare equal enough. */
export function forexSymbolKey(raw: string): string {
  return String(raw ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/** True if two broker/Nova symbols refer to the same instrument (suffix-tolerant). */
export function forexSymbolsMatch(a: string, b: string): boolean {
  const ka = forexSymbolKey(a);
  const kb = forexSymbolKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  // GOLD vs XAUUSD, USTEC vs NAS100 handled via alias sets at call sites; prefix still helps .US suffixes
  if (ka.startsWith(kb) || kb.startsWith(ka)) return true;
  return false;
}

/** Candidate broker symbol strings for a Nova Market Watch symbol. */
export function forexBrokerSymbolAliases(symbolRaw: string): string[] {
  const s = normalizeForexSymbol(symbolRaw) || String(symbolRaw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!s) return [];

  const extras: Record<string, string[]> = {
    XAUUSD: ["XAUUSD", "GOLD", "XAUUSDm", "XAUUSD.", "XAUUSD.s", "GOLD.", "XAUUSD#"],
    XAGUSD: ["XAGUSD", "SILVER", "XAGUSDm", "XAGUSD.", "XAGUSD.s", "SILVER.", "XAGUSD#"],
    NAS100: ["NAS100", "USTEC", "US100", "NAS100.cash", "NAS100m", "NAS100.", "UT100", "NAS100#"],
    US30: ["US30", "DJ30", "US30.cash", "US30m", "WallStreet", "US30.", "US30#", "DOW"],
    SPX500: ["SPX500", "US500", "SPX500.cash", "SPX500m", "SPX500.", "US500.", "SPX500#"],
    EURUSD: ["EURUSD", "EURUSDm", "EURUSD.", "EURUSD#"],
    GBPUSD: ["GBPUSD", "GBPUSDm", "GBPUSD.", "GBPUSD#"],
    USDJPY: ["USDJPY", "USDJPYm", "USDJPY.", "USDJPY#"],
    AUDUSD: ["AUDUSD", "AUDUSDm", "AUDUSD.", "AUDUSD#"],
    USDCAD: ["USDCAD", "USDCADm", "USDCAD.", "USDCAD#"],
    NVDA: ["NVDA", "NVIDIA", "NVDA.US", "NVDA.NAS", "NVDAm", "NVDA.", "NVDA#", "#NVDA", "NVDA.cash"],
    TSLA: ["TSLA", "TESLA", "TSLA.US", "TSLA.NAS", "TSLAm", "TSLA.", "TSLA#", "#TSLA", "TSLA.cash"],
    AAPL: ["AAPL", "APPLE", "AAPL.US", "AAPL.NAS", "AAPLm", "AAPL.", "AAPL#", "#AAPL", "AAPL.cash"],
    SHOP: ["SHOP", "SHOPIFY", "SHOP.US", "SHOP.NYSE", "SHOPm", "SHOP.", "SHOP#", "#SHOP", "SHOP.cash"],
  };

  const list = extras[s] ?? [s, `${s}m`, `${s}.`, `${s}#`, `#${s}`, `${s}.US`, `${s}.cash`];
  // Dedupe, preserve order
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of list) {
    const t = String(x).trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/**
 * Pick the best symbol from a broker's symbol list that matches our Nova symbol.
 * Returns null if nothing looks tradeable on this account.
 */
export function matchForexSymbolOnBroker(
  novaSymbol: string,
  brokerSymbols: string[]
): string | null {
  const aliases = forexBrokerSymbolAliases(novaSymbol).map((a) => a.toUpperCase());
  const aliasSet = new Set(aliases);
  const upperList = brokerSymbols.map((s) => ({ raw: s, u: s.toUpperCase() }));

  for (const a of aliases) {
    const exact = upperList.find((x) => x.u === a);
    if (exact) return exact.raw;
  }

  const base = normalizeForexSymbol(novaSymbol).toUpperCase();
  if (!base) return null;

  // e.g. broker has "NVDA.n" or "NVDA_US" containing our base as a token
  const loose = upperList.find((x) => {
    if (aliasSet.has(x.u)) return true;
    const stripped = x.u.replace(/[^A-Z0-9]/g, "");
    if (stripped === base || stripped.startsWith(base)) return true;
    // "USTEC" already covered via aliases for NAS100
    return false;
  });
  return loose?.raw ?? null;
}
