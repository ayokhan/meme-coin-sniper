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

/**
 * Suffixes brokers append after the Nova root ticker (e.g. NVDA → NVDAOQ, XAUUSD → XAUUSDM).
 * Must NOT treat unrelated tickers as matches (no free startsWith between AAPL and NVDA).
 */
const BROKER_SUFFIX_RE =
  /^(M|PRO|RAW|ECN|CASH|SPOT|US|NAS|NYS|NYSE|OQ|N|A|B|C|I|S|F|_|#|\d+)*$/i;

/**
 * True if broker symbol `raw` is the same instrument as Nova `baseRaw`
 * (exact key, alias list, or base + broker suffix only).
 */
export function forexSymbolsMatch(a: string, b: string): boolean {
  const ka = forexSymbolKey(a);
  const kb = forexSymbolKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  const shorter = ka.length <= kb.length ? ka : kb;
  const longer = ka.length <= kb.length ? kb : ka;
  // Require full ticker root (min 3) + only a known broker-style suffix on the longer form
  if (shorter.length < 3) return false;
  if (!longer.startsWith(shorter)) return false;
  const suffix = longer.slice(shorter.length);
  if (!suffix) return true;
  return BROKER_SUFFIX_RE.test(suffix);
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
    NVDA: [
      "NVDA",
      "NVIDIA",
      "NVDA.US",
      "NVDA.NAS",
      "NVDA.OQ",
      ".NVDA.OQ",
      "NVDAm",
      "NVDA.",
      "NVDA#",
      "#NVDA",
      "NVDA.cash",
    ],
    TSLA: [
      "TSLA",
      "TESLA",
      "TSLA.US",
      "TSLA.NAS",
      "TSLA.OQ",
      ".TSLA.OQ",
      "TSLAm",
      "TSLA.",
      "TSLA#",
      "#TSLA",
      "TSLA.cash",
    ],
    AAPL: [
      "AAPL",
      "APPLE",
      "AAPL.US",
      "AAPL.NAS",
      "AAPL.OQ",
      ".AAPL.OQ",
      "AAPLm",
      "AAPL.",
      "AAPL#",
      "#AAPL",
      "AAPL.cash",
    ],
    SHOP: ["SHOP", "SHOPIFY", "SHOP.US", "SHOP.NYSE", "SHOPm", "SHOP.", "SHOP#", "#SHOP", "SHOP.cash"],
  };

  const list = extras[s] ?? [s, `${s}m`, `${s}.`, `${s}#`, `#${s}`, `${s}.US`, `${s}.cash`, `${s}.OQ`, `.${s}.OQ`];
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
  const aliases = forexBrokerSymbolAliases(novaSymbol);
  const aliasKeys = new Set(aliases.map((a) => forexSymbolKey(a)));
  const upperList = brokerSymbols.map((s) => ({ raw: s, u: s.toUpperCase(), key: forexSymbolKey(s) }));

  for (const a of aliases) {
    const aKey = forexSymbolKey(a);
    const exact = upperList.find((x) => x.u === a.toUpperCase() || x.key === aKey);
    if (exact) return exact.raw;
  }

  const base = normalizeForexSymbol(novaSymbol);
  const baseKey = forexSymbolKey(base);
  if (!baseKey) return null;

  const loose = upperList.find((x) => {
    if (aliasKeys.has(x.key)) return true;
    return forexSymbolsMatch(x.raw, base);
  });
  return loose?.raw ?? null;
}
