"use client";

type Props = {
  compact?: boolean;
  context?: "radar" | "bot" | "futures";
};

export default function TradingRiskDisclaimer({ compact, context = "futures" }: Props) {
  const text =
    context === "radar"
      ? "NovaRadar shows illustrative structure, fill odds, and leverage math—not financial advice. Confirm liquidation and margin on Blofin before placing orders."
      : context === "bot"
        ? "Automated trading can lose money quickly. Use demo mode first, set stops on the exchange, and never risk more than you can afford to lose."
        : "Leveraged trading carries high risk. Past performance on share cards does not guarantee future results.";

  if (compact) {
    return (
      <p className="text-[11px] text-muted-foreground leading-relaxed border-l-2 border-amber-500/50 pl-2">
        {text}
      </p>
    );
  }

  return (
    <div className="rounded-md border border-slate-200/80 dark:border-slate-700/60 bg-slate-50/80 dark:bg-slate-900/50 px-3 py-2">
      <p className="text-xs text-amber-950/90 dark:text-amber-100/90">{text}</p>
    </div>
  );
}
