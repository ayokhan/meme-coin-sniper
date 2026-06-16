/** User-pinned perp contracts across Perp Radar, Trending Perps, Top Altcoins, Hot Perps. */
export const PERP_CONTRACT_FAVORITES_LS_KEY = "novastaris-perp-radar-favorites";

/** Shared auto-refresh toggle for perp contract tables. */
export const PERP_TABLES_AUTO_REFRESH_LS_KEY = "novastaris-perp-tables-auto-refresh";

export function perpContractFavoriteKey(exchange: string, base: string): string {
  return `${exchange}:${base.trim().toUpperCase()}`;
}

export function perpExchangeForRadarView(view: "all" | "macro" | "metals" | "hyperliquid" | "blofin"): string {
  if (view === "blofin") return "blofin";
  if (view === "hyperliquid") return "hyperliquid";
  return "binance";
}

export function loadPerpContractFavorites(): string[] {
  try {
    const raw = localStorage.getItem(PERP_CONTRACT_FAVORITES_LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

export function savePerpContractFavorites(keys: string[]): void {
  try {
    localStorage.setItem(PERP_CONTRACT_FAVORITES_LS_KEY, JSON.stringify(keys));
  } catch {
    /* ignore */
  }
}

export function loadPerpTablesAutoRefresh(): boolean {
  try {
    const raw = localStorage.getItem(PERP_TABLES_AUTO_REFRESH_LS_KEY);
    return raw === "1" || raw === "true";
  } catch {
    return false;
  }
}

export function savePerpTablesAutoRefresh(on: boolean): void {
  try {
    localStorage.setItem(PERP_TABLES_AUTO_REFRESH_LS_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

/** Pin favorites first (user order), then remaining rows in prior sort order. */
export function sortRowsWithFavoriteContracts<T>(
  favoriteKeys: string[],
  exchange: string,
  allItems: T[],
  sortedNonFavorites: T[],
  getBase: (item: T) => string
): T[] {
  const favKeySet = new Set(favoriteKeys);
  const itemKey = (item: T) => perpContractFavoriteKey(exchange, getBase(item));
  const favoriteRows = favoriteKeys
    .map((key) => allItems.find((item) => itemKey(item) === key))
    .filter((item): item is T => item != null);
  const rest = sortedNonFavorites.filter((item) => !favKeySet.has(itemKey(item)));
  return [...favoriteRows, ...rest];
}
