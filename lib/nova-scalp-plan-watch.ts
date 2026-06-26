import type { NovaScalpAnalysis } from "@/lib/nova-scalp-agent";
import type { ScalpPlanStatus } from "@/lib/nova-scalp-plan-status";

export const SCALP_WATCH_STORAGE_KEY = "novastaris_scalp_plan_watch";
export const SCALP_WATCH_EVENT = "novastaris-scalp-watch-change";
export const SCALP_STATUS_EVENT = "novastaris-scalp-status-change";

export type WatchedScalpPlan = {
  analysis: NovaScalpAnalysis;
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

export function startWatchingScalpPlan(analysis: NovaScalpAnalysis, lastStatus: ScalpPlanStatus): void {
  writeWatchedScalpPlan({
    analysis,
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

export function isWatchingScalpPlan(analysis: NovaScalpAnalysis): boolean {
  const w = readWatchedScalpPlan();
  return (
    !!w &&
    w.analysis.symbol === analysis.symbol &&
    w.analysis.timeframeId === analysis.timeframeId &&
    w.analysis.analyzedAt === analysis.analyzedAt
  );
}

export function dispatchScalpStatusChange(payload: {
  status: ScalpPlanStatus;
  analysis: NovaScalpAnalysis;
  livePrice: number | null;
}): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SCALP_STATUS_EVENT, { detail: payload }));
}
