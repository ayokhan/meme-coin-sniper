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

export const NOVA_FOREX_SCALPER_HANDOFF_URL = "/?tab=nova-forex-bot&forex=scalp-bot";

export type NovaForexScalperPrefill = {
  /** Forex/CFD symbol as shown in Nova Forex (e.g. "EURUSD", "XAUUSD", "NAS100"). */
  symbol: string;
  side: "long" | "short";
  entryPrice: number;
  /** Take-profit / exit target. */
  exitPrice: number;
  stopLossPrice: number | null;
  /** MT4/MT5 lot size to open with. */
  lotSize: number;
  /** Plan margin from Nova Forex Scalp Agent (USD) — shown on the bot for context / re-size. */
  marginUsd?: number;
  /** Plan leverage from Nova Forex Scalp Agent — display / re-size only (MT leverage is account-level). */
  leverage?: number;
  /** Human-readable origin, e.g. "Nova Forex Agent" or "Nova Forex Fib". */
  source: string;
  createdAt: string;
};

/** Long dips into entry (cross down); short rallies into entry (cross up). */
export function forexScalperEntryTriggerFor(side: "long" | "short"): "cross_down" | "cross_up" {
  return side === "long" ? "cross_down" : "cross_up";
}

export function readNovaForexScalperPrefill(): NovaForexScalperPrefill | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(NOVA_FOREX_SCALPER_PREFILL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NovaForexScalperPrefill;
    if (!parsed?.symbol || (parsed.side !== "long" && parsed.side !== "short")) return null;
    if (!Number.isFinite(parsed.entryPrice) || !Number.isFinite(parsed.exitPrice)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeNovaForexScalperPrefill(prefill: NovaForexScalperPrefill | null): void {
  if (typeof window === "undefined") return;
  if (!prefill) {
    sessionStorage.removeItem(NOVA_FOREX_SCALPER_PREFILL_KEY);
  } else {
    sessionStorage.setItem(NOVA_FOREX_SCALPER_PREFILL_KEY, JSON.stringify(prefill));
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
