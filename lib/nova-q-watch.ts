/**
 * Shared client-side memory for NovaQ + NovaQ Fib:
 * favorites, recents, last session (symbol + TFs), TF presets.
 */

import { sortNovaTimeframeIds } from "@/lib/nova-timeframes";

export type NovaQTool = "q" | "fib";

export type NovaQFavorite = {
  id: string;
  symbol: string;
  timeframes: string[];
  label?: string;
  preferredTool: NovaQTool | "both";
  createdAt: string;
};

export type NovaQRecent = {
  symbol: string;
  timeframes: string[];
  tool: NovaQTool;
  at: string;
};

export type NovaQSessionSnapshot = {
  symbol: string;
  timeframes: string[];
  updatedAt: string;
};

export type NovaQTfPresetId = "scalp" | "intraday" | "swing" | "custom";

export const NOVA_Q_TF_PRESETS: Record<
  Exclude<NovaQTfPresetId, "custom">,
  { id: Exclude<NovaQTfPresetId, "custom">; label: string; timeframes: string[] }
> = {
  scalp: { id: "scalp", label: "Scalp", timeframes: ["1m", "5m", "15m"] },
  intraday: { id: "intraday", label: "Intraday", timeframes: ["15m", "1h", "4h"] },
  swing: { id: "swing", label: "Swing", timeframes: ["4h", "12h", "24h", "1w"] },
};

/** Always-visible major chips for crypto NovaQ (metals = Blofin XAU/XAG). */
export const NOVA_Q_QUICK_PICKS = ["BTC", "ETH", "SOL", "XAU", "XAG", "PAXG"] as const;

const FAV_KEY = "novastaris-nova-q-favorites-v1";
const REC_KEY = "novastaris-nova-q-recents-v1";
const SESSION_KEY = "novastaris-nova-q-session-v1";
const PRESET_HINT_KEY = "novastaris-nova-q-last-preset-v1";

export const MAX_NOVA_Q_FAVORITES = 16;
export const MAX_NOVA_Q_RECENTS = 12;

function safeParseArray<T>(raw: string | null): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeTfs(tfs: string[]): string[] {
  return sortNovaTimeframeIds(
    [...new Set(tfs.map((t) => String(t).trim()).filter(Boolean))]
  );
}

function tfKey(tfs: string[]): string {
  return normalizeTfs(tfs).join(",");
}

export function detectNovaQPreset(timeframes: string[]): NovaQTfPresetId {
  const key = tfKey(timeframes);
  for (const p of Object.values(NOVA_Q_TF_PRESETS)) {
    if (tfKey(p.timeframes) === key) return p.id;
  }
  return "custom";
}

export function loadNovaQFavorites(): NovaQFavorite[] {
  if (typeof window === "undefined") return [];
  return safeParseArray<NovaQFavorite>(localStorage.getItem(FAV_KEY)).filter(
    (f) => f && typeof f.symbol === "string" && Array.isArray(f.timeframes)
  );
}

export function saveNovaQFavorites(list: NovaQFavorite[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify(list.slice(0, MAX_NOVA_Q_FAVORITES)));
  } catch {
    /* ignore */
  }
}

export function upsertNovaQFavorite(input: {
  symbol: string;
  timeframes: string[];
  label?: string;
  preferredTool?: NovaQTool | "both";
}): NovaQFavorite[] {
  const symbol = String(input.symbol ?? "").trim().toUpperCase();
  const timeframes = normalizeTfs(input.timeframes);
  if (!symbol || timeframes.length === 0) return loadNovaQFavorites();
  const preferredTool = input.preferredTool ?? "both";
  const list = loadNovaQFavorites();
  const existing = list.find(
    (f) => f.symbol === symbol && tfKey(f.timeframes) === tfKey(timeframes)
  );
  let next: NovaQFavorite[];
  if (existing) {
    next = list.map((f) =>
      f.id === existing.id
        ? {
            ...f,
            preferredTool,
            label: input.label?.trim() || f.label,
            createdAt: new Date().toISOString(),
          }
        : f
    );
  } else {
    const entry: NovaQFavorite = {
      id: `nq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      symbol,
      timeframes,
      label: input.label?.trim() || undefined,
      preferredTool,
      createdAt: new Date().toISOString(),
    };
    next = [entry, ...list].slice(0, MAX_NOVA_Q_FAVORITES);
  }
  saveNovaQFavorites(next);
  return next;
}

export function removeNovaQFavorite(id: string): NovaQFavorite[] {
  const next = loadNovaQFavorites().filter((f) => f.id !== id);
  saveNovaQFavorites(next);
  return next;
}

export function findNovaQFavorite(symbol: string, timeframes: string[]): NovaQFavorite | null {
  const s = symbol.trim().toUpperCase();
  const key = tfKey(timeframes);
  return loadNovaQFavorites().find((f) => f.symbol === s && tfKey(f.timeframes) === key) ?? null;
}

export function isNovaQFavorited(symbol: string, timeframes: string[]): boolean {
  return findNovaQFavorite(symbol, timeframes) != null;
}

/** Set or clear custom display label on a favorited setup. */
export function renameNovaQFavorite(id: string, label: string | null): NovaQFavorite[] {
  const next = loadNovaQFavorites().map((f) =>
    f.id === id
      ? { ...f, label: label?.trim() ? label.trim().slice(0, 32) : undefined }
      : f
  );
  saveNovaQFavorites(next);
  return next;
}

export function loadNovaQRecents(): NovaQRecent[] {
  if (typeof window === "undefined") return [];
  return safeParseArray<NovaQRecent>(localStorage.getItem(REC_KEY)).filter(
    (r) => r && typeof r.symbol === "string" && Array.isArray(r.timeframes)
  );
}

export function pushNovaQRecent(input: {
  symbol: string;
  timeframes: string[];
  tool: NovaQTool;
}): NovaQRecent[] {
  const symbol = String(input.symbol ?? "").trim().toUpperCase();
  const timeframes = normalizeTfs(input.timeframes);
  if (!symbol || timeframes.length === 0 || typeof window === "undefined") {
    return loadNovaQRecents();
  }
  const entry: NovaQRecent = {
    symbol,
    timeframes,
    tool: input.tool,
    at: new Date().toISOString(),
  };
  const rest = loadNovaQRecents().filter(
    (r) => !(r.symbol === symbol && tfKey(r.timeframes) === tfKey(timeframes) && r.tool === input.tool)
  );
  const next = [entry, ...rest].slice(0, MAX_NOVA_Q_RECENTS);
  try {
    localStorage.setItem(REC_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

export function clearNovaQRecents(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(REC_KEY);
  } catch {
    /* ignore */
  }
}

export function loadNovaQSession(): NovaQSessionSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NovaQSessionSnapshot;
    if (!parsed?.symbol?.trim() || !Array.isArray(parsed.timeframes) || parsed.timeframes.length === 0) {
      return null;
    }
    return {
      symbol: parsed.symbol.trim().toUpperCase(),
      timeframes: normalizeTfs(parsed.timeframes),
      updatedAt: parsed.updatedAt || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function writeNovaQSession(symbol: string, timeframes: string[]): void {
  if (typeof window === "undefined") return;
  const s = symbol.trim().toUpperCase();
  const tfs = normalizeTfs(timeframes);
  if (!s || tfs.length === 0) return;
  try {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        symbol: s,
        timeframes: tfs,
        updatedAt: new Date().toISOString(),
      } satisfies NovaQSessionSnapshot)
    );
    window.dispatchEvent(new CustomEvent("nova-q-session-changed"));
  } catch {
    /* ignore */
  }
}

export function loadLastNovaQPresetHint(): NovaQTfPresetId {
  if (typeof window === "undefined") return "intraday";
  try {
    const v = localStorage.getItem(PRESET_HINT_KEY);
    if (v === "scalp" || v === "intraday" || v === "swing" || v === "custom") return v;
  } catch {
    /* ignore */
  }
  return "intraday";
}

export function writeLastNovaQPresetHint(id: NovaQTfPresetId): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PRESET_HINT_KEY, id);
  } catch {
    /* ignore */
  }
}

/** Filter TFs to those allowed by a tool (e.g. Fib subset). */
export function clampTimeframesToAllowed(timeframes: string[], allowed: string[]): string[] {
  const allow = new Set(allowed);
  const next = normalizeTfs(timeframes).filter((t) => allow.has(t));
  return next.length > 0 ? next : normalizeTfs(allowed.slice(0, 3));
}
