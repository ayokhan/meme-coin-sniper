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
    // Do NOT pass "noopener" in windowFeatures — many browsers then return null
    // even when the tab opens, which made us wrongly fall back to same-tab navigation.
    const win = window.open(url, "_blank");
    if (win) {
      try {
        win.opener = null;
      } catch {
        /* ignore */
      }
      return;
    }
    // True popup block only — keep the Scalp plan in place and notify.
    try {
      window.alert("Pop-up blocked. Allow pop-ups for NovaStaris, or choose “Current tab” for handoffs.");
    } catch {
      /* ignore */
    }
    return;
  }
  window.location.assign(url);
}
