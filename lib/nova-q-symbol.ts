/**
 * Client-side symbol normalize + light autocomplete for NovaQ / Fib.
 * Server venues still decide listing; this only reduces typos and aliases.
 */

import { normalizeMetalBase } from "@/lib/blofin-metals";

export type NovaQSymbolSuggestion = {
  symbol: string;
  /** Alternative spellings that match this card. */
  aliases?: string[];
  label?: string;
  group: "major" | "crypto" | "metal" | "recent" | "favorite";
};

/** Curated typeahead seed (not a full exchange universe). */
export const NOVA_Q_SYMBOL_CATALOG: NovaQSymbolSuggestion[] = [
  { symbol: "BTC", aliases: ["BITCOIN", "XBT"], label: "Bitcoin", group: "major" },
  { symbol: "ETH", aliases: ["ETHEREUM"], label: "Ethereum", group: "major" },
  { symbol: "SOL", aliases: ["SOLANA"], label: "Solana", group: "major" },
  { symbol: "XAU", aliases: ["GOLD", "XAUUSD", "XAUUSDM"], label: "Gold (Blofin)", group: "metal" },
  { symbol: "XAG", aliases: ["SILVER", "XAGUSD"], label: "Silver (Blofin)", group: "metal" },
  { symbol: "PAXG", aliases: ["PAXGOLD"], label: "Paxos Gold (HL)", group: "metal" },
  { symbol: "BNB", group: "crypto" },
  { symbol: "DOGE", group: "crypto" },
  { symbol: "HYPE", group: "crypto" },
  { symbol: "SUI", group: "crypto" },
  { symbol: "AVAX", group: "crypto" },
  { symbol: "LINK", group: "crypto" },
  { symbol: "ARB", group: "crypto" },
  { symbol: "OP", group: "crypto" },
  { symbol: "INJ", group: "crypto" },
  { symbol: "TIA", group: "crypto" },
  { symbol: "WIF", group: "crypto" },
  { symbol: "PEPE", group: "crypto" },
  { symbol: "WLD", group: "crypto" },
  { symbol: "AAVE", group: "crypto" },
  { symbol: "SPCX", label: "SPCX (Blofin)", group: "crypto" },
  { symbol: "kPEPE", group: "crypto" },
  { symbol: "kBONK", group: "crypto" },
  { symbol: "SEI", group: "crypto" },
  { symbol: "APT", group: "crypto" },
  { symbol: "NEAR", group: "crypto" },
  { symbol: "ATOM", group: "crypto" },
  { symbol: "DOT", group: "crypto" },
  { symbol: "LTC", group: "crypto" },
  { symbol: "XRP", group: "crypto" },
  { symbol: "TRX", group: "crypto" },
  { symbol: "ADA", group: "crypto" },
  { symbol: "TON", group: "crypto" },
  { symbol: "FIL", group: "crypto" },
];

/** Normalize user input for NovaQ / Fib (quotes, perps, metals). */
export function normalizeNovaQSymbol(raw: string): string {
  return normalizeMetalBase(raw);
}

/** True when free text rewritten to a canonical base (show a subtle hint). */
export function novaQSymbolRewriteNote(raw: string): string | null {
  const input = String(raw ?? "").trim().toUpperCase();
  if (!input) return null;
  const next = normalizeNovaQSymbol(input);
  if (!next || next === input) return null;
  return `Using ${next}`;
}

function matchesSuggestion(q: string, item: NovaQSymbolSuggestion): boolean {
  if (!q) return true;
  if (item.symbol.includes(q) || item.symbol.startsWith(q)) return true;
  if (item.label?.toUpperCase().includes(q)) return true;
  return (item.aliases ?? []).some((a) => a.includes(q) || q.includes(a));
}

/**
 * Ranked suggestions for the typeahead. `extras` = favorites/recents symbols.
 * Always includes free-typed candidate when non-empty and not already listed.
 */
export function searchNovaQSymbolSuggestions(
  query: string,
  extras: { symbol: string; group: "recent" | "favorite" }[] = [],
  limit = 10
): NovaQSymbolSuggestion[] {
  const q = normalizeNovaQSymbol(query) || String(query ?? "").trim().toUpperCase();
  const seen = new Set<string>();
  const out: NovaQSymbolSuggestion[] = [];

  const push = (item: NovaQSymbolSuggestion) => {
    if (!item.symbol || seen.has(item.symbol)) return;
    seen.add(item.symbol);
    out.push(item);
  };

  // Prefer extras that match query first
  for (const e of extras) {
    const sym = normalizeNovaQSymbol(e.symbol) || e.symbol.trim().toUpperCase();
    if (!sym) continue;
    if (q && !sym.includes(q) && !q.includes(sym)) continue;
    push({ symbol: sym, group: e.group });
  }

  const catalogHits = NOVA_Q_SYMBOL_CATALOG.filter((c) => matchesSuggestion(q, c));
  // Prefer exact / prefix hits
  catalogHits.sort((a, b) => {
    const as = a.symbol === q ? 0 : a.symbol.startsWith(q) ? 1 : 2;
    const bs = b.symbol === q ? 0 : b.symbol.startsWith(q) ? 1 : 2;
    if (as !== bs) return as - bs;
    return a.symbol.localeCompare(b.symbol);
  });
  for (const c of catalogHits) push(c);

  if (q && !seen.has(q)) {
    push({ symbol: q, label: "Run this symbol", group: "crypto" });
  }

  return out.slice(0, limit);
}

/** Soft unknown helper (client-only copy before run). */
export function softUnknownSymbolNote(symbol: string): string | null {
  const s = normalizeNovaQSymbol(symbol);
  if (!s) return "Enter a contract base (e.g. BTC).";
  // Forex-looking pairs are on Nova Forex, not HL/Blofin crypto rails
  if (/^[A-Z]{6}$/.test(s) && (s.endsWith("USD") || s.endsWith("EUR") || s.endsWith("JPY"))) {
    if (s === "XAUUSD" || s === "XAGUSD") return null; // normalized earlier
    return `${s} looks like a forex pair — try Nova Forex Agent, or metals XAU / XAG here.`;
  }
  if (s === "EURUSD" || s === "NAS100" || s === "US30" || s === "SPX500") {
    return `${s} is for Nova Forex Agent / brokers, not Hyperliquid/Blofin NovaQ.`;
  }
  if (NOVA_Q_SYMBOL_CATALOG.some((c) => c.symbol === s)) return null;
  return null; // don't scare every rare legitimate ticker
}
