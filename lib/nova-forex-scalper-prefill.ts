/**
 * Hand-off from Nova Forex forecast/scalp tools to the Nova Forex Scalper bot.
 * Mirrors lib/nova-scalper-prefill.ts but for forex/MT4/MT5 (lotSize instead of USD margin).
 */

import {
  openScalpHandoffUrl,
  readScalpHandoffNavPref,
  type ScalpHandoffNavMode,
} from "@/lib/nova-scalp-handoff-nav";

export const NOVA_FOREX_SCALPER_PREFILL_KEY = "novastaris_nova_forex_scalper_prefill";
export const NOVA_FOREX_SCALPER_PREFILL_EVENT = "novastaris-nova-forex-scalper-prefill";
/** Prefills older than this are ignored and wiped (stops “ghost” handoffs after refresh). */
export const NOVA_FOREX_SCALPER_PREFILL_MAX_AGE_MS = 10 * 60 * 1000;

export const NOVA_FOREX_SCALPER_HANDOFF_URL = "/?tab=nova-forex-bot&forex=scalp-bot";

export type ForexScalperEntryTrigger = "cross_down" | "cross_up" | "immediate";

export type NovaForexScalperPrefill = {
  /** Forex/CFD symbol as shown in Nova Forex (e.g. "EURUSD", "XAUUSD", "NAS100"). */
  symbol: string;
  side: "long" | "short";
  entryPrice: number;
  /** Take-profit / exit target. */
  exitPrice: number;
  stopLossPrice: number | null;
  /**
   * Optional starting lot estimate. Prefer omitting this and letting the Scalper
   * size from marginUsd × real MT account leverage after connect.
   */
  lotSize?: number;
  /** Plan margin from Nova Forex Scalp Agent (USD) — shown on the bot for context / re-size. */
  marginUsd?: number;
  /** Plan leverage from Nova Forex Scalp Agent — fallback only until MT leverage loads. */
  leverage?: number;
  /** When "immediate", enter on next tick (agent said enter now / at entry zone). */
  entryTrigger?: ForexScalperEntryTrigger;
  /** Human-readable origin, e.g. "Nova Forex Agent" or "Nova Forex Fib". */
  source: string;
  createdAt: string;
};

/**
 * Long dips into entry (cross down); short rallies into entry (cross up).
 * When the agent says market / at-entry, use immediate so the bot doesn't wait for a re-cross.
 */
export function forexScalperEntryTriggerFor(
  side: "long" | "short",
  opts?: { entryMode?: "limit" | "market" | null; enterNow?: boolean }
): ForexScalperEntryTrigger {
  if (opts?.enterNow || opts?.entryMode === "market") return "immediate";
  return side === "long" ? "cross_down" : "cross_up";
}

function parseNovaForexScalperPrefill(raw: string | null): NovaForexScalperPrefill | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as NovaForexScalperPrefill;
    if (!parsed?.symbol || (parsed.side !== "long" && parsed.side !== "short")) return null;
    if (!Number.isFinite(parsed.entryPrice) || !Number.isFinite(parsed.exitPrice)) return null;
    const created = parsed.createdAt ? Date.parse(parsed.createdAt) : NaN;
    // Missing createdAt → treat as expired (legacy ghost entries after refresh)
    if (!Number.isFinite(created) || Date.now() - created > NOVA_FOREX_SCALPER_PREFILL_MAX_AGE_MS) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function readNovaForexScalperPrefill(): NovaForexScalperPrefill | null {
  if (typeof window === "undefined") return null;
  const fromSession = parseNovaForexScalperPrefill(sessionStorage.getItem(NOVA_FOREX_SCALPER_PREFILL_KEY));
  if (fromSession) return fromSession;
  const fromLocal = parseNovaForexScalperPrefill(localStorage.getItem(NOVA_FOREX_SCALPER_PREFILL_KEY));
  if (fromLocal) return fromLocal;
  // Wipe any expired / corrupt leftover so refresh doesn't resurrect a handoff banner
  try {
    sessionStorage.removeItem(NOVA_FOREX_SCALPER_PREFILL_KEY);
    localStorage.removeItem(NOVA_FOREX_SCALPER_PREFILL_KEY);
  } catch {
    /* ignore */
  }
  return null;
}

export function writeNovaForexScalperPrefill(prefill: NovaForexScalperPrefill | null): void {
  if (typeof window === "undefined") return;
  if (!prefill) {
    sessionStorage.removeItem(NOVA_FOREX_SCALPER_PREFILL_KEY);
    try {
      localStorage.removeItem(NOVA_FOREX_SCALPER_PREFILL_KEY);
    } catch {
      /* ignore */
    }
  } else {
    const json = JSON.stringify({
      ...prefill,
      createdAt: prefill.createdAt || new Date().toISOString(),
    });
    sessionStorage.setItem(NOVA_FOREX_SCALPER_PREFILL_KEY, json);
    try {
      localStorage.setItem(NOVA_FOREX_SCALPER_PREFILL_KEY, json);
    } catch {
      /* ignore */
    }
  }
  window.dispatchEvent(new CustomEvent(NOVA_FOREX_SCALPER_PREFILL_EVENT));
}

export function clearNovaForexScalperPrefill(): void {
  writeNovaForexScalperPrefill(null);
}

export function hasNovaForexScalperPrefill(): boolean {
  return readNovaForexScalperPrefill() != null;
}

/**
 * Stash the trade and open Nova Forex → Scalper Bot.
 * Pass `navMode` when the UI already resolved preference; otherwise uses saved pref or new tab.
 */
export function sendTradeToNovaForexScalper(
  prefill: NovaForexScalperPrefill,
  navMode?: ScalpHandoffNavMode
): void {
  writeNovaForexScalperPrefill(prefill);
  const mode = navMode ?? readScalpHandoffNavPref() ?? "new_tab";
  openScalpHandoffUrl(NOVA_FOREX_SCALPER_HANDOFF_URL, mode);
}
