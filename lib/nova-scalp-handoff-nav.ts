/**
 * Shared navigation preference for Scalp handoffs (NovaScalper / NovaQ).
 * Default when unset: ask once, then remember. Recommended default = new tab.
 */

export const SCALP_HANDOFF_NAV_PREF_KEY = "novastaris_scalp_handoff_nav";

export type ScalpHandoffNavMode = "new_tab" | "same_tab";

export function readScalpHandoffNavPref(): ScalpHandoffNavMode | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(SCALP_HANDOFF_NAV_PREF_KEY);
    if (v === "new_tab" || v === "same_tab") return v;
    return null;
  } catch {
    return null;
  }
}

export function writeScalpHandoffNavPref(mode: ScalpHandoffNavMode): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SCALP_HANDOFF_NAV_PREF_KEY, mode);
  } catch {
    /* ignore */
  }
}

export function clearScalpHandoffNavPref(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(SCALP_HANDOFF_NAV_PREF_KEY);
  } catch {
    /* ignore */
  }
}

/** Navigate after prefill is written. */
export function openScalpHandoffUrl(url: string, mode: ScalpHandoffNavMode): void {
  if (typeof window === "undefined") return;
  if (mode === "new_tab") {
    const win = window.open(url, "_blank", "noopener,noreferrer");
    if (!win) {
      // Popup blocked — fall back to same tab so the handoff still works.
      window.location.assign(url);
    }
    return;
  }
  window.location.assign(url);
}
