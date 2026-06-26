import type { NovaScalpAnalysis, NovaScalpQuickWin } from "@/lib/nova-scalp-agent";

function fmtPx(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 4, minimumFractionDigits: 2 })}`;
}

export function formatNovaScalpAnalysisForShare(
  r: NovaScalpAnalysis,
  extras?: {
    planStatusLabel?: string;
    livePrice?: number | null;
    statusUpdatedAt?: string | null;
  }
): { title: string; content: string } {
  const side =
    r.side === "long" ? "LONG" : r.side === "short" ? "SHORT" : "NO ENTRY";
  const title = `Nova Scalp · ${r.symbol} · ${side} (${r.timeframeLabel})`;
  const lines = [
    `Contract: ${r.symbol}`,
    `Timeframe: ${r.timeframeLabel}`,
    `Signal: ${side}`,
    `Margin: $${r.amountUsd} · Leverage: ${r.leverage}x`,
    r.currentPrice != null ? `At run: ${fmtPx(r.currentPrice)}` : null,
    r.enterNowPrice != null && r.entryMode === "market" ? `Enter now: ${fmtPx(r.enterNowPrice)}` : null,
    r.entryPrice != null
      ? `${r.entryMode === "limit" ? "Limit entry" : "Entry"}: ${fmtPx(r.entryPrice)}${r.entryTouches != null ? ` (${r.entryTouches} touches in ${r.timeframeLabel})` : ""}`
      : null,
    r.exitPrice != null
      ? `Exit target: ${fmtPx(r.exitPrice)}${r.exitTouches != null ? ` (${r.exitTouches} touches in ${r.timeframeLabel})` : ""}`
      : null,
    r.stopLossPrice != null ? `Stop (invalidation): ${fmtPx(r.stopLossPrice)}` : null,
    r.riskStopLossPrice != null
      ? `Risk stop (${r.maxLossPctOnMargin}% margin): ${fmtPx(r.riskStopLossPrice)}`
      : null,
    r.recommendedStopPrice != null && r.recommendedStopPrice !== r.stopLossPrice
      ? `Suggested stop (tighter): ${fmtPx(r.recommendedStopPrice)}`
      : null,
    r.analyzedAt ? `Generated: ${new Date(r.analyzedAt).toLocaleString()}` : null,
    extras?.planStatusLabel ? `Live status: ${extras.planStatusLabel}` : null,
    extras?.livePrice != null && Number.isFinite(extras.livePrice)
      ? `Live price: ${fmtPx(extras.livePrice)}`
      : null,
    extras?.statusUpdatedAt
      ? `Status updated: ${new Date(extras.statusUpdatedAt).toLocaleString()}`
      : null,
    r.expectedPnlUsd != null
      ? `Expected PnL: ${r.expectedPnlUsd >= 0 ? "+" : ""}$${r.expectedPnlUsd.toLocaleString()} (${r.expectedPnlPctOnMargin?.toFixed(1) ?? "—"}% on margin)`
      : null,
    r.estimatedHoldMinutes != null ? `Est. hold: ~${r.estimatedHoldMinutes} min` : null,
    `Structure: ${r.structureDirection} · Trendline: ${r.trendlineBias} · Blended: ${r.blendedDirection}`,
    r.rationale,
    "",
    "Not financial advice. Know your risk level before trading.",
  ].filter((line) => line !== null);
  return { title, content: lines.join("\n") };
}

export function formatNovaScalpQuickWinForShare(w: NovaScalpQuickWin): { title: string; content: string } {
  const title = `Nova Scalp Quick Win · ${w.symbol} · ${w.scalpSide.toUpperCase()}`;
  const lines = [
    `Contract: ${w.symbol}`,
    `5m plan: ${w.scalpSide.toUpperCase()}`,
    `Entry: ${fmtPx(w.entryPrice)} (${w.entryTouches} touches) · Exit: ${fmtPx(w.exitPrice)} (${w.exitTouches} touches) · Stop: ${fmtPx(w.stopLossPrice)}`,
    w.currentPrice != null ? `Current: ${fmtPx(w.currentPrice)}` : null,
    `Score: ${w.quickWinScore} · ~${w.suggestedLeverage}x · ~${w.estHoldMinutes}m hold`,
    `15m range: ${w.rangePct15m}%`,
    w.previewPnlUsd != null ? `Preview PnL (@ $100 margin): ${w.previewPnlUsd >= 0 ? "+" : ""}$${w.previewPnlUsd}` : null,
    w.directionHint,
    w.liquidityNote,
    "",
    "Not financial advice. Know your risk level before trading.",
  ].filter(Boolean);
  return { title, content: lines.join("\n") };
}
