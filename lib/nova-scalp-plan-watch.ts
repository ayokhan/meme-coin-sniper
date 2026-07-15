import type { NovaScalpAnalysis } from "@/lib/nova-scalp-agent";
import type { ScalpPlanStatus } from "@/lib/nova-scalp-plan-status";
import type { ScalpPlanMarket } from "@/lib/scalp-plan-market";

export const SCALP_WATCH_STORAGE_KEY = "novastaris_scalp_plan_watch";
export const SCALP_WATCH_EVENT = "novastaris-scalp-watch-change";
export const SCALP_STATUS_EVENT = "novastaris-scalp-status-change";
/** Restore a watched analysis into the Scalp agent panel (do not replace watches). */
export const SCALP_OPEN_WATCHED_EVENT = "novastaris-scalp-open-watched";
export const SCALP_OPEN_WATCHED_PENDING_KEY = "novastaris_scalp_open_watched_pending";

/** Max concurrent watched plans (crypto + forex combined). */
export const SCALP_WATCH_MAX = 5;

export type WatchedScalpPlan = {
  analysis: NovaScalpAnalysis;
  market?: ScalpPlanMarket;
  watchedAt: string;
  lastStatus: ScalpPlanStatus;
  lastLivePrice: number | null;
  statusUpdatedAt?: string;
};

export type StartWatchResult =
  | { ok: true; plans: WatchedScalpPlan[] }
  | { ok: false; reason: "limit"; max: number; plans: WatchedScalpPlan[] };

/** One watch slot per market + symbol + timeframe. */
export function watchPlanKey(
  analysis: { symbol: string; timeframeId: string },
  market: ScalpPlanMarket = "crypto"
): string {
  return `${market}|${String(analysis.symbol).toUpperCase()}|${analysis.timeframeId}`;
}

function planKey(w: WatchedScalpPlan): string {
  return watchPlanKey(w.analysis, w.market ?? "crypto");
}

function normalizePlans(raw: unknown): WatchedScalpPlan[] {
  if (!raw) return [];
  // Legacy: single plan object
  if (typeof raw === "object" && raw !== null && "analysis" in raw && !Array.isArray(raw)) {
    const one = raw as WatchedScalpPlan;
    if (one?.analysis?.symbol) return [one];
    return [];
  }
  if (Array.isArray(raw)) {
    return raw.filter((p): p is WatchedScalpPlan => !!p?.analysis?.symbol).slice(0, SCALP_WATCH_MAX);
  }
  // New shape: { plans: [...] }
  if (typeof raw === "object" && raw !== null && "plans" in raw) {
    const plans = (raw as { plans?: unknown }).plans;
    if (Array.isArray(plans)) {
      return plans.filter((p): p is WatchedScalpPlan => !!p?.analysis?.symbol).slice(0, SCALP_WATCH_MAX);
    }
  }
  return [];
}

export function readWatchedScalpPlans(): WatchedScalpPlan[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(SCALP_WATCH_STORAGE_KEY);
    if (!raw) return [];
    return normalizePlans(JSON.parse(raw));
  } catch {
    return [];
  }
}

/** Most recently watched plan (compat for callers that expect a single plan). */
export function readWatchedScalpPlan(): WatchedScalpPlan | null {
  const plans = readWatchedScalpPlans();
  if (plans.length === 0) return null;
  return [...plans].sort((a, b) => {
    const ta = Date.parse(a.watchedAt) || 0;
    const tb = Date.parse(b.watchedAt) || 0;
    return tb - ta;
  })[0]!;
}

export function writeWatchedScalpPlans(plans: WatchedScalpPlan[]): void {
  if (typeof window === "undefined") return;
  const next = plans.slice(0, SCALP_WATCH_MAX);
  if (next.length === 0) {
    sessionStorage.removeItem(SCALP_WATCH_STORAGE_KEY);
  } else {
    sessionStorage.setItem(SCALP_WATCH_STORAGE_KEY, JSON.stringify({ plans: next }));
  }
  window.dispatchEvent(new CustomEvent(SCALP_WATCH_EVENT));
}

/** @deprecated Prefer writeWatchedScalpPlans — kept for watcher/legacy single writes. */
export function writeWatchedScalpPlan(plan: WatchedScalpPlan | null): void {
  if (!plan) {
    writeWatchedScalpPlans([]);
    return;
  }
  const others = readWatchedScalpPlans().filter((p) => planKey(p) !== planKey(plan));
  writeWatchedScalpPlans([...others, plan]);
}

export function startWatchingScalpPlan(
  analysis: NovaScalpAnalysis,
  lastStatus: ScalpPlanStatus,
  market: ScalpPlanMarket = "crypto"
): StartWatchResult {
  const key = watchPlanKey(analysis, market);
  const existing = readWatchedScalpPlans();
  const without = existing.filter((p) => planKey(p) !== key);
  if (without.length >= SCALP_WATCH_MAX) {
    return { ok: false, reason: "limit", max: SCALP_WATCH_MAX, plans: existing };
  }
  const next: WatchedScalpPlan = {
    analysis,
    market,
    watchedAt: new Date().toISOString(),
    lastStatus,
    lastLivePrice: analysis.currentPrice,
  };
  const plans = [...without, next];
  writeWatchedScalpPlans(plans);
  return { ok: true, plans };
}

/** Remove one plan by identity, or clear all if no target given. */
export function stopWatchingScalpPlan(
  analysis?: { symbol: string; timeframeId: string } | null,
  market: ScalpPlanMarket = "crypto"
): void {
  if (!analysis) {
    writeWatchedScalpPlans([]);
    return;
  }
  const key = watchPlanKey(analysis, market);
  writeWatchedScalpPlans(readWatchedScalpPlans().filter((p) => planKey(p) !== key));
}

export function updateWatchedScalpPlan(
  target: { symbol: string; timeframeId: string },
  patch: Partial<Pick<WatchedScalpPlan, "lastStatus" | "lastLivePrice" | "statusUpdatedAt" | "analysis">>,
  market: ScalpPlanMarket = "crypto"
): void {
  const key = watchPlanKey(target, market);
  const plans = readWatchedScalpPlans();
  let changed = false;
  const next = plans.map((p) => {
    if (planKey(p) !== key) return p;
    changed = true;
    return { ...p, ...patch };
  });
  if (!changed) return;
  writeWatchedScalpPlans(next);
}

export function isWatchingScalpPlan(
  analysis: { symbol: string; timeframeId: string },
  market: ScalpPlanMarket = "crypto"
): boolean {
  const key = watchPlanKey(analysis, market);
  return readWatchedScalpPlans().some((p) => planKey(p) === key);
}

export function findWatchedScalpPlan(
  analysis: { symbol: string; timeframeId: string },
  market: ScalpPlanMarket = "crypto"
): WatchedScalpPlan | null {
  const key = watchPlanKey(analysis, market);
  return readWatchedScalpPlans().find((p) => planKey(p) === key) ?? null;
}

export type OpenWatchedPending = {
  symbol: string;
  timeframeId: string;
  market: ScalpPlanMarket;
};

export function requestOpenWatchedScalpPlan(
  target?: { symbol: string; timeframeId: string } | null,
  market: ScalpPlanMarket = "crypto"
): void {
  if (typeof window === "undefined") return;
  const w =
    target != null
      ? findWatchedScalpPlan(target, market)
      : readWatchedScalpPlan();
  if (!w) return;
  const pending: OpenWatchedPending = {
    symbol: w.analysis.symbol,
    timeframeId: w.analysis.timeframeId,
    market: w.market ?? "crypto",
  };
  sessionStorage.setItem(SCALP_OPEN_WATCHED_PENDING_KEY, JSON.stringify(pending));
  window.dispatchEvent(new CustomEvent(SCALP_OPEN_WATCHED_EVENT, { detail: pending }));
}

export function peekOpenWatchedScalpPlanPending(): OpenWatchedPending | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SCALP_OPEN_WATCHED_PENDING_KEY);
    if (!raw) return null;
    // Legacy flag "1"
    if (raw === "1") {
      const w = readWatchedScalpPlan();
      if (!w) return null;
      return {
        symbol: w.analysis.symbol,
        timeframeId: w.analysis.timeframeId,
        market: w.market ?? "crypto",
      };
    }
    const parsed = JSON.parse(raw) as OpenWatchedPending;
    if (!parsed?.symbol || !parsed.timeframeId) return null;
    return {
      symbol: parsed.symbol,
      timeframeId: parsed.timeframeId,
      market: parsed.market === "forex" ? "forex" : "crypto",
    };
  } catch {
    return null;
  }
}

export function hasOpenWatchedScalpPlanPending(): boolean {
  return peekOpenWatchedScalpPlanPending() != null;
}

export function clearOpenWatchedScalpPlanPending(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(SCALP_OPEN_WATCHED_PENDING_KEY);
}

export function dispatchScalpStatusChange(payload: {
  status: ScalpPlanStatus;
  analysis: NovaScalpAnalysis;
  livePrice: number | null;
  market?: ScalpPlanMarket;
}): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SCALP_STATUS_EVENT, { detail: payload }));
}
