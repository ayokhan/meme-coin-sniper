import type { NovaScalpAnalysis } from "@/lib/nova-scalp-agent";
import type { ScalpPlanStatus } from "@/lib/nova-scalp-plan-status";
import type { ScalpPlanMarket } from "@/lib/scalp-plan-market";

export const SCALP_WATCH_STORAGE_KEY = "novastaris_scalp_plan_watch";
export const SCALP_WATCH_EVENT = "novastaris-scalp-watch-change";
export const SCALP_STATUS_EVENT = "novastaris-scalp-status-change";
/** Restore the watched analysis into the Scalp agent panel (do not replace watch). */
export const SCALP_OPEN_WATCHED_EVENT = "novastaris-scalp-open-watched";
export const SCALP_OPEN_WATCHED_PENDING_KEY = "novastaris_scalp_open_watched_pending";

export type WatchedScalpPlan = {
  analysis: NovaScalpAnalysis;
  market?: ScalpPlanMarket;
  watchedAt: string;
  lastStatus: ScalpPlanStatus;
  lastLivePrice: number | null;
  statusUpdatedAt?: string;
};

export function readWatchedScalpPlan(): WatchedScalpPlan | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SCALP_WATCH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WatchedScalpPlan;
    if (!parsed?.analysis?.symbol) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeWatchedScalpPlan(plan: WatchedScalpPlan | null): void {
  if (typeof window === "undefined") return;
  if (!plan) {
    sessionStorage.removeItem(SCALP_WATCH_STORAGE_KEY);
  } else {
    sessionStorage.setItem(SCALP_WATCH_STORAGE_KEY, JSON.stringify(plan));
  }
  window.dispatchEvent(new CustomEvent(SCALP_WATCH_EVENT));
}

export function startWatchingScalpPlan(
  analysis: NovaScalpAnalysis,
  lastStatus: ScalpPlanStatus,
  market: ScalpPlanMarket = "crypto"
): void {
  writeWatchedScalpPlan({
    analysis,
    market,
    watchedAt: new Date().toISOString(),
    lastStatus,
    lastLivePrice: analysis.currentPrice,
  });
}

export function stopWatchingScalpPlan(): void {
  writeWatchedScalpPlan(null);
}

export function updateWatchedScalpPlan(
  patch: Partial<Pick<WatchedScalpPlan, "lastStatus" | "lastLivePrice" | "statusUpdatedAt" | "analysis">>
): void {
  const w = readWatchedScalpPlan();
  if (!w) return;
  writeWatchedScalpPlan({ ...w, ...patch });
}

export function isWatchingScalpPlan(
  analysis: NovaScalpAnalysis,
  market: ScalpPlanMarket = "crypto"
): boolean {
  const w = readWatchedScalpPlan();
  const wMarket = w?.market ?? "crypto";
  return (
    !!w &&
    wMarket === market &&
    w.analysis.symbol === analysis.symbol &&
    w.analysis.timeframeId === analysis.timeframeId &&
    w.analysis.analyzedAt === analysis.analyzedAt
  );
}

export function requestOpenWatchedScalpPlan(): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(SCALP_OPEN_WATCHED_PENDING_KEY, "1");
  window.dispatchEvent(new CustomEvent(SCALP_OPEN_WATCHED_EVENT));
}

export function hasOpenWatchedScalpPlanPending(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(SCALP_OPEN_WATCHED_PENDING_KEY) === "1";
}

export function clearOpenWatchedScalpPlanPending(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(SCALP_OPEN_WATCHED_PENDING_KEY);
}

export function dispatchScalpStatusChange(payload: {
  status: ScalpPlanStatus;
  analysis: NovaScalpAnalysis;
  livePrice: number | null;
}): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SCALP_STATUS_EVENT, { detail: payload }));
}
