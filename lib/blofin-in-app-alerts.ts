export const BLOFIN_IN_APP_ALERTS_ENABLED_KEY = "novastaris-blofin-in-app-alerts-enabled";
export const BLOFIN_BROWSER_NOTIFY_PREF_KEY = "novastaris-blofin-browser-notify-enabled";
export const BLOFIN_ALERT_COOLDOWN_KEY = "novastaris-blofin-alert-cooldowns";

export type BlofinInAppAlert = {
  id: string;
  base: string;
  symbol: string;
  direction: "up" | "down";
  change24hPct: number;
  pct5m?: number;
  pct15m?: number;
  at: string;
};

const COOLDOWN_MS = 45 * 60 * 1000;

export function loadBlofinInAppAlertsEnabled(): boolean {
  try {
    const raw = localStorage.getItem(BLOFIN_IN_APP_ALERTS_ENABLED_KEY);
    if (raw === "0" || raw === "false") return false;
    return true;
  } catch {
    return true;
  }
}

export function saveBlofinInAppAlertsEnabled(on: boolean): void {
  try {
    localStorage.setItem(BLOFIN_IN_APP_ALERTS_ENABLED_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function loadBlofinBrowserNotifyPref(): boolean {
  try {
    const raw = localStorage.getItem(BLOFIN_BROWSER_NOTIFY_PREF_KEY);
    if (raw === "0" || raw === "false") return false;
    return true;
  } catch {
    return true;
  }
}

export function saveBlofinBrowserNotifyPref(on: boolean): void {
  try {
    localStorage.setItem(BLOFIN_BROWSER_NOTIFY_PREF_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function loadCooldowns(): Record<string, number> {
  try {
    const raw = localStorage.getItem(BLOFIN_ALERT_COOLDOWN_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, number>;
  } catch {
    return {};
  }
}

function saveCooldowns(map: Record<string, number>): void {
  try {
    localStorage.setItem(BLOFIN_ALERT_COOLDOWN_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

/** Skip re-firing the same symbol+direction within the cooldown window. */
export function blofinAlertCooldownAllows(key: string, now = Date.now()): boolean {
  const map = loadCooldowns();
  const last = map[key];
  if (last == null) return true;
  return now - last >= COOLDOWN_MS;
}

export function markBlofinAlertFired(key: string, now = Date.now()): void {
  const map = loadCooldowns();
  map[key] = now;
  const cutoff = now - COOLDOWN_MS * 2;
  for (const k of Object.keys(map)) {
    if (map[k]! < cutoff) delete map[k];
  }
  saveCooldowns(map);
}

export function notifyBlofinBreakoutBrowser(alert: BlofinInAppAlert): void {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  if (!loadBlofinBrowserNotifyPref()) return;
  const dir = alert.direction === "up" ? "LONG setup" : "SHORT setup";
  const p15 = alert.pct15m != null ? `${alert.pct15m >= 0 ? "+" : ""}${alert.pct15m.toFixed(2)}% 15m` : "";
  const ch24 = `${alert.change24hPct >= 0 ? "+" : ""}${alert.change24hPct.toFixed(1)}% 24h`;
  try {
    new Notification(`Blofin early breakout — ${alert.base}`, {
      body: `${dir} · ${p15} · ${ch24}`,
      tag: `blofin-eb-${alert.base}-${alert.direction}`,
    });
  } catch {
    /* ignore */
  }
}
