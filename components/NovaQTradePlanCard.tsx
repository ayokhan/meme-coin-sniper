"use client";

import { Badge } from "@/components/ui/badge";
import type { NovaQTradePlan, NovaQVoteStrength } from "@/lib/nova-q-trade-plan";
import { formatNovaQEntryType } from "@/lib/nova-q-trade-plan";

function fmt(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 4, minimumFractionDigits: 2 })}`;
}

function confidenceClass(c: NovaQTradePlan["confidence"]): string {
  if (c === "high") return "border-emerald-500/50 text-emerald-800 dark:text-emerald-200";
  if (c === "medium") return "border-amber-500/50 text-amber-800 dark:text-amber-200";
  return "border-zinc-400/50 text-zinc-600 dark:text-zinc-400";
}

function voteStrengthClass(v: NovaQVoteStrength): string {
  if (v === "strong") return "border-emerald-500/50 text-emerald-800 dark:text-emerald-200";
  if (v === "mixed") return "border-amber-500/50 text-amber-800 dark:text-amber-200";
  return "border-zinc-400/50 text-zinc-600 dark:text-zinc-400";
}

export default function NovaQTradePlanCard({ plan }: { plan: NovaQTradePlan }) {
  const sideClass =
    plan.side === "long"
      ? "border-emerald-500/60 text-emerald-700 dark:text-emerald-300"
      : plan.side === "short"
        ? "border-rose-500/60 text-rose-700 dark:text-rose-300"
        : "border-zinc-400/60 text-zinc-600 dark:text-zinc-400";

  return (
    <div className="rounded-lg border border-violet-200/80 dark:border-violet-800/60 bg-violet-50/40 dark:bg-violet-950/25 p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-semibold text-violet-950 dark:text-violet-100">Trade plan (structure-based)</h4>
        <Badge variant="outline" className={sideClass}>
          {plan.side === "wait" ? "Wait" : plan.side === "long" ? "Long bias" : "Short bias"}
        </Badge>
        <Badge variant="outline" className="text-[10px]">
          {formatNovaQEntryType(plan.entryType)}
        </Badge>
        <Badge variant="outline" className={`text-[10px] ${confidenceClass(plan.confidence)}`}>
          {plan.confidence} conviction
        </Badge>
        <Badge variant="outline" className={`text-[10px] ${voteStrengthClass(plan.voteStrength)}`}>
          {plan.voteStrength} vote
        </Badge>
        {plan.executionTimeframeLabel ? (
          <span className="text-[10px] text-muted-foreground">Timing: {plan.executionTimeframeLabel}</span>
        ) : null}
      </div>

      <p className="text-[11px] text-muted-foreground">Vote: {plan.voteSummary}</p>

      <p className="text-sm text-violet-950 dark:text-violet-50 leading-relaxed">{plan.headline}</p>

      {plan.entryType !== "wait" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          <div className="rounded-md border border-violet-200/60 dark:border-violet-800/40 bg-white/50 dark:bg-zinc-900/40 p-2">
            <span className="text-muted-foreground block mb-0.5">Suggested entry</span>
            <span className="font-mono font-medium">{fmt(plan.suggestedEntryPrice)}</span>
          </div>
          <div className="rounded-md border border-violet-200/60 dark:border-violet-800/40 bg-white/50 dark:bg-zinc-900/40 p-2">
            <span className="text-muted-foreground block mb-0.5">Illustrative stop</span>
            <span className="font-mono font-medium">{fmt(plan.stopLossPrice)}</span>
          </div>
          <div className="rounded-md border border-violet-200/60 dark:border-violet-800/40 bg-white/50 dark:bg-zinc-900/40 p-2">
            <span className="text-muted-foreground block mb-0.5">Illustrative target</span>
            <span className="font-mono font-medium">{fmt(plan.takeProfitPrice)}</span>
          </div>
        </div>
      )}

      {plan.riskRewardRatio != null && plan.entryType !== "wait" && (
        <p className="text-xs font-mono text-violet-900 dark:text-violet-100">
          Reward vs risk: ~{plan.riskRewardRatio.toFixed(2)}:1
          {plan.riskRewardRatio < 1 ? " (target closer than stop)" : null}
        </p>
      )}

      {plan.riskRewardWarning && (
        <div className="rounded-md border border-amber-300/70 dark:border-amber-800/60 bg-amber-50/70 dark:bg-amber-950/40 px-3 py-2">
          <p className="text-xs font-medium text-amber-950 dark:text-amber-100">R:R warning</p>
          <p className="text-xs text-amber-900/95 dark:text-amber-100/90 mt-0.5">{plan.riskRewardWarning}</p>
        </div>
      )}

      {(plan.invalidatedAbove != null || plan.invalidatedBelow != null) && (
        <div className="rounded-md border border-zinc-300/70 dark:border-zinc-600/60 bg-zinc-50/80 dark:bg-zinc-900/50 px-3 py-2 text-xs">
          <p className="font-medium text-zinc-800 dark:text-zinc-200">Invalidation (re-run NovaQ after)</p>
          {plan.invalidatedAbove != null && (
            <p className="text-rose-700 dark:text-rose-300 mt-0.5">
              Short thesis off if price holds above <span className="font-mono">{fmt(plan.invalidatedAbove)}</span>
            </p>
          )}
          {plan.invalidatedBelow != null && (
            <p className="text-rose-700 dark:text-rose-300 mt-0.5">
              Long thesis off if price holds below <span className="font-mono">{fmt(plan.invalidatedBelow)}</span>
            </p>
          )}
        </div>
      )}

      {plan.leverageNote && (
        <p className="text-xs text-violet-900/90 dark:text-violet-100/90 border-l-2 border-violet-400/60 pl-2">
          {plan.leverageNote}
        </p>
      )}

      <ul className="text-xs text-violet-900/90 dark:text-violet-100/90 list-disc pl-4 space-y-1">
        {plan.reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>

      <p className="text-[10px] text-muted-foreground leading-relaxed">
        Levels are derived from selected timeframe support/resistance and blended bias—not live order-book advice. For
        automated entry/exit/stop on a single scalp TF, use Nova Scalp Agent. Not financial advice.
      </p>
    </div>
  );
}
