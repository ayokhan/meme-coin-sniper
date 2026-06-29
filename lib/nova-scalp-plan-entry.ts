import type { NovaScalpAnalysis } from "@/lib/nova-scalp-agent";
import type { ScalpPlanMarket } from "@/lib/scalp-plan-market";

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
  /** Price when user tapped I entered (live or plan limit). */
  filledEntryPrice?: number | null;
  entrySide?: "long" | "short";
  amountUsd?: number;
  leverage?: number;
};

export function scalpPlanKey(analysis: NovaScalpAnalysis, market: ScalpPlanMarket = "crypto"): string {
  return `${market}:${analysis.symbol}:${analysis.timeframeId}:${analysis.analyzedAt}`;
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
  choice: ScalpPlanEntryChoice,
  market: ScalpPlanMarket = "crypto",
  extras?: {
    filledEntryPrice?: number | null;
    livePriceAtEntry?: number | null;
  }
): void {
  const filled =
    extras?.filledEntryPrice != null && Number.isFinite(extras.filledEntryPrice)
      ? extras.filledEntryPrice
      : extras?.livePriceAtEntry != null && Number.isFinite(extras.livePriceAtEntry)
        ? extras.livePriceAtEntry
        : analysis.entryPrice;
  writeScalpPlanEntry({
    planKey: scalpPlanKey(analysis, market),
    choice,
    symbol: analysis.symbol,
    timeframeId: analysis.timeframeId,
    analyzedAt: analysis.analyzedAt,
    recordedAt: new Date().toISOString(),
    feedbackSent: choice === "skipped",
    filledEntryPrice:
      choice === "entered" && filled != null && Number.isFinite(filled) ? filled : null,
    entrySide:
      choice === "entered" && (analysis.side === "long" || analysis.side === "short")
        ? analysis.side
        : undefined,
    amountUsd: choice === "entered" ? analysis.amountUsd : undefined,
    leverage: choice === "entered" ? analysis.leverage : undefined,
  });
}

export function markScalpPlanFeedbackSent(planKey: string): void {
  const existing = readScalpPlanEntry(planKey);
  if (!existing) return;
  writeScalpPlanEntry({ ...existing, feedbackSent: true });
}
