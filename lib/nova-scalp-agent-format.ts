import type { NovaScalpAnalysis, NovaScalpQuickWin } from "@/lib/nova-scalp-agent";

function fmtPx(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 4, minimumFractionDigits: 2 })}`;
}

export function formatNovaScalpAnalysisForShare(r: NovaScalpAnalysis): { title: string; content: string } {
  const side =
    r.side === "long" ? "LONG" : r.side === "short" ? "SHORT" : "NO ENTRY";
  const title = `Nova Scalp · ${r.symbol} · ${side} (${r.timeframeLabel})`;
  const lines = [
    `Contract: ${r.symbol}`,
    `Timeframe: ${r.timeframeLabel}`,
    `Signal: ${side}`,
    `Margin: $${r.amountUsd} · Leverage: ${r.leverage}x`,
    r.currentPrice != null ? `Current: ${fmtPx(r.currentPrice)}` : null,
    r.entryPrice != null ? `Entry: ${fmtPx(r.entryPrice)}` : null,
    r.exitPrice != null ? `Exit target: ${fmtPx(r.exitPrice)}` : null,
    r.stopLossPrice != null ? `Stop (invalidation): ${fmtPx(r.stopLossPrice)}` : null,
    r.expectedPnlUsd != null
      ? `Expected PnL: ${r.expectedPnlUsd >= 0 ? "+" : ""}$${r.expectedPnlUsd.toLocaleString()} (${r.expectedPnlPctOnMargin?.toFixed(1) ?? "—"}% on margin)`
      : null,
    r.estimatedHoldMinutes != null ? `Est. hold: ~${r.estimatedHoldMinutes} min` : null,
    `Structure: ${r.structureDirection} · Trendline: ${r.trendlineBias} · Blended: ${r.blendedDirection}`,
    r.rationale,
    "",
    "Not financial advice. Illustrative PnL from Hyperliquid structure reads.",
  ].filter((line) => line !== null);
  return { title, content: lines.join("\n") };
}

export function formatNovaScalpQuickWinForShare(w: NovaScalpQuickWin): { title: string; content: string } {
  const title = `Nova Scalp Quick Win · ${w.symbol} · ${w.scalpSide.toUpperCase()}`;
  const lines = [
    `Contract: ${w.symbol}`,
    `5m plan: ${w.scalpSide.toUpperCase()}`,
    `Entry: ${fmtPx(w.entryPrice)} · Exit: ${fmtPx(w.exitPrice)} · Stop: ${fmtPx(w.stopLossPrice)}`,
    w.currentPrice != null ? `Current: ${fmtPx(w.currentPrice)}` : null,
    `Score: ${w.quickWinScore} · ~${w.suggestedLeverage}x · ~${w.estHoldMinutes}m hold`,
    `15m range: ${w.rangePct15m}%`,
    w.previewPnlUsd != null ? `Preview PnL (@ $100 margin): ${w.previewPnlUsd >= 0 ? "+" : ""}$${w.previewPnlUsd}` : null,
    w.directionHint,
    w.liquidityNote,
    "",
    "Not financial advice.",
  ].filter(Boolean);
  return { title, content: lines.join("\n") };
}
