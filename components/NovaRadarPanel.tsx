"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import NovaRadarPreTradeChecklist from "@/components/NovaRadarPreTradeChecklist";
import type {
  NovaRadarPlanId,
  NovaRadarPlanResult,
  NovaRadarRecommendation,
} from "@/lib/nova-radar";
import { buildSplitOrderSuggestion, type NovaRadarSplitSuggestion } from "@/lib/nova-radar-split";
import {
  deleteNovaRadarSetup,
  loadNovaRadarSetups,
  saveNovaRadarSetup,
  type NovaRadarSavedSetup,
} from "@/lib/nova-radar-setups";
import type { UnifiedMarketRead } from "@/lib/nova-market-read";
import { formatQuotePrice } from "@/lib/format-quote-price";

type PlanForm = {
  symbol: string;
  limitPrice: string;
  side: "long" | "short";
  takeProfit: string;
  stopLoss: string;
};

const emptyPlan = (symbol = "BTC"): PlanForm => ({
  symbol,
  limitPrice: "",
  side: "long",
  takeProfit: "",
  stopLoss: "",
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

function leverageRiskBadgeClass(risk: NonNullable<NovaRadarPlanResult["leverage"]>["leverageRisk"]) {
  if (risk === "extreme") return "border-rose-600/80 text-rose-800 dark:text-rose-200";
  if (risk === "high") return "border-orange-500/70 text-orange-800 dark:text-orange-200";
  if (risk === "moderate") return "border-amber-500/60 text-amber-800 dark:text-amber-200";
  return "border-sky-500/60 text-sky-800 dark:text-sky-200";
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
        {plan.fillProbability && (
          <Badge
            variant="outline"
            className="border-indigo-400/60 text-indigo-800 dark:text-indigo-200"
            title={plan.fillProbability.note}
          >
            Fill ~{plan.fillProbability.probabilityPct}% ({plan.fillProbability.label})
          </Badge>
        )}
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
            {plan.leverage.roeAtStressPct != null && plan.leverage.stressPrice != null && (
              <div>
                <span className="text-muted-foreground block">ROE @ stress</span>
                <span className="text-rose-600 dark:text-rose-400">
                  {plan.leverage.roeAtStressPct.toFixed(1)}% (${plan.leverage.stressPrice.toLocaleString()})
                </span>
              </div>
            )}
            {plan.leverage.estimatedLiqPrice != null && (
              <div>
                <span className="text-muted-foreground block">Est. liq.</span>
                <span className="font-mono text-rose-700 dark:text-rose-300">
                  ${plan.leverage.estimatedLiqPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
              </div>
            )}
            {plan.leverage.maintenanceMarginRate > 0 && (
              <div className="col-span-2 sm:col-span-4">
                <span className="text-muted-foreground block">Blofin MMR (est.)</span>
                <span className="text-xs">
                  {(plan.leverage.maintenanceMarginRate * 100).toFixed(2)}%
                  {plan.leverage.maintenanceMarginNote ? ` · ${plan.leverage.maintenanceMarginNote}` : ""}
                </span>
              </div>
            )}
          </div>
          <ul className="text-[11px] text-sky-900/90 dark:text-sky-100/90 list-disc pl-4 space-y-0.5">
            {plan.leverage.notes.slice(1).map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      )}
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
  const [leverage, setLeverage] = useState("30");
  const [takeProfit, setTakeProfit] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [useLeverage, setUseLeverage] = useState(true);
  const [positionNotional, setPositionNotional] = useState("");
  const [marketRead, setMarketRead] = useState<UnifiedMarketRead | null>(null);
  const [splitSuggestion, setSplitSuggestion] = useState<NovaRadarSplitSuggestion | null>(null);
  const [blofinKeysConfigured, setBlofinKeysConfigured] = useState<boolean | null>(null);
  const [splitDeepPct, setSplitDeepPct] = useState(70);
  const [savedSetups, setSavedSetups] = useState<NovaRadarSavedSetup[]>([]);
  const [setupName, setSetupName] = useState("");

  useEffect(() => {
    setSavedSetups(loadNovaRadarSetups());
    fetch("/api/user/blofin-config", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setBlofinKeysConfigured(d.success && d.configured === true))
      .catch(() => setBlofinKeysConfigured(null));
  }, []);

  const appendPlanExits = (block: Record<string, unknown>, form: PlanForm) => {
    if (form.takeProfit.trim()) block.takeProfitPrice = form.takeProfit.trim();
    if (form.stopLoss.trim()) block.stopLossPrice = form.stopLoss.trim();
  };

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

    const plan1Block: Record<string, unknown> = {
      symbol: plan1.symbol.trim().toUpperCase(),
      targetPrice: p1Price,
      side: plan1.side,
    };
    appendPlanExits(plan1Block, plan1);
    const payload: Record<string, unknown> = { plan1: plan1Block };

    if (usePlan2 && plan2.limitPrice.trim()) {
      const plan2Block: Record<string, unknown> = {
        symbol: (plan2.symbol.trim() || plan1.symbol.trim()).toUpperCase(),
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
      if (positionNotional.trim()) payload.positionNotionalUsdt = positionNotional.trim();
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
        setMarketRead(data.marketRead ?? null);
        setSplitSuggestion(data.splitSuggestion ?? null);
        if (typeof data.blofinKeysConfigured === "boolean") {
          setBlofinKeysConfigured(data.blofinKeysConfigured);
        }
      } else {
        setPlans(null);
        setRecommendation(null);
        setSharedTfs(null);
        setMarketRead(null);
        setSplitSuggestion(null);
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
  const leverageNum = useLeverage && leverage.trim() ? Number(leverage) : null;
  const tpPrice =
    takeProfit.trim() ||
    plan1.takeProfit.trim() ||
    plan2.takeProfit.trim() ||
    null;
  const liveSplit =
    plans && plans.length >= 2 && leverageNum != null && Number.isFinite(leverageNum)
      ? buildSplitOrderSuggestion(
          plans,
          tpPrice ? Number(tpPrice) : null,
          leverageNum,
          splitDeepPct
        )
      : splitSuggestion;

  const handleSaveSetup = () => {
    const name = setupName.trim() || `${plan1.symbol} ${new Date().toLocaleDateString()}`;
    const next = saveNovaRadarSetup({
      name,
      plan1: { ...plan1 },
      plan2: usePlan2 && plan2.limitPrice.trim() ? { ...plan2 } : undefined,
      usePlan2,
      leverage: useLeverage ? leverage : undefined,
      takeProfit: takeProfit || undefined,
      stopLoss: stopLoss || undefined,
      positionNotional: positionNotional || undefined,
    });
    setSavedSetups(next);
    setSetupName("");
  };

  const applySetup = (s: NovaRadarSavedSetup) => {
    setPlan1({ ...s.plan1, takeProfit: s.plan1.takeProfit ?? "", stopLoss: s.plan1.stopLoss ?? "" });
    if (s.plan2 && s.usePlan2) {
      setPlan2({ ...s.plan2, takeProfit: s.plan2.takeProfit ?? "", stopLoss: s.plan2.stopLoss ?? "" });
      setUsePlan2(true);
    } else {
      setUsePlan2(false);
    }
    if (s.leverage) {
      setUseLeverage(true);
      setLeverage(s.leverage);
    }
    if (s.takeProfit) setTakeProfit(s.takeProfit);
    if (s.stopLoss) setStopLoss(s.stopLoss);
    if (s.positionNotional) setPositionNotional(s.positionNotional);
  };

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
      <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-2">NovaRadar (limit orders)</h2>
      <p className="text-xs text-muted-foreground mb-4">
        VIP only. Set <strong className="font-medium text-zinc-700 dark:text-zinc-300">trade plan 1</strong> (required) and optionally{" "}
        <strong className="font-medium text-zinc-700 dark:text-zinc-300">trade plan 2</strong> to compare two limits on the same or different
        contracts. NovaRadar scores structure alignment, realism, and illustrative timing—optionally with leverage, TP, and SL for ROE and risk/reward—then recommends the stronger plan with reasons.
      </p>

      <div className="rounded-lg border border-sky-200/70 dark:border-sky-800/50 bg-sky-50/30 dark:bg-sky-950/20 p-4 mb-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <p className="text-sm font-semibold text-sky-900 dark:text-sky-100">Leverage &amp; exits (optional)</p>
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
              <label className="text-xs text-muted-foreground block mb-1">Leverage (×)</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="30"
                value={leverage}
                onChange={(e) => setLeverage(e.target.value)}
                className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 w-20 bg-white dark:bg-zinc-800"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Take profit ($)</label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="e.g. 4540"
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
                className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 w-28 bg-white dark:bg-zinc-800"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Stop loss ($)</label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="e.g. 4470"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 w-28 bg-white dark:bg-zinc-800"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Position (USDT)</label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="e.g. 5000"
                value={positionNotional}
                onChange={(e) => setPositionNotional(e.target.value)}
                className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 w-28 bg-white dark:bg-zinc-800"
              />
            </div>
            <p className="text-[11px] text-muted-foreground max-w-lg">
              <span title="Return on equity — PnL as % of margin, ≈ price move % × leverage">ROE</span>
              {" · "}
              <span title="Maintenance margin rate — Blofin tier by position size">MMR</span>
              {" · "}
              <span title="Aligned = limit path matches bearish/bullish structure sample">Aligned</span>
              : per-plan TP/SL override defaults. Position USDT sets Blofin tier
              {blofinKeysConfigured ? " (your API keys → live contract size)" : ""}.
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Enable to see ROE at TP/SL, risk/reward, and approximate liquidation per plan.</p>
        )}
      </div>

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
            {useLeverage && (
              <>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">TP ($)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder={takeProfit || "optional"}
                    value={plan1.takeProfit}
                    onChange={(e) => setPlan1((p) => ({ ...p, takeProfit: e.target.value }))}
                    className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 w-24 bg-white dark:bg-zinc-800"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">SL ($)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder={stopLoss || "optional"}
                    value={plan1.stopLoss}
                    onChange={(e) => setPlan1((p) => ({ ...p, stopLoss: e.target.value }))}
                    className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 w-24 bg-white dark:bg-zinc-800"
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
              {useLeverage && (
                <>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">TP ($)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder={takeProfit || "optional"}
                      value={plan2.takeProfit}
                      onChange={(e) => setPlan2((p) => ({ ...p, takeProfit: e.target.value }))}
                      className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 w-24 bg-white dark:bg-zinc-800"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">SL ($)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder={stopLoss || "optional"}
                      value={plan2.stopLoss}
                      onChange={(e) => setPlan2((p) => ({ ...p, stopLoss: e.target.value }))}
                      className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 w-24 bg-white dark:bg-zinc-800"
                    />
                  </div>
                </>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Optional—enable to compare two limits (e.g. 4475 vs 4495 long on XAU).</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Button onClick={run} disabled={loading || !plan1.symbol.trim()}>
          {loading ? "Running…" : "Run NovaRadar"}
        </Button>
        <input
          type="text"
          placeholder="Setup name"
          value={setupName}
          onChange={(e) => setSetupName(e.target.value)}
          className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 w-36 bg-white dark:bg-zinc-800"
        />
        <Button type="button" variant="outline" size="sm" onClick={handleSaveSetup} disabled={!plan1.limitPrice.trim()}>
          Save setup
        </Button>
        {savedSetups.length > 0 && (
          <select
            className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800 max-w-[200px]"
            defaultValue=""
            onChange={(e) => {
              const id = e.target.value;
              if (!id) return;
              const s = savedSetups.find((x) => x.id === id);
              if (s) applySetup(s);
              e.target.value = "";
            }}
          >
            <option value="">Load saved…</option>
            {savedSetups.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
      </div>
      {savedSetups.length > 0 && (
        <ul className="text-[11px] text-muted-foreground mb-3 flex flex-wrap gap-2">
          {savedSetups.slice(0, 6).map((s) => (
            <li key={s.id} className="flex items-center gap-1">
              <button type="button" className="underline" onClick={() => applySetup(s)}>
                {s.name}
              </button>
              <button
                type="button"
                className="text-rose-600"
                onClick={() => setSavedSetups(deleteNovaRadarSetup(s.id))}
                aria-label={`Delete ${s.name}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-sm text-rose-600 dark:text-rose-400 mb-3">{error}</p>}
      {!loading && !error && !plans && (
        <p className="text-xs text-muted-foreground">Fill trade plan 1, optionally enable plan 2, then run. Unrealistic levels are flagged on each card.</p>
      )}

      {recommendation && plans && (
        <div className="space-y-4">
          {marketRead && (
            <div className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50/60 dark:bg-zinc-900/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400 mb-1">
                Market read (unified)
              </p>
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">{marketRead.headline}</p>
              <ul className="text-xs text-zinc-700 dark:text-zinc-300 list-disc pl-4 space-y-1">
                {marketRead.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          )}
          <NovaRadarPreTradeChecklist
            plans={plans}
            leverage={leverageNum != null && Number.isFinite(leverageNum) ? leverageNum : null}
          />
          <div className="rounded-md border border-violet-300 dark:border-violet-700 bg-violet-50/60 dark:bg-violet-950/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-800 dark:text-violet-200 mb-1">
              {recommendation.compareMode ? "Best trade (comparison)" : "Assessment"}
            </p>
            <p className="text-sm text-violet-950 dark:text-violet-50 mb-1">{recommendation.headline}</p>
            {recommendation.subheadline && (
              <p className="text-xs text-violet-800/95 dark:text-violet-200/95 mb-2 font-medium">{recommendation.subheadline}</p>
            )}
            <ul className="text-xs text-violet-900/95 dark:text-violet-100/95 list-disc pl-4 space-y-1">
              {recommendation.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>

          {plans.length >= 2 && liveSplit && useLeverage && (
            <div className="rounded-md border border-emerald-200/80 dark:border-emerald-800/50 bg-emerald-50/30 dark:bg-emerald-950/20 p-4">
              <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-100 mb-2">Split-order idea</p>
              <label className="text-xs text-muted-foreground flex items-center gap-2 mb-2">
                Deeper limit allocation: {splitDeepPct}%
                <input
                  type="range"
                  min={40}
                  max={90}
                  value={splitDeepPct}
                  onChange={(e) => setSplitDeepPct(Number(e.target.value))}
                  className="flex-1 max-w-xs"
                />
                {100 - splitDeepPct}% shallower
              </label>
              <p className="text-xs text-emerald-950/90 dark:text-emerald-50/90">{liveSplit.note}</p>
              {liveSplit.roeAtTpPct != null && (
                <p className="text-xs mt-1 text-muted-foreground">
                  Blended entry ~${liveSplit.blendedEntry.toFixed(2)}
                  {liveSplit.roeAtTpPct != null && ` · TP ROE ~${liveSplit.roeAtTpPct.toFixed(1)}%`}
                </p>
              )}
            </div>
          )}

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
                        ${formatQuotePrice(tf.support)}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                        {tf.supportTouches ?? 0}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-rose-600 dark:text-rose-400">
                        ${formatQuotePrice(tf.resistance)}
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
