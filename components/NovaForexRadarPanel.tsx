"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import TradingRiskDisclaimer from "@/components/TradingRiskDisclaimer";
import { formatQuotePriceUsd } from "@/lib/format-quote-price";
import type { NovaRadarPlanId, NovaRadarPlanResult, NovaRadarRecommendation } from "@/lib/nova-radar";
import {
  CAPITAL_GUARD_LABELS,
  CAPITAL_GUARD_MAX_LOSS_PCT,
  type NovaRadarCapitalGuard,
  type NovaRadarCapitalRiskTolerance,
} from "@/lib/nova-radar-capital-guard";

type PlanForm = {
  limitPrice: string;
  side: "long" | "short";
  takeProfit: string;
  stopLoss: string;
};

const emptyPlan = (): PlanForm => ({
  limitPrice: "",
  side: "long",
  takeProfit: "",
  stopLoss: "",
});

const inputClass =
  "text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100";

const selectClass =
  "text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 min-w-[160px] bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100";

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

function realismBadgeClass(realism: NovaRadarPlanResult["realism"]) {
  if (realism === "unrealistic") return "border-rose-600/80 text-rose-800 dark:text-rose-200";
  if (realism === "stretched") return "border-amber-500/60 text-slate-700 dark:text-slate-200";
  return "border-emerald-500/60 text-emerald-800 dark:text-emerald-200";
}

function realismLabel(realism: NovaRadarPlanResult["realism"]) {
  if (realism === "unrealistic") return "Unrealistic";
  if (realism === "stretched") return "Stretched";
  return "Plausible";
}

function leverageRiskBadgeClass(risk: NonNullable<NovaRadarPlanResult["leverage"]>["leverageRisk"]) {
  if (risk === "extreme") return "border-rose-600/80 text-rose-800 dark:text-rose-200";
  if (risk === "high") return "border-orange-500/70 text-orange-800 dark:text-orange-200";
  if (risk === "moderate") return "border-amber-500/60 text-slate-700 dark:text-slate-200";
  return "border-sky-500/60 text-sky-800 dark:text-sky-200";
}

function CapitalGuardCard({
  guard,
  onApplySl,
}: {
  guard: NovaRadarCapitalGuard;
  onApplySl?: () => void;
}) {
  return (
    <div className="rounded-md border border-emerald-200/80 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/25 p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-emerald-900 dark:text-emerald-100">Nova Capital Guard</span>
        <Badge variant="outline" className="border-emerald-500/60 text-emerald-800 dark:text-emerald-200">
          {guard.riskToleranceLabel}
        </Badge>
        <span className="text-xs text-muted-foreground">
          Max {guard.maxLossPctOfInvestment}% of ${guard.investmentAmountUsdt.toLocaleString()} margin
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div>
          <span className="text-muted-foreground block">Recommended SL</span>
          <span className="font-mono text-emerald-800 dark:text-emerald-200">
            {formatQuotePriceUsd(guard.finalStopLossPrice)}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground block">Loss if SL hits</span>
          <span className="text-rose-600 dark:text-rose-400 font-mono">~${guard.lossAtSlUsdt.toFixed(2)}</span>
        </div>
        <div>
          <span className="text-muted-foreground block">Loss % of margin</span>
          <span className="text-rose-600 dark:text-rose-400">~{guard.lossAtSlPctOfInvestment.toFixed(1)}%</span>
        </div>
        <div>
          <span className="text-muted-foreground block">ROE @ SL</span>
          <span className="text-rose-600 dark:text-rose-400">{guard.roeAtSlPct.toFixed(1)}%</span>
        </div>
      </div>
      {onApplySl && (
        <Button type="button" variant="outline" size="sm" className="text-xs h-8" onClick={onApplySl}>
          Apply recommended SL to form
        </Button>
      )}
      {guard.flipSuggestion && (
        <div className="rounded border border-emerald-300/50 dark:border-emerald-700/50 bg-white/50 dark:bg-zinc-900/40 p-2 text-xs">
          <p className="font-semibold text-emerald-900 dark:text-emerald-100">{guard.flipSuggestion.headline}</p>
          <p className="text-muted-foreground mt-0.5">{guard.flipSuggestion.triggerCondition}</p>
          <p className="mt-1 text-emerald-950/90 dark:text-emerald-50/90">{guard.flipSuggestion.note}</p>
        </div>
      )}
      <ul className="text-[11px] text-emerald-900/90 dark:text-emerald-100/90 list-disc pl-4 space-y-0.5">
        {guard.notes.slice(0, 4).map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </div>
  );
}

function PlanCard({ plan, recommended }: { plan: NovaRadarPlanResult; recommended: boolean }) {
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
          <span className="font-mono">{formatQuotePriceUsd(plan.currentPrice)}</span>
        </div>
        <div>
          <span className="text-muted-foreground block">Limit</span>
          <span className="font-mono">{formatQuotePriceUsd(plan.targetPrice)}</span>
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
      {plan.leverage && (
        <div className="rounded-md border border-sky-200/80 dark:border-sky-800/60 bg-sky-50/40 dark:bg-sky-950/25 p-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-sky-900 dark:text-sky-100">
              Leverage · {plan.leverage.leverage}×
            </span>
            <Badge variant="outline" className={leverageRiskBadgeClass(plan.leverage.leverageRisk)}>
              {plan.leverage.leverageRisk} risk
            </Badge>
            {plan.leverage.riskRewardToTp != null && (
              <span className="text-xs text-muted-foreground">
                R:R to TP ~{plan.leverage.riskRewardToTp.toFixed(2)}:1 (ROE)
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {plan.leverage.roeAtTpPct != null && (
              <div>
                <span className="text-muted-foreground block">ROE @ TP</span>
                <span className={plan.leverage.roeAtTpPct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600"}>
                  {plan.leverage.roeAtTpPct >= 0 ? "+" : ""}
                  {plan.leverage.roeAtTpPct.toFixed(1)}%
                </span>
              </div>
            )}
            {plan.leverage.roeAtSlPct != null && (
              <div>
                <span className="text-muted-foreground block">ROE @ SL</span>
                <span className="text-rose-600 dark:text-rose-400">{plan.leverage.roeAtSlPct.toFixed(1)}%</span>
              </div>
            )}
            {plan.leverage.estimatedLiqPrice != null && (
              <div>
                <span className="text-muted-foreground block">Est. liq.</span>
                <span className="font-mono text-rose-700 dark:text-rose-300">
                  {formatQuotePriceUsd(plan.leverage.estimatedLiqPrice)}
                </span>
              </div>
            )}
          </div>
          {plan.leverage.maintenanceMarginNote && (
            <p className="text-[11px] text-muted-foreground">{plan.leverage.maintenanceMarginNote}</p>
          )}
        </div>
      )}
      {plan.capitalGuard && <CapitalGuardCard guard={plan.capitalGuard} />}
    </div>
  );
}

type Props = {
  symbol: string;
};

export default function NovaForexRadarPanel({ symbol }: Props) {
  const [plan1, setPlan1] = useState<PlanForm>(() => emptyPlan());
  const [plan2, setPlan2] = useState<PlanForm>(() => emptyPlan());
  const [usePlan2, setUsePlan2] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plans, setPlans] = useState<NovaRadarPlanResult[] | null>(null);
  const [recommendation, setRecommendation] = useState<NovaRadarRecommendation | null>(null);
  const [disclaimer, setDisclaimer] = useState<string | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [contractDescription, setContractDescription] = useState<string | null>(null);

  const [leverage, setLeverage] = useState("1:500");
  const [takeProfit, setTakeProfit] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [useLeverage, setUseLeverage] = useState(true);
  const [investmentAmount, setInvestmentAmount] = useState("");
  const [capitalRiskTolerance, setCapitalRiskTolerance] = useState<NovaRadarCapitalRiskTolerance | "">("");
  const [useCapitalGuard, setUseCapitalGuard] = useState(false);

  useEffect(() => {
    setPlans(null);
    setRecommendation(null);
    setError(null);
  }, [symbol]);

  const appendPlanExits = (block: Record<string, unknown>, form: PlanForm) => {
    if (form.takeProfit.trim()) block.takeProfitPrice = form.takeProfit.trim();
    if (form.stopLoss.trim()) block.stopLossPrice = form.stopLoss.trim();
  };

  const run = async () => {
    setLoading(true);
    setError(null);
    const sym = symbol.trim();
    if (!sym) {
      setError("Enter a symbol above (e.g. XAUUSD).");
      setLoading(false);
      return;
    }
    const p1Price = plan1.limitPrice.trim();
    if (!p1Price) {
      setError("Enter a limit price for trade plan 1.");
      setLoading(false);
      return;
    }

    const plan1Block: Record<string, unknown> = {
      symbol: sym,
      targetPrice: p1Price,
      side: plan1.side,
    };
    appendPlanExits(plan1Block, plan1);
    const payload: Record<string, unknown> = { symbol: sym, plan1: plan1Block };

    if (usePlan2 && plan2.limitPrice.trim()) {
      const plan2Block: Record<string, unknown> = {
        symbol: sym,
        targetPrice: plan2.limitPrice.trim(),
        side: plan2.side,
      };
      appendPlanExits(plan2Block, plan2);
      payload.plan2 = plan2Block;
    }

    if (useLeverage && leverage.trim()) {
      payload.leverage = leverage.trim();
      if (takeProfit.trim()) payload.takeProfitPrice = takeProfit.trim();
      if (stopLoss.trim()) payload.stopLossPrice = stopLoss.trim();
    }

    if (useCapitalGuard && capitalRiskTolerance && investmentAmount.trim()) {
      payload.capitalRiskTolerance = capitalRiskTolerance;
      payload.investmentAmountUsdt = investmentAmount.trim();
      if (!useLeverage && leverage.trim()) {
        payload.leverage = leverage.trim();
      }
    }

    try {
      const res = await fetch("/api/nova-forex/nova-radar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.plans)) {
        setPlans(data.plans as NovaRadarPlanResult[]);
        setRecommendation((data.recommendation as NovaRadarRecommendation) ?? null);
        setDisclaimer(typeof data.disclaimer === "string" ? data.disclaimer : null);
        setCurrentPrice(typeof data.currentPrice === "number" ? data.currentPrice : null);
        setContractDescription(typeof data.contractDescription === "string" ? data.contractDescription : null);
      } else {
        setPlans(null);
        setRecommendation(null);
        setError(data?.error ?? `Error ${res.status}`);
      }
    } catch (e) {
      setPlans(null);
      setRecommendation(null);
      setError(e instanceof Error ? e.message : "Nova Forex Radar failed");
    } finally {
      setLoading(false);
    }
  };

  const bestId: NovaRadarPlanId | null = recommendation?.bestPlanId ?? null;

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
      <p className="text-xs text-muted-foreground mb-3">
        MT5-style limit plans on {symbol.trim() || "your symbol"} — compare one or two entries with structure alignment,
        leverage (e.g. 1:2000), and optional Capital Guard for suggested stop loss. Yahoo Finance reference prices; your
        broker bid/ask may differ.
      </p>
      <TradingRiskDisclaimer compact context="radar" />

      <div className="rounded-lg border border-sky-200/70 dark:border-sky-800/50 bg-sky-50/30 dark:bg-sky-950/20 p-4 my-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <p className="text-sm font-semibold text-sky-900 dark:text-sky-100">Leverage &amp; exits (MT5)</p>
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={useLeverage}
              onChange={(e) => setUseLeverage(e.target.checked)}
              className="rounded border-zinc-400"
            />
            Include ROE / liq estimates
          </label>
        </div>
        {useLeverage ? (
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Leverage</label>
              <input
                type="text"
                placeholder="1:500 or 2000"
                value={leverage}
                onChange={(e) => setLeverage(e.target.value)}
                className={`${inputClass} w-28`}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Take profit</label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="optional"
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
                className={`${inputClass} w-28`}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Stop loss</label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="optional"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                className={`${inputClass} w-28`}
              />
            </div>
            <p className="text-[11px] text-muted-foreground max-w-lg">
              Use broker leverage (1:100 … 1:2000). Per-plan TP/SL override defaults. Liquidation is illustrative
              isolated margin — confirm on MT5.
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Enable to see ROE at TP/SL and approximate liquidation per plan.</p>
        )}
      </div>

      <div className="rounded-lg border border-emerald-200/70 dark:border-emerald-800/50 bg-emerald-50/30 dark:bg-emerald-950/20 p-4 mb-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div>
            <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">Nova Capital Guard (optional)</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Caps loss at your risk level and recommends a stop loss for manual or EA execution.
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={useCapitalGuard}
              onChange={(e) => setUseCapitalGuard(e.target.checked)}
              className="rounded border-zinc-400"
            />
            Enable
          </label>
        </div>
        {useCapitalGuard ? (
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Risk level</label>
              <select
                value={capitalRiskTolerance}
                onChange={(e) => setCapitalRiskTolerance(e.target.value as NovaRadarCapitalRiskTolerance | "")}
                className={selectClass}
              >
                <option value="">Select…</option>
                {(Object.keys(CAPITAL_GUARD_LABELS) as NovaRadarCapitalRiskTolerance[]).map((key) => (
                  <option key={key} value={key}>
                    {CAPITAL_GUARD_LABELS[key]} (~{CAPITAL_GUARD_MAX_LOSS_PCT[key]}% max loss)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Margin (USD)</label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="e.g. 100"
                value={investmentAmount}
                onChange={(e) => setInvestmentAmount(e.target.value)}
                className={`${inputClass} w-28`}
              />
            </div>
            {plans?.[0]?.capitalGuard && !stopLoss.trim() && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs border-emerald-400 text-emerald-800 dark:text-emerald-200"
                onClick={() => setStopLoss(String(plans[0].capitalGuard!.finalStopLossPrice))}
              >
                Apply recommended SL ({formatQuotePriceUsd(plans[0].capitalGuard.finalStopLossPrice)})
              </Button>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Set risk level + margin to get a suggested stop loss and max loss in $ and %.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="rounded-lg border border-violet-200/80 dark:border-violet-800/60 bg-violet-50/30 dark:bg-violet-950/20 p-4">
          <p className="text-sm font-semibold text-violet-900 dark:text-violet-100 mb-3">Trade plan 1</p>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Limit price</label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="e.g. 2650"
                value={plan1.limitPrice}
                onChange={(e) => setPlan1((p) => ({ ...p, limitPrice: e.target.value }))}
                className={`${inputClass} w-36`}
              />
            </div>
            <div>
              <span className="text-xs text-muted-foreground block mb-1">Side</span>
              <SideToggle side={plan1.side} onChange={(side) => setPlan1((p) => ({ ...p, side }))} />
            </div>
            {useLeverage && (
              <>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">TP</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={plan1.takeProfit}
                    onChange={(e) => setPlan1((p) => ({ ...p, takeProfit: e.target.value }))}
                    className={`${inputClass} w-24`}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">SL</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={plan1.stopLoss}
                    onChange={(e) => setPlan1((p) => ({ ...p, stopLoss: e.target.value }))}
                    className={`${inputClass} w-24`}
                  />
                </div>
              </>
            )}
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
              Second entry (scale in)
            </label>
          </div>
          {usePlan2 ? (
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Limit price</label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="e.g. 2640"
                  value={plan2.limitPrice}
                  onChange={(e) => setPlan2((p) => ({ ...p, limitPrice: e.target.value }))}
                  className={`${inputClass} w-36`}
                />
              </div>
              <div>
                <span className="text-xs text-muted-foreground block mb-1">Side</span>
                <SideToggle side={plan2.side} onChange={(side) => setPlan2((p) => ({ ...p, side }))} />
              </div>
              {useLeverage && (
                <>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">TP</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={plan2.takeProfit}
                      onChange={(e) => setPlan2((p) => ({ ...p, takeProfit: e.target.value }))}
                      className={`${inputClass} w-24`}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">SL</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={plan2.stopLoss}
                      onChange={(e) => setPlan2((p) => ({ ...p, stopLoss: e.target.value }))}
                      className={`${inputClass} w-24`}
                    />
                  </div>
                </>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Optional — compare two limits (e.g. scale into XAU at 2650 and 2640).
            </p>
          )}
        </div>
      </div>

      <Button onClick={run} disabled={loading || !symbol.trim()}>
        {loading ? "Running…" : "Run NovaForex Radar"}
      </Button>

      {error && <p className="text-sm text-rose-600 dark:text-rose-400 mt-3">{error}</p>}

      {plans && plans.length > 0 && (
        <div className="mt-6 space-y-4">
          {currentPrice != null && (
            <p className="text-xs text-muted-foreground">
              Reference spot: {formatQuotePriceUsd(currentPrice)}
              {contractDescription ? ` · ${contractDescription}` : ""}
            </p>
          )}
          {recommendation && (
            <div className="rounded-md border border-violet-300/60 dark:border-violet-700/50 bg-violet-50/50 dark:bg-violet-950/30 p-3 text-sm">
              <p className="font-semibold text-violet-900 dark:text-violet-100">{recommendation.headline}</p>
              <ul className="text-xs text-muted-foreground mt-2 list-disc pl-4 space-y-1">
                {recommendation.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {plans.map((plan) => (
              <PlanCard key={plan.planId} plan={plan} recommended={plan.planId === bestId} />
            ))}
          </div>
          {disclaimer && <p className="text-[11px] text-muted-foreground">{disclaimer}</p>}
        </div>
      )}
    </div>
  );
}
