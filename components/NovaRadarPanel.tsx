"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import NovaRadarPreTradeChecklist from "@/components/NovaRadarPreTradeChecklist";
import PlatformHealthStrip from "@/components/PlatformHealthStrip";
import TradingRiskDisclaimer from "@/components/TradingRiskDisclaimer";
import type {
  NovaRadarPlanId,
  NovaRadarPlanResult,
  NovaRadarRecommendation,
} from "@/lib/nova-radar";
import {
  CAPITAL_GUARD_LABELS,
  CAPITAL_GUARD_MAX_LOSS_PCT,
  type NovaRadarCapitalGuard,
  type NovaRadarCapitalRiskTolerance,
} from "@/lib/nova-radar-capital-guard";
import type { NovaRadarBlofinOpenPosition } from "@/lib/nova-radar-blofin-positions";
import { buildSplitOrderSuggestion, type NovaRadarSplitSuggestion } from "@/lib/nova-radar-split";
import {
  deleteNovaRadarSetup,
  loadNovaRadarSetups,
  saveNovaRadarSetup,
  type NovaRadarSavedSetup,
} from "@/lib/nova-radar-setups";
import type { UnifiedMarketRead } from "@/lib/nova-market-read";
import { buildNovaRadarLastRunSnapshot, saveNovaRadarLastRun } from "@/lib/nova-radar-last-run";
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
        {guard.openPosition?.missingStopAlert && (
          <Badge variant="outline" className="border-rose-500/70 text-rose-800 dark:text-rose-200">
            No SL on Blofin
          </Badge>
        )}
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
            ${guard.finalStopLossPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })}
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
      {plan.capitalGuard && <CapitalGuardCard guard={plan.capitalGuard} />}
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
  const [liqPreview, setLiqPreview] = useState<{ liquidationPrice: number; note?: string } | null>(null);
  const [liqPreviewLoading, setLiqPreviewLoading] = useState(false);
  const [investmentAmount, setInvestmentAmount] = useState("");
  const [capitalRiskTolerance, setCapitalRiskTolerance] = useState<NovaRadarCapitalRiskTolerance | "">("");
  const [useCapitalGuard, setUseCapitalGuard] = useState(false);
  const [blofinPositions, setBlofinPositions] = useState<NovaRadarBlofinOpenPosition[]>([]);
  const [positionsLoading, setPositionsLoading] = useState(false);
  const [positionsError, setPositionsError] = useState<string | null>(null);
  const [selectedPositionId, setSelectedPositionId] = useState("");
  const [openPositionGuard, setOpenPositionGuard] = useState<NovaRadarCapitalGuard | null>(null);
  const [openGuardLoading, setOpenGuardLoading] = useState(false);

  const loadBlofinPositions = useCallback(async () => {
    setPositionsLoading(true);
    setPositionsError(null);
    try {
      const res = await fetch("/api/nova-radar/blofin-positions", { credentials: "include" });
      const data = await res.json();
      if (res.ok && data.success) {
        setBlofinPositions(data.positions as NovaRadarBlofinOpenPosition[]);
        if (typeof data.configured === "boolean") setBlofinKeysConfigured(data.configured);
      } else {
        setBlofinPositions([]);
        setPositionsError(data?.error ?? `Error ${res.status}`);
        if (data?.configured === false) setBlofinKeysConfigured(false);
      }
    } catch (e) {
      setBlofinPositions([]);
      setPositionsError(e instanceof Error ? e.message : "Failed to load positions");
    } finally {
      setPositionsLoading(false);
    }
  }, []);

  useEffect(() => {
    setSavedSetups(loadNovaRadarSetups());
    fetch("/api/user/blofin-config", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setBlofinKeysConfigured(d.success && d.configured === true))
      .catch(() => setBlofinKeysConfigured(null));
  }, []);

  useEffect(() => {
    if (blofinKeysConfigured === true) loadBlofinPositions();
  }, [blofinKeysConfigured, loadBlofinPositions]);

  useEffect(() => {
    if (!useLeverage) {
      setLiqPreview(null);
      return;
    }
    const entry = Number(plan1.limitPrice.trim());
    const lev = Number(leverage.trim());
    const notional = Number(positionNotional.trim());
    if (!Number.isFinite(entry) || entry <= 0 || !Number.isFinite(lev) || lev < 1) {
      setLiqPreview(null);
      return;
    }
    if (!Number.isFinite(notional) || notional <= 0) {
      setLiqPreview(null);
      return;
    }
    const timer = window.setTimeout(async () => {
      setLiqPreviewLoading(true);
      try {
        const res = await fetch("/api/nova-radar/blofin-liq", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            symbol: plan1.symbol.trim().toUpperCase() || "BTC",
            entryPrice: entry,
            leverage: lev,
            side: plan1.side,
            positionNotionalUsdt: notional,
          }),
        });
        const data = await res.json();
        if (data.success && data.estimate?.liquidationPrice != null) {
          setLiqPreview({
            liquidationPrice: data.estimate.liquidationPrice,
            note: data.estimate.note,
          });
        } else {
          setLiqPreview(null);
        }
      } catch {
        setLiqPreview(null);
      } finally {
        setLiqPreviewLoading(false);
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [useLeverage, plan1.limitPrice, plan1.symbol, plan1.side, leverage, positionNotional]);

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

    if (useCapitalGuard && capitalRiskTolerance && investmentAmount.trim()) {
      payload.capitalRiskTolerance = capitalRiskTolerance;
      payload.investmentAmountUsdt = investmentAmount.trim();
      if (!useLeverage && leverage.trim()) {
        payload.leverage = leverage.trim();
      }
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
        saveNovaRadarLastRun(
          buildNovaRadarLastRunSnapshot({
            plans: data.plans as NovaRadarPlanResult[],
            recommendation: (data.recommendation as NovaRadarRecommendation) ?? null,
            marketRead: (data.marketRead as UnifiedMarketRead) ?? null,
            leverage: useLeverage ? leverage : undefined,
            takeProfit: takeProfit || undefined,
            stopLoss: stopLoss || undefined,
          })
        );
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
      investmentAmount: investmentAmount || undefined,
      capitalRiskTolerance: capitalRiskTolerance || undefined,
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
    if (s.investmentAmount) {
      setInvestmentAmount(s.investmentAmount);
      setUseCapitalGuard(true);
    }
    if (s.capitalRiskTolerance) {
      setCapitalRiskTolerance(s.capitalRiskTolerance);
      setUseCapitalGuard(true);
    }
  };

  const applyOpenPosition = (p: NovaRadarBlofinOpenPosition) => {
    setSelectedPositionId(p.id);
    setOpenPositionGuard(null);
    setPlan1({
      symbol: p.symbol,
      limitPrice: p.entryPrice != null ? String(p.entryPrice) : "",
      side: p.side,
      takeProfit: p.exchangeTakeProfitPrice != null ? String(p.exchangeTakeProfitPrice) : "",
      stopLoss: p.exchangeStopLossPrice != null ? String(p.exchangeStopLossPrice) : "",
    });
    if (p.leverage != null && p.leverage >= 1) setLeverage(String(Math.round(p.leverage)));
    if (p.marginUsdt != null && p.marginUsdt > 0) {
      setInvestmentAmount(String(Math.round(p.marginUsdt * 100) / 100));
    }
    setUseCapitalGuard(true);
    setUseLeverage(true);
    if (!capitalRiskTolerance) setCapitalRiskTolerance("extreme_high");
  };

  const runOpenPositionGuard = async () => {
    if (!selectedPositionId) {
      setError("Select an open Blofin position.");
      return;
    }
    if (!capitalRiskTolerance) {
      setError("Select a Capital Guard risk level.");
      return;
    }
    setOpenGuardLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/nova-radar/open-position-guard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          positionId: selectedPositionId,
          capitalRiskTolerance,
          investmentAmountUsdt: investmentAmount.trim() || undefined,
          leverage: leverage.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.capitalGuard) {
        setOpenPositionGuard(data.capitalGuard as NovaRadarCapitalGuard);
        if (data.position?.entryPrice != null) {
          setPlan1((prev) => ({
            ...prev,
            symbol: data.position.symbol,
            limitPrice: String(data.position.entryPrice),
            side: data.position.side,
          }));
        }
      } else {
        setOpenPositionGuard(null);
        setError(data?.error ?? `Error ${res.status}`);
      }
    } catch (e) {
      setOpenPositionGuard(null);
      setError(e instanceof Error ? e.message : "Capital Guard failed");
    } finally {
      setOpenGuardLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
      <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-2">NovaRadar · NovaForecast Agent</h2>
      <p className="text-xs text-muted-foreground mb-2">
        VIP · NovaForecast Agent sub-tab. Set <strong className="font-medium text-zinc-700 dark:text-zinc-300">trade plan 1</strong> (required) and optionally{" "}
        <strong className="font-medium text-zinc-700 dark:text-zinc-300">trade plan 2</strong> to compare two limits on the same or different
        contracts. NovaRadar scores structure alignment, realism, and illustrative timing—optionally with leverage, TP, and SL for ROE and risk/reward—then recommends the stronger plan with reasons.
      </p>
      <PlatformHealthStrip className="mb-2" />
      <TradingRiskDisclaimer compact context="radar" />
      <div className="mb-4" />

      <div className="rounded-lg border border-amber-200/70 dark:border-amber-800/50 bg-amber-50/30 dark:bg-amber-950/20 p-4 mb-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div>
            <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">Open Blofin position · Capital Guard</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Link a live trade from your Blofin account (same keys as Trading Bot — connect once, syncs each visit).
              Detects missing stop loss and recommends SL + max loss in $ and %.
            </p>
          </div>
          {blofinKeysConfigured === true && (
            <Button type="button" variant="outline" size="sm" disabled={positionsLoading} onClick={loadBlofinPositions}>
              {positionsLoading ? "Refreshing…" : "Refresh positions"}
            </Button>
          )}
        </div>
        {blofinKeysConfigured === false && (
          <p className="text-xs text-amber-900 dark:text-amber-100">
            Save your Blofin API keys once under{" "}
            <strong className="font-medium">NovaStaris AI Trading Bots → Blofin keys</strong> — then return here; no second Blofin login.
          </p>
        )}
        {blofinKeysConfigured === null && (
          <p className="text-xs text-muted-foreground">Checking Blofin connection…</p>
        )}
        {blofinKeysConfigured === true && (
          <div className="flex flex-wrap items-end gap-3 mt-2">
            <div className="min-w-[220px] flex-1">
              <label className="text-xs text-muted-foreground block mb-1">Your open position</label>
              <select
                value={selectedPositionId}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedPositionId(id);
                  const p = blofinPositions.find((x) => x.id === id);
                  if (p) applyOpenPosition(p);
                }}
                className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 w-full bg-white dark:bg-zinc-800"
              >
                <option value="">
                  {positionsLoading
                    ? "Loading…"
                    : blofinPositions.length === 0
                      ? "No open positions on Blofin"
                      : "Select position…"}
                </option>
                {blofinPositions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
        {positionsError && <p className="text-xs text-rose-600 dark:text-rose-400 mt-2">{positionsError}</p>}
        {blofinPositions.some((p) => p.missingStopAlert) && (
          <p className="text-xs text-rose-700 dark:text-rose-300 mt-2 font-medium">
            {blofinPositions.filter((p) => p.missingStopAlert).length} position(s) have no stop on Blofin — select one and run Capital Guard.
          </p>
        )}
        {openPositionGuard && (
          <div className="mt-3">
            <CapitalGuardCard
              guard={openPositionGuard}
              onApplySl={() => setStopLoss(String(openPositionGuard.finalStopLossPrice))}
            />
          </div>
        )}
      </div>

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
            {(liqPreviewLoading || liqPreview) && (
              <p className="text-[11px] text-amber-800 dark:text-amber-200 w-full">
                {liqPreviewLoading
                  ? "Est. liquidation (plan 1 entry)…"
                  : `Est. liquidation @ plan 1 entry: ~$${liqPreview!.liquidationPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}${liqPreview!.note ? ` · ${liqPreview!.note}` : ""}`}
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Enable to see ROE at TP/SL, risk/reward, and approximate liquidation per plan.</p>
        )}
      </div>

      <div className="rounded-lg border border-emerald-200/70 dark:border-emerald-800/50 bg-emerald-50/30 dark:bg-emerald-950/20 p-4 mb-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div>
            <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">Nova Capital Guard (optional)</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Defined-risk mode — caps loss at your chosen level and recommends a stop loss + flip-ready plan if stopped out.
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
                className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 min-w-[160px] bg-white dark:bg-zinc-800"
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
              <label className="text-xs text-muted-foreground block mb-1">Investment / margin (USDT)</label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="e.g. 500"
                value={investmentAmount}
                onChange={(e) => setInvestmentAmount(e.target.value)}
                className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 w-28 bg-white dark:bg-zinc-800"
              />
            </div>
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
            <p className="text-[11px] text-muted-foreground max-w-xl">
              Nova recommends SL price, $ loss, and % of margin at risk.{" "}
              <strong className="font-medium text-emerald-800 dark:text-emerald-200">Extreme high</strong> still uses a stop — it caps loss (~20% of margin), unlike trading with no SL.
              After a stop, see <strong className="font-medium">Flip-Ready play</strong> for the opposite direction.
            </p>
            {plans?.[0]?.capitalGuard && !stopLoss.trim() && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs border-emerald-400 text-emerald-800 dark:text-emerald-200"
                onClick={() =>
                  setStopLoss(String(plans[0].capitalGuard!.finalStopLossPrice))
                }
              >
                Apply recommended SL (${plans[0].capitalGuard.finalStopLossPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })})
              </Button>
            )}
            {selectedPositionId && (
              <Button
                type="button"
                size="sm"
                disabled={openGuardLoading || !capitalRiskTolerance}
                onClick={runOpenPositionGuard}
                className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-8"
              >
                {openGuardLoading ? "Analyzing open position…" : "Run Capital Guard on Blofin position"}
              </Button>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Set risk level + investment to get a stop loss recommendation and max loss in $ and % — protects capital during dips.
          </p>
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
