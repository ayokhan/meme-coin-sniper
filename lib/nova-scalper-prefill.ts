/**
 * Hand-off from Nova Scalp Agent (Quick Wins / plan) to the NovaScalper bot.
 *
 * When a user clicks "Scalp this trade" on a confirmed LONG/SHORT plan, we stash the
 * trade levels in sessionStorage and send them to the Crypto Futures → NovaScalper tab.
 * NovaScalperPanel picks it up, pre-fills the active config, and asks the user to review
 * and Save (never auto-saves or auto-trades — the user stays in control).
 */

import {
  openScalpHandoffUrl,
  readScalpHandoffNavPref,
  type ScalpHandoffNavMode,
} from "@/lib/nova-scalp-handoff-nav";

export const NOVA_SCALPER_PREFILL_KEY = "novastaris_nova_scalper_prefill";
export const NOVA_SCALPER_PREFILL_EVENT = "novastaris-nova-scalper-prefill";

export const NOVA_SCALPER_HANDOFF_URL = "/?tab=trading-bot";

export type NovaScalperPrefill = {
  /** Base symbol as shown in Nova Scalp (e.g. "BTC", "XAU"). */
  symbol: string;
  side: "long" | "short";
  entryPrice: number;
  /** Take-profit / exit target. */
  exitPrice: number;
  stopLossPrice: number | null;
  leverage: number;
  /** USD margin to open with. */
  marginUsd: number;
  /** When set, overrides the active config's margin mode (Pulse PnL assumes isolated). */
  marginMode?: "cross" | "isolated";
  /** When set, Scalper uses this instead of inferring cross up/down from side. */
  entryTrigger?: "cross_down" | "cross_up" | "immediate";
  /** Human-readable origin, e.g. "Nova Scalp Agent" or "Quick Win". */
  source: string;
  createdAt: string;
};

/** Blofin instrument pair NovaScalper expects (BASE/QUOTE, or metal shortcut). */
export function scalperInstrumentPairFor(symbol: string): string {
  const s = String(symbol ?? "").trim().toUpperCase();
  if (s === "XAU" || s === "GOLD") return "XAU";
  if (s === "XAG" || s === "SILVER") return "XAG";
  if (!s) return "BTC/USDT";
  if (s.includes("/") || s.includes("-")) return s.replace(/-/g, "/");
  return `${s}/USDT`;
}

/** Long dips into entry (cross down); short rallies into entry (cross up). Market / at-entry → immediate. */
export function scalperEntryTriggerFor(
  side: "long" | "short",
  opts?: { entryMode?: "limit" | "market" | null; enterNow?: boolean }
): "cross_down" | "cross_up" | "immediate" {
  if (opts?.enterNow || opts?.entryMode === "market") return "immediate";
  return side === "long" ? "cross_down" : "cross_up";
}

export function readNovaScalperPrefill(): NovaScalperPrefill | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(NOVA_SCALPER_PREFILL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NovaScalperPrefill;
    if (!parsed?.symbol || (parsed.side !== "long" && parsed.side !== "short")) return null;
    if (!Number.isFinite(parsed.entryPrice) || !Number.isFinite(parsed.exitPrice)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeNovaScalperPrefill(prefill: NovaScalperPrefill | null): void {
  if (typeof window === "undefined") return;
  if (!prefill) {
    sessionStorage.removeItem(NOVA_SCALPER_PREFILL_KEY);
  } else {
    sessionStorage.setItem(NOVA_SCALPER_PREFILL_KEY, JSON.stringify(prefill));
  }
  window.dispatchEvent(new CustomEvent(NOVA_SCALPER_PREFILL_EVENT));
}

export function clearNovaScalperPrefill(): void {
  writeNovaScalperPrefill(null);
}

export function hasNovaScalperPrefill(): boolean {
  return readNovaScalperPrefill() != null;
}

/**
 * Stash the trade and open Crypto Futures → NovaScalper.
 * Pass `navMode` when the UI already resolved preference; otherwise uses saved pref or new tab.
 */
export function sendTradeToNovaScalper(
  prefill: NovaScalperPrefill,
  navMode?: ScalpHandoffNavMode
): void {
  writeNovaScalperPrefill(prefill);
  const mode = navMode ?? readScalpHandoffNavPref() ?? "new_tab";
  openScalpHandoffUrl(NOVA_SCALPER_HANDOFF_URL, mode);
}
