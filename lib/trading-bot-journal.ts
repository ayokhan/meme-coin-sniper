import type { ClosedTrade } from "@/lib/closed-trades";

export type JournalOutcome = "win" | "loss" | "breakeven" | "open";

export function outcomeFromPnl(pnl: number): JournalOutcome {
  if (pnl > 1e-8) return "win";
  if (pnl < -1e-8) return "loss";
  return "breakeven";
}

export function closedTradeToJournalPayload(
  trade: ClosedTrade,
  mode: "demo" | "live",
  notes?: string
) {
  return {
    externalId: trade.id,
    source: "closed_trade" as const,
    instId: trade.instId,
    symbol: trade.displaySymbol,
    side: trade.direction,
    entryPrice: trade.openPrice,
    exitPrice: trade.closePrice,
    leverage: trade.leverage,
    realizedPnlUsdt: trade.realizedPnlUsdt,
    roiPct: trade.roiPct,
    outcome: outcomeFromPnl(trade.realizedPnlUsdt),
    blofinMode: mode,
    closedAt: trade.closedAt,
    notes: notes ?? null,
  };
}

export type JournalEntryDto = {
  id: string;
  externalId: string | null;
  source: string;
  instId: string | null;
  symbol: string;
  side: string;
  entryPrice: number;
  exitPrice: number | null;
  takeProfitPrice: number | null;
  stopLossPrice: number | null;
  leverage: number | null;
  positionNotionalUsdt: number | null;
  realizedPnlUsdt: number | null;
  roiPct: number | null;
  outcome: string;
  blofinMode: string | null;
  novaRadarSnapshot: string | null;
  notes: string | null;
  closedAt: string | null;
  createdAt: string;
};
