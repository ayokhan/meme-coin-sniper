import type { NovaScalpAnalysis } from "@/lib/nova-scalp-agent";

export const SCALP_ENTRY_STORAGE_KEY = "novastaris_scalp_plan_entry";
export const SCALP_ENTRY_EVENT = "novastaris-scalp-entry-change";

export type ScalpPlanEntryChoice = "entered" | "skipped";

export type ScalpPlanEntryRecord = {
  planKey: string;
  choice: ScalpPlanEntryChoice;
  symbol: string;
  timeframeId: string;
  analyzedAt: string;
  recordedAt: string;
  feedbackSent?: boolean;
};

export function scalpPlanKey(analysis: NovaScalpAnalysis): string {
  return `${analysis.symbol}:${analysis.timeframeId}:${analysis.analyzedAt}`;
}

export function readScalpPlanEntry(planKey: string): ScalpPlanEntryRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SCALP_ENTRY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ScalpPlanEntryRecord;
    if (!parsed?.planKey || parsed.planKey !== planKey) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeScalpPlanEntry(record: ScalpPlanEntryRecord | null): void {
  if (typeof window === "undefined") return;
  if (!record) {
    sessionStorage.removeItem(SCALP_ENTRY_STORAGE_KEY);
  } else {
    sessionStorage.setItem(SCALP_ENTRY_STORAGE_KEY, JSON.stringify(record));
  }
  window.dispatchEvent(new CustomEvent(SCALP_ENTRY_EVENT));
}

export function setScalpPlanEntryChoice(
  analysis: NovaScalpAnalysis,
  choice: ScalpPlanEntryChoice
): void {
  writeScalpPlanEntry({
    planKey: scalpPlanKey(analysis),
    choice,
    symbol: analysis.symbol,
    timeframeId: analysis.timeframeId,
    analyzedAt: analysis.analyzedAt,
    recordedAt: new Date().toISOString(),
    feedbackSent: choice === "skipped",
  });
}

export function markScalpPlanFeedbackSent(planKey: string): void {
  const existing = readScalpPlanEntry(planKey);
  if (!existing) return;
  writeScalpPlanEntry({ ...existing, feedbackSent: true });
}
