"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type {
  NovaRadarPlanId,
  NovaRadarPlanResult,
  NovaRadarRecommendation,
} from "@/lib/nova-radar";

type PlanForm = {
  symbol: string;
  limitPrice: string;
  side: "long" | "short";
};

const emptyPlan = (symbol = "BTC"): PlanForm => ({
  symbol,
  limitPrice: "",
  side: "long",
});

function realismBadgeClass(realism: NovaRadarPlanResult["realism"]) {
  if (realism === "unrealistic") return "border-rose-600/80 text-rose-800 dark:text-rose-200";
  if (realism === "stretched") return "border-amber-500/60 text-amber-800 dark:text-amber-200";
  return "border-emerald-500/60 text-emerald-800 dark:text-emerald-200";
}

function realismLabel(realism: NovaRadarPlanResult["realism"]) {
  if (realism === "unrealistic") return "Unrealistic";
  if (realism === "stretched") return "Stretched";
  return "Plausible";
}

function SideToggle({
  side,
  onChange,
}: {
  side: "long" | "short";
  onChange: (s: "long" | "short") => void;
}) {
  return (
    <div className="flex rounded-md border border-zinc-300 dark:border-zinc-600 overflow-hidden">
      <button
        type="button"
        onClick={() => onChange("long")}
        className={`px-3 py-1.5 text-sm font-medium ${side === "long" ? "bg-emerald-500 text-white dark:bg-emerald-600" : "bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"}`}
      >
        Long
      </button>
      <button
        type="button"
        onClick={() => onChange("short")}
        className={`px-3 py-1.5 text-sm font-medium ${side === "short" ? "bg-rose-500 text-white dark:bg-rose-600" : "bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"}`}
      >
        Short
      </button>
    </div>
  );
}

function PlanCard({
  plan,
  recommended,
}: {
  plan: NovaRadarPlanResult;
  recommended: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 space-y-3 ${
        recommended
          ? "border-violet-400/70 dark:border-violet-500/60 bg-violet-50/40 dark:bg-violet-950/25 ring-1 ring-violet-400/30"
          : "border-zinc-200 dark:border-zinc-700 bg-zinc-50/40 dark:bg-zinc-900/20"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{plan.planLabel}</span>
        {recommended && (
          <Badge className="bg-violet-600 text-white hover:bg-violet-600 text-[10px] uppercase tracking-wide">
            Recommended
          </Badge>
        )}
        <span className="font-mono text-sm">{plan.symbol}</span>
        <Badge
          variant="outline"
          className={
            plan.side === "long"
              ? "border-emerald-500/60 text-emerald-700 dark:text-emerald-300"
              : "border-rose-500/60 text-rose-700 dark:text-rose-300"
          }
        >
          {plan.side === "long" ? "Long limit" : "Short limit"}
        </Badge>
        <Badge variant="outline" className={realismBadgeClass(plan.realism)}>
          {realismLabel(plan.realism)}
        </Badge>
      </div>
      <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">{plan.summary}</p>
      {plan.caveats.length > 0 && (
        <ul className="text-xs text-amber-900/90 dark:text-amber-100/90 list-disc pl-4 space-y-0.5">
          {plan.caveats.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div>
          <span className="text-muted-foreground block">Spot</span>
          <span className="font-mono">${plan.currentPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
        </div>
        <div>
          <span className="text-muted-foreground block">Limit</span>
          <span className="font-mono">${plan.targetPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
        </div>
        <div>
          <span className="text-muted-foreground block">Path</span>
          <span className="capitalize">
            {plan.pricePath === "at_target" ? "Near level" : plan.pricePath === "up" ? "Needs rally" : "Needs dip"}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground block">Structure</span>
          <span className="capitalize">{plan.structureAlignment.replace("_", " ")}</span>
        </div>
      </div>
      {plan.estimatedReachDateEarly && plan.estimatedReachDateLate && plan.optimisticDays != null && plan.pessimisticDays != null && (
        <p className="text-xs font-mono text-violet-800 dark:text-violet-200">
          ETA band: {plan.estimatedReachDateEarly} → {plan.estimatedReachDateLate}{" "}
          <span className="font-sans text-muted-foreground">(~{plan.optimisticDays}–{plan.pessimisticDays} days)</span>
        </p>
      )}
    </div>
  );
}

export default function NovaRadarPanel() {
  const [plan1, setPlan1] = useState<PlanForm>(() => emptyPlan("BTC"));
  const [plan2, setPlan2] = useState<PlanForm>(() => emptyPlan("BTC"));
  const [usePlan2, setUsePlan2] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plans, setPlans] = useState<NovaRadarPlanResult[] | null>(null);
  const [recommendation, setRecommendation] = useState<NovaRadarRecommendation | null>(null);
  const [sharedTfs, setSharedTfs] = useState<NovaRadarPlanResult["structureTimeframes"] | null>(null);
  const [disclaimer, setDisclaimer] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    const p1Price = plan1.limitPrice.trim();
    if (!p1Price) {
      setError("Enter a limit price for trade plan 1.");
      setLoading(false);
      return;
    }
    if (!plan1.symbol.trim()) {
      setError("Enter a contract for trade plan 1.");
      setLoading(false);
      return;
    }

    const payload: Record<string, unknown> = {
      plan1: {
        symbol: plan1.symbol.trim().toUpperCase(),
        targetPrice: p1Price,
        side: plan1.side,
      },
    };

    if (usePlan2 && plan2.limitPrice.trim()) {
      payload.plan2 = {
        symbol: (plan2.symbol.trim() || plan1.symbol.trim()).toUpperCase(),
        targetPrice: plan2.limitPrice.trim(),
        side: plan2.side,
      };
    }

    try {
      const res = await fetch("/api/nova-radar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.plans)) {
        setPlans(data.plans as NovaRadarPlanResult[]);
        setRecommendation((data.recommendation as NovaRadarRecommendation) ?? null);
        const first = (data.plans as NovaRadarPlanResult[])[0];
        setSharedTfs(first?.structureTimeframes ?? null);
        setDisclaimer(typeof data.disclaimer === "string" ? data.disclaimer : null);
      } else {
        setPlans(null);
        setRecommendation(null);
        setSharedTfs(null);
        setError(data?.locked ? "NovaRadar is for VIP subscribers." : (data?.error ?? `Error ${res.status}`));
      }
    } catch (e) {
      setPlans(null);
      setRecommendation(null);
      setError(e instanceof Error ? e.message : "NovaRadar failed");
    } finally {
      setLoading(false);
    }
  };

  const bestId: NovaRadarPlanId | null = recommendation?.bestPlanId ?? null;

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
      <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-2">NovaRadar (limit orders)</h2>
      <p className="text-xs text-muted-foreground mb-4">
        VIP only. Set <strong className="font-medium text-zinc-700 dark:text-zinc-300">trade plan 1</strong> (required) and optionally{" "}
        <strong className="font-medium text-zinc-700 dark:text-zinc-300">trade plan 2</strong> to compare two limits on the same or different
        contracts. NovaRadar scores structure alignment, realism, and illustrative timing—then recommends the stronger plan with reasons.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="rounded-lg border border-violet-200/80 dark:border-violet-800/60 bg-violet-50/30 dark:bg-violet-950/20 p-4">
          <p className="text-sm font-semibold text-violet-900 dark:text-violet-100 mb-3">Trade plan 1</p>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Contract</label>
              <input
                type="text"
                placeholder="e.g. XAU, BTC"
                value={plan1.symbol}
                onChange={(e) => setPlan1((p) => ({ ...p, symbol: e.target.value.toUpperCase() }))}
                className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 w-28 bg-white dark:bg-zinc-800"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Limit price ($)</label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="e.g. 4475"
                value={plan1.limitPrice}
                onChange={(e) => setPlan1((p) => ({ ...p, limitPrice: e.target.value }))}
                className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 w-36 bg-white dark:bg-zinc-800"
              />
            </div>
            <div>
              <span className="text-xs text-muted-foreground block mb-1">Side</span>
              <SideToggle side={plan1.side} onChange={(side) => setPlan1((p) => ({ ...p, side }))} />
            </div>
          </div>
        </div>

        <div
          className={`rounded-lg border p-4 transition-colors ${
            usePlan2
              ? "border-zinc-300 dark:border-zinc-600 bg-zinc-50/50 dark:bg-zinc-900/30"
              : "border-dashed border-zinc-300 dark:border-zinc-600 bg-transparent"
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-3">
            <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Trade plan 2</p>
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={usePlan2}
                onChange={(e) => setUsePlan2(e.target.checked)}
                className="rounded border-zinc-400"
              />
              Compare a second limit
            </label>
          </div>
          {usePlan2 ? (
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Contract</label>
                <input
                  type="text"
                  placeholder={plan1.symbol || "Same as plan 1"}
                  value={plan2.symbol}
                  onChange={(e) => setPlan2((p) => ({ ...p, symbol: e.target.value.toUpperCase() }))}
                  className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 w-28 bg-white dark:bg-zinc-800"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Limit price ($)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="e.g. 4495"
                  value={plan2.limitPrice}
                  onChange={(e) => setPlan2((p) => ({ ...p, limitPrice: e.target.value }))}
                  className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 w-36 bg-white dark:bg-zinc-800"
                />
              </div>
              <div>
                <span className="text-xs text-muted-foreground block mb-1">Side</span>
                <SideToggle side={plan2.side} onChange={(side) => setPlan2((p) => ({ ...p, side }))} />
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Optional—enable to compare two limits (e.g. 4475 vs 4495 long on XAU).</p>
          )}
        </div>
      </div>

      <Button onClick={run} disabled={loading || !plan1.symbol.trim()} className="mb-4">
        {loading ? "Running…" : "Run NovaRadar"}
      </Button>

      {error && <p className="text-sm text-rose-600 dark:text-rose-400 mb-3">{error}</p>}
      {!loading && !error && !plans && (
        <p className="text-xs text-muted-foreground">Fill trade plan 1, optionally enable plan 2, then run. Unrealistic levels are flagged on each card.</p>
      )}

      {recommendation && plans && (
        <div className="space-y-4">
          <div className="rounded-md border border-violet-300 dark:border-violet-700 bg-violet-50/60 dark:bg-violet-950/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-800 dark:text-violet-200 mb-1">
              {recommendation.compareMode ? "Best trade (comparison)" : "Assessment"}
            </p>
            <p className="text-sm text-violet-950 dark:text-violet-50 mb-2">{recommendation.headline}</p>
            <ul className="text-xs text-violet-900/95 dark:text-violet-100/95 list-disc pl-4 space-y-1">
              {recommendation.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            {plans.map((p) => (
              <PlanCard key={p.planId} plan={p} recommended={bestId === p.planId} />
            ))}
          </div>

          {sharedTfs && sharedTfs.length > 0 && (
            <div className="overflow-x-auto">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Structure timeframes (5m → 4w) · touches = retests near period low (S) / high (R)
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">TF</TableHead>
                    <TableHead className="text-right text-xs">Support</TableHead>
                    <TableHead className="text-right text-xs">S touches</TableHead>
                    <TableHead className="text-right text-xs">Resistance</TableHead>
                    <TableHead className="text-right text-xs">R touches</TableHead>
                    <TableHead className="text-left text-xs">Bias</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sharedTfs.map((tf) => (
                    <TableRow key={tf.id}>
                      <TableCell className="text-xs">{tf.label}</TableCell>
                      <TableCell className="text-right font-mono text-xs text-emerald-600 dark:text-emerald-400">
                        ${tf.support.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                        {tf.supportTouches ?? 0}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-rose-600 dark:text-rose-400">
                        ${tf.resistance.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                        {tf.resistanceTouches ?? 0}
                      </TableCell>
                      <TableCell className="text-xs capitalize">{tf.direction}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {disclaimer && (
            <p className="text-[11px] text-muted-foreground leading-relaxed border-t border-zinc-200 dark:border-zinc-700 pt-3">
              {disclaimer}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
