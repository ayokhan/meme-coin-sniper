"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type BlofinPosition = {
  id: string;
  instId: string;
  symbol: string;
  side: "long" | "short";
  entryPrice: number | null;
  markPrice: number | null;
  leverage: number | null;
  liquidationPrice: number | null;
  marginMode: string | null;
  unrealizedPnl: number | null;
  label: string;
};

type Cluster = {
  label: string;
  side: "long_liq_below" | "short_liq_above";
  price: number;
  distancePct: number;
  intensity: "low" | "medium" | "high";
  estimatedLiquidityUsd: number;
  reason: string;
};

type Result = {
  symbol: string;
  markPrice: number;
  dayChangePct: number;
  fundingRatePct: number;
  openInterest: number;
  volume24h: number;
  volatilityPct: number;
  trend?: "up" | "down" | "sideways";
  marketStructure?: string;
  trendlineRead?: string;
  aliasUsed?: string | null;
  bias: "long" | "short" | "neutral";
  confidence: "low" | "medium" | "high";
  summary: string;
  liquidityRead: string;
  clusters: Cluster[];
  recommendations: {
    buyArea: string;
    noBuyArea: string;
    stopArea: string;
    noStopArea: string;
    riskNote: string;
  };
  levels?: {
    buyMin: number | null;
    buyMax: number | null;
    noBuyMin: number | null;
    noBuyMax: number | null;
    stopLevel: number | null;
    noStopMin: number | null;
    noStopMax: number | null;
    invalidation: number | null;
  };
  tradeCheck?: {
    score: number;
    verdict: "good_trade" | "risky_trade" | "avoid_trade";
    directionFit: string;
    trendlineFit: string;
    structureFit: string;
    liquidationRisk: string;
    notes: string[];
    analyzed?: {
      traderType: "long" | "short";
      entry: number;
      exit: number;
      leverage: number;
      estLiquidationPrice: number | null;
      estLiquidationDistancePct: number | null;
      rrMultiple: number | null;
    };
    scoreBreakdown: Array<{ id: string; label: string; earned: number; max: number; detail: string; suggestedFix: string | null }>;
    suggestedPlan?: {
      suggestedStop: {
        price: number;
        distancePctFromEntry: number;
        basis: "nearest_liq_pocket" | "structural_proxy";
        reason: string;
      };
      suggestedEntry: {
        price: number;
        distancePctFromCurrent: number;
        reason: string;
      } | null;
      keepYourEntry: boolean;
      planRrMultiple: number | null;
      summary: string;
    };
  };
  disclaimer: string;
};

function fmtPrice(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function barClass(side: Cluster["side"]): string {
  return side === "short_liq_above"
    ? "bg-emerald-500/75 dark:bg-emerald-400/70"
    : "bg-rose-500/75 dark:bg-rose-400/70";
}

/** Copies API `levels`; bands are keyed off liquidity bias — not always literal "buy to go long". */
function tradeAreaLabels(bias: Result["bias"]) {
  if (bias === "long") {
    return {
      explainer:
        "These boxes follow the liquidity bias badge (Long above). Emerald = where the model favors building or scaling longs near long liquidation; amber = belts where fresh long risk is crowded (typically under short-liq squeeze pressure). Stop/trap captions assume a long thesis.",
      preferBand: "Long accumulation band",
      avoidBand: "Avoid new longs (squeeze belts)",
      stopBand: "Long invalidation anchor",
      trapBand: "Stop trap zone (longs)",
      prosePrefer: "Long playbook:",
      proseAvoid: "When not to add long:",
    };
  }
  if (bias === "short") {
    return {
      explainer:
        "These boxes follow the liquidity bias badge (Short above). Emerald = pullback / sell-into-short-liq zone for short setups; amber = underside long-liq area where blindly adding shorts tends to chop. Stop/trap captions assume a short thesis.",
      preferBand: "Short entry band",
      avoidBand: "Avoid chasing shorts lower",
      stopBand: "Short invalidation anchor",
      trapBand: "Stop trap zone (shorts)",
      prosePrefer: "Short playbook:",
      proseAvoid: "When shorts are fragile:",
    };
  }
  return {
    explainer:
      "Liquidity bias is Neutral — emerald/amber spans are reference rails between liquidation magnets (not a clean long or short “go” zone). Pair the numbers with sweep + reclaim confirmation before committing size.",
    preferBand: "Between magnets (neutral)",
    avoidBand: "Mid-range chop band",
    stopBand: "Stop anchor (often unset)",
    trapBand: "Local trap / chop pinch",
    prosePrefer: "Neutral context:",
    proseAvoid: "Fade aggressive direction:",
  };
}

function bufferToLiquidationPct(side: "long" | "short", mark: number, liq: number): number | null {
  if (!Number.isFinite(mark) || mark <= 0 || !Number.isFinite(liq)) return null;
  if (side === "long") return ((mark - liq) / mark) * 100;
  return ((liq - mark) / mark) * 100;
}

export default function FuturesLiquidationMapPanel({
  initialSymbol,
}: {
  initialSymbol?: string;
} = {}) {
  const [symbol, setSymbol] = useState(() => {
    const s = (initialSymbol ?? "").trim().toUpperCase();
    return s || "BTC";
  });
  useEffect(() => {
    const s = (initialSymbol ?? "").trim().toUpperCase();
    if (s) setSymbol(s);
  }, [initialSymbol]);
  const [traderType, setTraderType] = useState<"long" | "short">("long");
  const [entry, setEntry] = useState("");
  const [exit, setExit] = useState("");
  const [leverage, setLeverage] = useState("10");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [blofinConfigured, setBlofinConfigured] = useState<boolean | null>(null);
  const [positions, setPositions] = useState<BlofinPosition[]>([]);
  const [positionsLoading, setPositionsLoading] = useState(false);
  const [positionsError, setPositionsError] = useState<string | null>(null);
  const [selectedPositionId, setSelectedPositionId] = useState("");
  const [linkedPosition, setLinkedPosition] = useState<BlofinPosition | null>(null);

  const selectedPosition = useMemo(
    () => positions.find((p) => p.id === selectedPositionId) ?? linkedPosition,
    [positions, selectedPositionId, linkedPosition]
  );

  const loadPositions = useCallback(async () => {
    setPositionsLoading(true);
    setPositionsError(null);
    try {
      const res = await fetch("/api/futures/liquidation-map/positions", { credentials: "include" });
      const data = await res.json();
      if (!data.success) {
        setBlofinConfigured(data.configured === true);
        if (data.configured === false) {
          setPositions([]);
          setBlofinConfigured(false);
        } else {
          setPositionsError(data.error ?? "Failed to load Blofin positions.");
        }
        return;
      }
      setBlofinConfigured(true);
      setPositions(Array.isArray(data.positions) ? data.positions : []);
    } catch {
      setPositionsError("Failed to load Blofin positions.");
    } finally {
      setPositionsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPositions();
  }, [loadPositions]);

  const applyPosition = useCallback((p: BlofinPosition) => {
    setLinkedPosition(p);
    setSelectedPositionId(p.id);
    setSymbol(p.symbol);
    setTraderType(p.side);
    if (p.entryPrice != null) setEntry(String(p.entryPrice));
    if (p.leverage != null && p.leverage > 0) setLeverage(String(Math.round(p.leverage)));
  }, []);

  const inputsStale = useMemo(() => {
    const a = result?.tradeCheck?.analyzed;
    if (!a) return false;
    const entryN = entry.trim() ? Number(entry) : NaN;
    const exitN = exit.trim() ? Number(exit) : NaN;
    const levN = leverage.trim() ? Number(leverage) : NaN;
    if (!Number.isFinite(entryN) || !Number.isFinite(exitN) || !Number.isFinite(levN)) return true;
    const close = (x: number, y: number) => Math.abs(x - y) <= Math.max(1e-8, Math.abs(y) * 1e-6);
    return (
      traderType !== a.traderType ||
      !close(entryN, a.entry) ||
      !close(exitN, a.exit) ||
      !close(levN, a.leverage)
    );
  }, [result, entry, exit, leverage, traderType]);

  const run = async (positionOverride?: BlofinPosition | null) => {
    const s = symbol.trim();
    if (!s) {
      setError("Enter a contract symbol.");
      return;
    }
    const activePosition = positionOverride ?? linkedPosition;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const entryVal = entry.trim() ? Number(entry) : activePosition?.entryPrice ?? undefined;
      const levVal = leverage.trim() ? Number(leverage) : activePosition?.leverage ?? undefined;
      const res = await fetch("/api/futures/liquidation-map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: s,
          traderType,
          entry: entryVal,
          exit: exit.trim() ? Number(exit) : undefined,
          leverage: levVal,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error ?? "Failed to load liquidation map.");
        return;
      }
      setResult(data as Result);
    } catch {
      setError("Failed to load liquidation map.");
    } finally {
      setLoading(false);
    }
  };

  const personalLiqRead = useMemo(() => {
    const p = selectedPosition;
    if (!p || p.liquidationPrice == null) return null;
    const liq = p.liquidationPrice;
    const mark = p.markPrice ?? result?.markPrice ?? null;
    if (mark == null) {
      return {
        liq,
        bufferPct: null,
        risk: "unknown" as const,
        note: "Liquidation price from Blofin. Run the map to compare vs current mark.",
        adverseClusters: [] as Cluster[],
      };
    }
    const bufferPct = bufferToLiquidationPct(p.side, mark, liq);
    if (bufferPct == null) return null;
    const risk = bufferPct <= 3 ? "critical" : bufferPct <= 8 ? "high" : bufferPct <= 15 ? "medium" : "low";
    const adverseClusters =
      result?.clusters.filter((c) => {
        if (p.side === "long" && c.side === "long_liq_below") {
          return c.price >= liq && c.price <= mark;
        }
        if (p.side === "short" && c.side === "short_liq_above") {
          return c.price <= liq && c.price >= mark;
        }
        return false;
      }) ?? [];
    return {
      liq,
      mark,
      bufferPct,
      risk,
      adverseClusters,
      note:
        bufferPct <= 3
          ? "Very close to liquidation — consider de-risking or adding margin."
          : bufferPct <= 8
            ? "Tight buffer — watch for sweeps into nearby liquidation clusters."
            : "Healthy buffer to liquidation for now — still monitor cluster magnets.",
    };
  }, [selectedPosition, result]);

  return (
    <div className="space-y-4 max-w-5xl">
      <Card className="border-zinc-200 dark:border-zinc-700">
        <CardHeader>
          <CardTitle className="text-lg">Liquidation Map</CardTitle>
          <p className="text-sm text-muted-foreground">
            Enter a contract manually, or import an open Blofin position to see liquidation clusters vs your liq price.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {blofinConfigured === false && (
            <p className="text-xs rounded-md border border-amber-300/50 dark:border-amber-700/50 bg-amber-50/80 dark:bg-amber-950/30 text-slate-900 dark:text-slate-100 px-3 py-2">
              Connect Blofin in <strong>NovaStaris AI Trading Bots</strong> → save API keys to import live positions here.
            </p>
          )}
          {blofinConfigured && (
            <div className="flex flex-wrap gap-2 items-end">
              <div className="min-w-[260px] flex-1">
                <label htmlFor="liq-blofin-pos" className="block text-xs text-muted-foreground mb-1">
                  Your Blofin position
                </label>
                <select
                  id="liq-blofin-pos"
                  value={selectedPositionId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedPositionId(id);
                    const p = positions.find((x) => x.id === id);
                    if (p) {
                      applyPosition(p);
                    } else {
                      setLinkedPosition(null);
                    }
                  }}
                  className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2.5 py-2 text-sm"
                >
                  <option value="">
                    {positionsLoading ? "Loading positions…" : positions.length ? "Select a position…" : "No open positions"}
                  </option>
                  {positions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => loadPositions()} disabled={positionsLoading}>
                {positionsLoading ? "Refreshing…" : "Refresh"}
              </Button>
              {selectedPosition && (
                <Button
                  type="button"
                  size="sm"
                  className="bg-cyan-500 hover:bg-cyan-600 text-white dark:bg-cyan-600"
                  disabled={loading}
                  onClick={() => run(selectedPosition)}
                >
                  Analyze my position
                </Button>
              )}
            </div>
          )}
          {positionsError && <p className="text-xs text-rose-600 dark:text-rose-400">{positionsError}</p>}
          {personalLiqRead && (
            <div
              className={`rounded-md border px-3 py-2 text-xs space-y-1 ${
                personalLiqRead.risk === "critical"
                  ? "border-rose-400/60 bg-rose-50/90 dark:bg-rose-950/40"
                  : personalLiqRead.risk === "high"
                    ? "border-amber-400/60 bg-amber-50/90 dark:bg-amber-950/40"
                    : "border-cyan-400/40 bg-cyan-50/80 dark:bg-cyan-950/30"
              }`}
            >
              <p className="font-semibold text-zinc-900 dark:text-zinc-100">Your position liquidation</p>
              <p>
                Liq price: <strong>{fmtPrice(personalLiqRead.liq)}</strong>
                {personalLiqRead.mark != null && (
                  <>
                    {" "}
                    · Mark: <strong>{fmtPrice(personalLiqRead.mark)}</strong>
                  </>
                )}
                {personalLiqRead.bufferPct != null && (
                  <>
                    {" "}
                    · Buffer: <strong>{personalLiqRead.bufferPct.toFixed(2)}%</strong>
                  </>
                )}
              </p>
              <p className="text-muted-foreground">{personalLiqRead.note}</p>
              {personalLiqRead.adverseClusters && personalLiqRead.adverseClusters.length > 0 && (
                <p className="text-muted-foreground">
                  {personalLiqRead.adverseClusters.length} market cluster(s) sit between mark and your liquidation zone.
                </p>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-2 items-end">
            <div className="min-w-[220px] flex-1">
              <label htmlFor="liq-symbol" className="block text-xs text-muted-foreground mb-1">
                Contract
              </label>
              <input
                id="liq-symbol"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="BTC"
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
              />
            </div>
            <Button onClick={() => run()} disabled={loading} className="bg-cyan-500 hover:bg-cyan-600 text-white dark:bg-cyan-600 dark:hover:bg-cyan-700">
              {loading ? "Analyzing…" : "Search liquidation map"}
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Trader type</label>
              <select
                value={traderType}
                onChange={(e) => setTraderType(e.target.value as "long" | "short")}
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2.5 py-2 text-sm"
              >
                <option value="long">Long</option>
                <option value="short">Short</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Entry price</label>
              <input
                value={entry}
                onChange={(e) => setEntry(e.target.value)}
                placeholder="e.g. 78500"
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2.5 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Exit / take-profit</label>
              <input
                value={exit}
                onChange={(e) => setExit(e.target.value)}
                placeholder="e.g. 80100"
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2.5 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Leverage (x)</label>
              <input
                value={leverage}
                onChange={(e) => setLeverage(e.target.value)}
                placeholder="10"
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2.5 py-2 text-sm"
              />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Bias &amp; clusters are market-wide (same until the coin moves).{" "}
            <strong className="font-medium text-zinc-700 dark:text-zinc-300">Your trade check</strong> uses entry,
            exit, and leverage — click <strong className="font-medium">Search liquidation map</strong> after you change
            them.
          </p>
          {inputsStale && (
            <p className="rounded-md border border-amber-400/50 bg-amber-50/80 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
              Inputs changed since the last run — click <strong>Search liquidation map</strong> to refresh Your trade
              check (score, stop, est. liquidation).
            </p>
          )}
          {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
        </CardContent>
      </Card>

      {result && (
        <>
          <Card className="border-zinc-200 dark:border-zinc-700">
            <CardContent className="pt-5 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{result.symbol}</h3>
                <Badge variant="outline">
                  Bias: {result.bias === "long" ? "Long" : result.bias === "short" ? "Short" : "Neutral"}
                </Badge>
                <Badge variant="secondary">Confidence: {result.confidence}</Badge>
              </div>
              {result.aliasUsed && (
                <p className="text-xs text-muted-foreground">
                  Mapped requested symbol <strong>{result.aliasUsed}</strong> to available contract <strong>{result.symbol}</strong>.
                </p>
              )}
              <p className="text-sm">{result.summary}</p>
              <p className="text-xs text-muted-foreground">{result.liquidityRead}</p>
              {result.trendlineRead && (
                <p className="text-xs text-muted-foreground">
                  Trend/structure: {result.trendlineRead}
                </p>
              )}
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-xs">
                <div className="rounded border border-zinc-200 dark:border-zinc-700 p-2">Price: <strong>{result.markPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })}</strong></div>
                <div className="rounded border border-zinc-200 dark:border-zinc-700 p-2">24h: <strong>{result.dayChangePct >= 0 ? "+" : ""}{result.dayChangePct.toFixed(2)}%</strong></div>
                <div className="rounded border border-zinc-200 dark:border-zinc-700 p-2">Funding: <strong>{result.fundingRatePct >= 0 ? "+" : ""}{result.fundingRatePct.toFixed(4)}%</strong></div>
                <div className="rounded border border-zinc-200 dark:border-zinc-700 p-2">Volatility: <strong>{result.volatilityPct.toFixed(2)}%</strong></div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-zinc-200 dark:border-zinc-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Liquidity clusters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {result.clusters.map((c, i) => (
                <div key={`${c.label}-${i}`} className="rounded-md border border-zinc-200 dark:border-zinc-700 p-3 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">{c.label}</span>
                    <span className="text-muted-foreground">
                      {c.side === "short_liq_above" ? "Above price" : "Below price"} · {c.distancePct.toFixed(2)}%
                    </span>
                  </div>
                  <div className="h-2 rounded bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                    <div
                      className={`h-full ${barClass(c.side)}`}
                      style={{ width: `${Math.min(100, Math.max(18, c.intensity === "high" ? 88 : c.intensity === "medium" ? 62 : 38))}%` }}
                    />
                  </div>
                  <div className="text-xs text-zinc-700 dark:text-zinc-300">
                    Price level: <strong>{c.price.toLocaleString(undefined, { maximumFractionDigits: 4 })}</strong> · Est. liquidity:{" "}
                    <strong>${c.estimatedLiquidityUsd.toLocaleString()}</strong>
                  </div>
                  <p className="text-xs text-muted-foreground">{c.reason}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-zinc-200 dark:border-zinc-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Trade area guidance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {(() => {
                const t = tradeAreaLabels(result.bias);
                return (
              <>
              <p className="text-xs text-muted-foreground leading-snug -mt-1 mb-2">{t.explainer}</p>
              {result.levels && (
                <div className="grid gap-2 sm:grid-cols-2 text-xs mb-2">
                  <div className="rounded border border-emerald-300/40 dark:border-emerald-700/40 p-2">
                    <p className="font-semibold text-emerald-600 dark:text-emerald-400">{t.preferBand}</p>
                    <p>{fmtPrice(result.levels.buyMin)} - {fmtPrice(result.levels.buyMax)}</p>
                  </div>
                  <div className="rounded border border-amber-300/40 dark:border-amber-700/40 p-2">
                    <p className="font-semibold text-amber-600 dark:text-amber-400">{t.avoidBand}</p>
                    <p>{fmtPrice(result.levels.noBuyMin)} - {fmtPrice(result.levels.noBuyMax)}</p>
                  </div>
                  <div className="rounded border border-cyan-300/40 dark:border-cyan-700/40 p-2">
                    <p className="font-semibold text-cyan-600 dark:text-cyan-400">{t.stopBand}</p>
                    <p>{fmtPrice(result.levels.stopLevel)}</p>
                  </div>
                  <div className="rounded border border-rose-300/40 dark:border-rose-700/40 p-2">
                    <p className="font-semibold text-rose-600 dark:text-rose-400">{t.trapBand}</p>
                    <p>{fmtPrice(result.levels.noStopMin)} - {fmtPrice(result.levels.noStopMax)}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">Invalidation: {fmtPrice(result.levels.invalidation)}</p>
                  </div>
                </div>
              )}
              <p><span className="font-semibold text-emerald-600 dark:text-emerald-400">{t.prosePrefer}</span> {result.recommendations.buyArea}</p>
              <p><span className="font-semibold text-amber-600 dark:text-amber-400">{t.proseAvoid}</span> {result.recommendations.noBuyArea}</p>
              <p><span className="font-semibold text-cyan-600 dark:text-cyan-400">Stop discipline:</span> {result.recommendations.stopArea}</p>
              <p><span className="font-semibold text-rose-600 dark:text-rose-400">Where not to leave stops:</span> {result.recommendations.noStopArea}</p>
              </>
              );
              })()}
              <p className="text-xs text-muted-foreground mt-3">{result.recommendations.riskNote}</p>
              <p className="text-[11px] text-muted-foreground">{result.disclaimer}</p>
            </CardContent>
          </Card>

          {result.tradeCheck && (
            <Card className="border-zinc-200 dark:border-zinc-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Your trade check</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {result.tradeCheck.analyzed && (
                  <p className="text-[11px] text-muted-foreground rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-900/40 px-2.5 py-1.5">
                    Scored on {result.tradeCheck.analyzed.traderType} · entry{" "}
                    {fmtPrice(result.tradeCheck.analyzed.entry)} · exit {fmtPrice(result.tradeCheck.analyzed.exit)} ·{" "}
                    {result.tradeCheck.analyzed.leverage}×
                    {result.tradeCheck.analyzed.estLiquidationPrice != null && (
                      <>
                        {" "}
                        · est. liq {fmtPrice(result.tradeCheck.analyzed.estLiquidationPrice)}
                        {result.tradeCheck.analyzed.estLiquidationDistancePct != null
                          ? ` (${result.tradeCheck.analyzed.estLiquidationDistancePct.toFixed(2)}% from entry)`
                          : ""}
                      </>
                    )}
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Score: {result.tradeCheck.score}/100</Badge>
                  <Badge
                    className={
                      result.tradeCheck.verdict === "good_trade"
                        ? "bg-emerald-600 text-white"
                        : result.tradeCheck.verdict === "risky_trade"
                        ? "bg-amber-600 text-white"
                        : "bg-rose-600 text-white"
                    }
                  >
                    {result.tradeCheck.verdict === "good_trade"
                      ? "Good trade"
                      : result.tradeCheck.verdict === "risky_trade"
                      ? "Risky trade"
                      : "Avoid trade"}
                  </Badge>
                </div>
                <p>{result.tradeCheck.directionFit}</p>
                <p>{result.tradeCheck.trendlineFit}</p>
                <p>{result.tradeCheck.structureFit}</p>
                <p>{result.tradeCheck.liquidationRisk}</p>
                {result.tradeCheck.suggestedPlan && (
                  <div className="rounded-lg border border-cyan-500/35 bg-cyan-50/70 dark:bg-cyan-950/30 p-3 space-y-2 mt-2">
                    <p className="text-xs font-semibold text-cyan-950 dark:text-cyan-100">Suggested plan</p>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      {result.tradeCheck.suggestedPlan.summary}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div className="rounded-md border border-cyan-200/70 dark:border-cyan-800/50 bg-white/60 dark:bg-zinc-950/40 p-2">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Hard stop</p>
                        <p className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                          {fmtPrice(result.tradeCheck.suggestedPlan.suggestedStop.price)}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                          {result.tradeCheck.suggestedPlan.suggestedStop.distancePctFromEntry.toFixed(2)}% from your
                          entry · {result.tradeCheck.suggestedPlan.suggestedStop.basis === "nearest_liq_pocket"
                            ? "beyond nearest trap"
                            : "structural proxy"}
                        </p>
                        <p className="text-[11px] text-zinc-700 dark:text-zinc-300 mt-1 leading-snug">
                          {result.tradeCheck.suggestedPlan.suggestedStop.reason}
                        </p>
                      </div>
                      <div className="rounded-md border border-cyan-200/70 dark:border-cyan-800/50 bg-white/60 dark:bg-zinc-950/40 p-2">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Entry</p>
                        {result.tradeCheck.suggestedPlan.suggestedEntry ? (
                          <>
                            <p className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                              {fmtPrice(result.tradeCheck.suggestedPlan.suggestedEntry.price)}
                              <span className="ml-1 text-[10px] font-sans font-normal text-amber-700 dark:text-amber-300">
                                better than yours
                              </span>
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                              {result.tradeCheck.suggestedPlan.suggestedEntry.distancePctFromCurrent.toFixed(2)}% vs
                              your entry
                            </p>
                            <p className="text-[11px] text-zinc-700 dark:text-zinc-300 mt-1 leading-snug">
                              {result.tradeCheck.suggestedPlan.suggestedEntry.reason}
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                              Keep {fmtPrice(Number(entry) || result.markPrice)}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                              Your entry has acceptable clearance vs the nearest adverse pocket.
                            </p>
                          </>
                        )}
                        {result.tradeCheck.suggestedPlan.planRrMultiple != null && (
                          <p className="text-[11px] font-mono text-cyan-800 dark:text-cyan-200 mt-1.5">
                            Plan R:R ≈ {result.tradeCheck.suggestedPlan.planRrMultiple.toFixed(2)}× vs your exit
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {result.tradeCheck.suggestedPlan.suggestedEntry && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs border-cyan-500/50 text-cyan-800 dark:text-cyan-200"
                          onClick={() =>
                            setEntry(String(result.tradeCheck!.suggestedPlan!.suggestedEntry!.price))
                          }
                        >
                          Use suggested entry
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        title="Copy suggested stop price"
                        onClick={() => {
                          const px = String(result.tradeCheck!.suggestedPlan!.suggestedStop.price);
                          void navigator.clipboard?.writeText(px);
                        }}
                      >
                        Copy stop {fmtPrice(result.tradeCheck.suggestedPlan.suggestedStop.price)}
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Map-derived suggestion only — not a broker order. Re-run Search after applying a new entry.
                    </p>
                  </div>
                )}
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-950/40 p-3 space-y-2 mt-3">
                  <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Why this score?</p>
                  <p className="text-[11px] text-muted-foreground">
                    Weighted pillars (earned / max). Total matches the badge above.
                  </p>
                  <ul className="space-y-2">
                    {result.tradeCheck.scoreBreakdown.map((row) => {
                      const pct = row.max > 0 ? Math.min(100, Math.round((row.earned / row.max) * 100)) : 0;
                      return (
                        <li key={row.id} className="text-xs">
                          <div className="flex justify-between gap-2">
                            <span className="font-medium text-zinc-800 dark:text-zinc-200">{row.label}</span>
                            <span className="tabular-nums text-muted-foreground shrink-0">
                              {row.earned}/{row.max}
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden mt-1">
                            <div
                              className="h-full rounded-full bg-violet-500/90 dark:bg-violet-400/80"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{row.detail}</p>
                          {row.suggestedFix ? (
                            <p className="text-[11px] text-cyan-800 dark:text-cyan-200/95 mt-1.5 leading-snug rounded border border-cyan-200/70 dark:border-cyan-800/60 bg-cyan-50/90 dark:bg-cyan-950/35 px-2 py-1.5">
                              <span className="font-medium text-cyan-900 dark:text-cyan-100">Suggested fix:</span>{" "}
                              {row.suggestedFix}
                            </p>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <ul className="list-disc list-inside text-xs text-muted-foreground">
                  {result.tradeCheck.notes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
