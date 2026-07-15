/**
 * Hand-off from Nova Scalp → NovaQ (crypto or forex).
 * Prefills the symbol and opens the NovaQ tab; auto-runs analysis on load.
 */

import {
  openScalpHandoffUrl,
  readScalpHandoffNavPref,
  type ScalpHandoffNavMode,
} from "@/lib/nova-scalp-handoff-nav";

export const NOVA_Q_PREFILL_KEY = "novastaris_nova_q_prefill";
export const NOVA_Q_PREFILL_EVENT = "novastaris-nova-q-prefill";

export type NovaQPrefill = {
  symbol: string;
  market: "crypto" | "forex";
  /** Prefer including the scalp timeframe in NovaQ TF selection. */
  timeframeId?: string;
  source: string;
  createdAt: string;
};

export function novaQHandoffUrl(market: "crypto" | "forex" = "crypto"): string {
  return market === "forex"
    ? "/?tab=nova-forex&forex=nova-q"
    : "/?tab=nova-forecast&forecast=nova-q";
}

export function readNovaQPrefill(): NovaQPrefill | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(NOVA_Q_PREFILL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NovaQPrefill;
    if (!parsed?.symbol?.trim()) return null;
    if (parsed.market !== "crypto" && parsed.market !== "forex") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeNovaQPrefill(prefill: NovaQPrefill | null): void {
  if (typeof window === "undefined") return;
  if (!prefill) {
    sessionStorage.removeItem(NOVA_Q_PREFILL_KEY);
  } else {
    sessionStorage.setItem(NOVA_Q_PREFILL_KEY, JSON.stringify(prefill));
  }
  window.dispatchEvent(new CustomEvent(NOVA_Q_PREFILL_EVENT));
}

export function clearNovaQPrefill(): void {
  writeNovaQPrefill(null);
}

/**
 * Stash symbol and open NovaQ.
 * Pass `navMode` when the UI already resolved preference; otherwise uses saved pref or new tab.
 */
export function sendSymbolToNovaQ(
  input: {
    symbol: string;
    market?: "crypto" | "forex";
    timeframeId?: string;
    source?: string;
  },
  navMode?: ScalpHandoffNavMode
): void {
  const market = input.market ?? "crypto";
  writeNovaQPrefill({
    symbol: String(input.symbol ?? "").trim().toUpperCase(),
    market,
    timeframeId: input.timeframeId,
    source: input.source ?? "Nova Scalp",
    createdAt: new Date().toISOString(),
  });
  const mode = navMode ?? readScalpHandoffNavPref() ?? "new_tab";
  openScalpHandoffUrl(novaQHandoffUrl(market), mode);
}
