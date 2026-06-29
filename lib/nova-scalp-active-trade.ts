import type { NovaScalpAnalysis } from "@/lib/nova-scalp-agent";
import type { ScalpPlanMarket } from "@/lib/scalp-plan-market";
import { stopWatchingScalpPlan } from "@/lib/nova-scalp-plan-watch";

export const SCALP_ACTIVE_TRADE_STORAGE_KEY = "novastaris_scalp_active_trade";
export const SCALP_ACTIVE_TRADE_EVENT = "novastaris-scalp-active-trade-change";

export type ScalpActiveTrade = {
  market: ScalpPlanMarket;
  symbol: string;
  timeframeId: string;
  timeframeLabel: string;
  side: "long" | "short";
  filledEntryPrice: number;
  exitPrice: number | null;
  stopLossPrice: number | null;
  amountUsd: number;
  leverage: number;
  planAnalyzedAt: string;
  enteredAt: string;
  feedbackSent?: boolean;
};

export function readActiveScalpTrade(): ScalpActiveTrade | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SCALP_ACTIVE_TRADE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ScalpActiveTrade;
    if (!parsed?.symbol || !parsed.side || parsed.feedbackSent) return null;
    if (!Number.isFinite(parsed.filledEntryPrice)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeActiveScalpTrade(trade: ScalpActiveTrade | null): void {
  if (typeof window === "undefined") return;
  if (!trade) {
    localStorage.removeItem(SCALP_ACTIVE_TRADE_STORAGE_KEY);
  } else {
    localStorage.setItem(SCALP_ACTIVE_TRADE_STORAGE_KEY, JSON.stringify(trade));
  }
  window.dispatchEvent(new CustomEvent(SCALP_ACTIVE_TRADE_EVENT));
}

export function startActiveScalpTrade(
  analysis: NovaScalpAnalysis,
  market: ScalpPlanMarket,
  filledEntryPrice: number
): void {
  if (analysis.side !== "long" && analysis.side !== "short") return;
  stopWatchingScalpPlan();
  writeActiveScalpTrade({
    market,
    symbol: analysis.symbol,
    timeframeId: analysis.timeframeId,
    timeframeLabel: analysis.timeframeLabel,
    side: analysis.side,
    filledEntryPrice,
    exitPrice: analysis.exitPrice,
    stopLossPrice: analysis.stopLossPrice,
    amountUsd: analysis.amountUsd,
    leverage: analysis.leverage,
    planAnalyzedAt: analysis.analyzedAt,
    enteredAt: new Date().toISOString(),
    feedbackSent: false,
  });
}

export function endActiveScalpTrade(): void {
  writeActiveScalpTrade(null);
}

export function markActiveScalpTradeFeedbackSent(): void {
  writeActiveScalpTrade(null);
}

export function isActiveScalpTradeForSymbol(
  trade: ScalpActiveTrade,
  symbol: string,
  market: ScalpPlanMarket
): boolean {
  return trade.market === market && trade.symbol === symbol;
}
