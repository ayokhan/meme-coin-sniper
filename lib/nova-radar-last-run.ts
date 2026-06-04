import type { NovaRadarPlanResult, NovaRadarRecommendation } from "@/lib/nova-radar";
import type { UnifiedMarketRead } from "@/lib/nova-market-read";

export type NovaRadarLastRunSnapshot = {
  capturedAt: string;
  symbol: string;
  recommendation: Pick<NovaRadarRecommendation, "bestPlanId" | "headline" | "subheadline"> | null;
  plans: Array<{
    planId: string;
    symbol: string;
    targetPrice: number;
    side: string;
    fillProbabilityPct: number | null;
    recommended: boolean;
  }>;
  leverage: number | null;
  takeProfitPrice: number | null;
  stopLossPrice: number | null;
  marketRead: UnifiedMarketRead | null;
};

const STORAGE_KEY = "novastaris-nova-radar-last-run-v1";

export function saveNovaRadarLastRun(snapshot: NovaRadarLastRunSnapshot): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    /* ignore quota */
  }
}

export function loadNovaRadarLastRun(): NovaRadarLastRunSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as NovaRadarLastRunSnapshot;
  } catch {
    return null;
  }
}

export function buildNovaRadarLastRunSnapshot(args: {
  plans: NovaRadarPlanResult[];
  recommendation: NovaRadarRecommendation | null;
  marketRead: UnifiedMarketRead | null;
  leverage?: string;
  takeProfit?: string;
  stopLoss?: string;
}): NovaRadarLastRunSnapshot {
  const symbol = args.plans[0]?.symbol?.trim().toUpperCase() || "—";
  const parseNum = (s: string | undefined) => {
    if (!s?.trim()) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };
  return {
    capturedAt: new Date().toISOString(),
    symbol,
    recommendation: args.recommendation
      ? {
          bestPlanId: args.recommendation.bestPlanId,
          headline: args.recommendation.headline,
          subheadline: args.recommendation.subheadline,
        }
      : null,
    plans: args.plans.map((p) => ({
      planId: p.planId,
      symbol: p.symbol,
      targetPrice: p.targetPrice,
      side: p.side,
      fillProbabilityPct: p.fillProbability?.probabilityPct ?? null,
      recommended: p.planId === args.recommendation?.bestPlanId,
    })),
    leverage: parseNum(args.leverage),
    takeProfitPrice: parseNum(args.takeProfit),
    stopLossPrice: parseNum(args.stopLoss),
    marketRead: args.marketRead,
  };
}

/** True if snapshot applies to this closed trade symbol (XAU, BTC, etc.). */
export function radarSnapshotMatchesTrade(
  snapshot: NovaRadarLastRunSnapshot | null,
  displaySymbol: string
): boolean {
  if (!snapshot?.symbol) return false;
  const a = snapshot.symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const b = displaySymbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return a === b || a.startsWith(b) || b.startsWith(a);
}
