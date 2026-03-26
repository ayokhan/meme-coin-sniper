"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type RiskProfitPreset = "low_low" | "low_medium" | "medium_medium" | "high_high";
type DurationMode =
  | "long_term"
  | "short_term"
  | "scalp"
  | "swing"
  | "hybrid_scalp_swing"
  | "hybrid_short_long";

type StrategyLegCoin = {
  symbol: string;
  allocationPct: number;
  direction: "long" | "short";
  entryZoneLow: number;
  entryZoneHigh: number;
  stopLossPrice: number;
  takeProfitPrice: number;
};

type StrategyLeg = {
  legType: "scalp" | "swing" | "long" | "short";
  durationLabel: string;
  timeframeId: string;
  direction: "long" | "short";
  leverage: number;
  stopLossPct: number;
  takeProfitPct: number;
  expectedReturnPctOnMargin: number;
  expectedReturnUsdOnLeg: number;
  entryPlan: string;
  exitPlan: string;
  coins: StrategyLegCoin[];
  notes?: string[];
};

type NovaInvestmentAgentResult = {
  baseSymbol: string;
  amountUsd: number;
  riskProfitPreset: RiskProfitPreset;
  durationMode: DurationMode;
  totalExpectedReturnPct: number;
  totalExpectedReturnUsd: number;
  legs: StrategyLeg[];
  overallNote?: string;
};

type InvestmentPin = {
  id: string;
  pinnedAt: string;
  result: NovaInvestmentAgentResult;
  ownerFeedback: {
    worked: boolean;
    note: string | null;
    at: string | null;
  } | null;
};

function formatUsd(n: number) {
  if (!Number.isFinite(n)) return "—";
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function formatPct(n: number) {
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(1)}%`;
}


export default function NovaInvestmentAgentPanel({ isOwner }: { isOwner: boolean }) {
  const [amountUsd, setAmountUsd] = useState<number>(250);
  const [baseSymbol, setBaseSymbol] = useState<string>("BTC");

  const [riskProfitPreset, setRiskProfitPreset] = useState<RiskProfitPreset>("low_medium");
  const [durationMode, setDurationMode] = useState<DurationMode>("short_term");

  const [longTermId, setLongTermId] = useState<"1w" | "2w" | "1m" | "2m">("2w");
  const [shortTermId, setShortTermId] = useState<"1d" | "2d">("1d");
  const [scalpId, setScalpId] = useState<"5m" | "15m" | "30m" | "1h" | "2h">("15m");
  const [swingId, setSwingId] = useState<"1h" | "2h" | "4h" | "8h" | "24h" | "48h" | "72h">("4h");

  const [scalpSplitPct, setScalpSplitPct] = useState<number>(50);
  const [hybridScalpId, setHybridScalpId] = useState<"5m" | "15m" | "30m" | "1h" | "2h">("15m");
  const [hybridSwingId, setHybridSwingId] = useState<"1h" | "2h" | "4h" | "8h" | "24h" | "48h" | "72h">("24h");

  const [shortSplitPct, setShortSplitPct] = useState<number>(50);
  const [hybridShortId, setHybridShortId] = useState<"1d" | "2d">("1d");
  const [hybridLongId, setHybridLongId] = useState<"1w" | "2w" | "1m" | "2m">("2w");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<NovaInvestmentAgentResult | null>(null);

  const [pins, setPins] = useState<InvestmentPin[]>([]);
  const [pinsLoading, setPinsLoading] = useState(false);
  const [portfolioActionLoading, setPortfolioActionLoading] = useState(false);
  const [portfolioError, setPortfolioError] = useState<string | null>(null);

  const loadPins = async () => {
    setPinsLoading(true);
    setPortfolioError(null);
    try {
      const res = await fetch("/api/nova-investment-agent/portfolio", { credentials: "include", cache: "no-store" });
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.pins)) {
        setPins(data.pins as InvestmentPin[]);
      } else {
        setPins([]);
        setPortfolioError(data?.error ?? `Error ${res.status}`);
      }
    } catch (e) {
      setPins([]);
      setPortfolioError(e instanceof Error ? e.message : "Failed to load portfolio");
    } finally {
      setPinsLoading(false);
    }
  };

  useEffect(() => {
    void loadPins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const payload = useMemo(() => {
    const base: Record<string, unknown> = {
      amountUsd,
      baseSymbol,
      riskProfitPreset,
      durationMode,
    };
    if (durationMode === "long_term") base.longTermId = longTermId;
    if (durationMode === "short_term") base.shortTermId = shortTermId;
    if (durationMode === "scalp") base.scalpId = scalpId;
    if (durationMode === "swing") base.swingId = swingId;
    if (durationMode === "hybrid_scalp_swing") {
      base.scalpId = hybridScalpId;
      base.swingId = hybridSwingId;
      base.scalpSplitPct = scalpSplitPct;
    }
    if (durationMode === "hybrid_short_long") {
      base.shortId = hybridShortId;
      base.longId = hybridLongId;
      base.shortSplitPct = shortSplitPct;
    }
    return base;
  }, [
    amountUsd,
    baseSymbol,
    riskProfitPreset,
    durationMode,
    longTermId,
    shortTermId,
    scalpId,
    swingId,
    scalpSplitPct,
    hybridScalpId,
    hybridSwingId,
    shortSplitPct,
    hybridShortId,
    hybridLongId,
  ]);

  const generate = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/nova-investment-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.success && data.result) setResult(data.result as NovaInvestmentAgentResult);
      else setError(data?.locked ? data.error ?? "VIP required." : data?.error ?? `Error ${res.status}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nova Investment Agent failed");
    } finally {
      setLoading(false);
    }
  };

  const pinResult = async () => {
    if (!result) return;
    setPortfolioActionLoading(true);
    setPortfolioError(null);
    try {
      const res = await fetch("/api/nova-investment-agent/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ result }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error ?? `Error ${res.status}`);
      await loadPins();
    } catch (e) {
      setPortfolioError(e instanceof Error ? e.message : "Failed to pin");
    } finally {
      setPortfolioActionLoading(false);
    }
  };

  const unpin = async (id: string) => {
    setPortfolioActionLoading(true);
    setPortfolioError(null);
    try {
      const res = await fetch(`/api/nova-investment-agent/portfolio?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) throw new Error(data?.error ?? `Error ${res.status}`);
      await loadPins();
    } catch (e) {
      setPortfolioError(e instanceof Error ? e.message : "Failed to unpin");
    } finally {
      setPortfolioActionLoading(false);
    }
  };

  const submitOwnerFeedback = async (pinId: string, worked: boolean, note: string) => {
    setPortfolioActionLoading(true);
    setPortfolioError(null);
    try {
      const res = await fetch("/api/nova-investment-agent/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ pinId, worked, note }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) throw new Error(data?.error ?? `Error ${res.status}`);
      await loadPins();
    } catch (e) {
      setPortfolioError(e instanceof Error ? e.message : "Failed to save feedback");
    } finally {
      setPortfolioActionLoading(false);
    }
  };

  return (
    <div className="mx-6 py-6 space-y-4">
      <Card className="border-zinc-200 dark:border-zinc-700">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
                Nova Investment Agent
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                VIP-only strategy builder for leverage trading: risk/profit preset + duration → entry, exits, leverage, and stop loss.
              </p>
            </div>
            <Badge variant="outline" className="border-violet-400/60 text-violet-800 dark:text-violet-200">
              Nova Finance & Investment
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Investment amount (USD)</label>
              <input
                type="number"
                min={10}
                step={10}
                value={amountUsd}
                onChange={(e) => setAmountUsd(Number(e.target.value))}
                className="w-full text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Contract symbol (e.g. BTC)</label>
              <input
                type="text"
                value={baseSymbol}
                onChange={(e) => setBaseSymbol(e.target.value.toUpperCase())}
                className="w-full text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200"
              />
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 bg-zinc-50/60 dark:bg-zinc-900/30 space-y-3">
            <div className="space-y-1">
              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Risk / profit preset</p>
              <div className="flex flex-wrap gap-2">
                {([
                  ["low_low", "Low risk / Low profit"],
                  ["low_medium", "Low risk / Medium profit"],
                  ["medium_medium", "Medium risk / Medium profit"],
                  ["high_high", "High risk / High profit"],
                ] as Array<[RiskProfitPreset, string]>).map(([key, label]) => (
                  <Button
                    key={key}
                    type="button"
                    variant={riskProfitPreset === key ? "secondary" : "outline"}
                    onClick={() => setRiskProfitPreset(key)}
                    className={riskProfitPreset === key ? "border-violet-500" : ""}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Duration style</p>
              <div className="flex flex-wrap gap-2">
                {([
                  ["long_term", "Long term"],
                  ["short_term", "Short term"],
                  ["scalp", "Short term scalp"],
                  ["swing", "Short term swing"],
                  ["hybrid_scalp_swing", "Hybrid: scalp + swing"],
                  ["hybrid_short_long", "Hybrid: short + long"],
                ] as Array<[DurationMode, string]>).map(([mode, label]) => (
                  <Button
                    key={mode}
                    type="button"
                    variant={durationMode === mode ? "secondary" : "outline"}
                    onClick={() => setDurationMode(mode)}
                    className={durationMode === mode ? "border-violet-500" : ""}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            {durationMode === "long_term" && (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs text-muted-foreground">Pick:</span>
                {(["1w", "2w", "1m", "2m"] as const).map((id) => (
                  <Button key={id} type="button" variant={longTermId === id ? "secondary" : "outline"} onClick={() => setLongTermId(id)} className={longTermId === id ? "border-violet-500" : ""}>
                    {id === "1w" ? "1 week" : id === "2w" ? "2 weeks" : id === "1m" ? "1 month" : "2 months"}
                  </Button>
                ))}
              </div>
            )}

            {durationMode === "short_term" && (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs text-muted-foreground">Pick:</span>
                {(["1d", "2d"] as const).map((id) => (
                  <Button key={id} type="button" variant={shortTermId === id ? "secondary" : "outline"} onClick={() => setShortTermId(id)} className={shortTermId === id ? "border-violet-500" : ""}>
                    {id === "1d" ? "1 day" : "2 days"}
                  </Button>
                ))}
              </div>
            )}

            {durationMode === "scalp" && (
              <div className="flex flex-wrap items-center gap-2">
                {(["5m", "15m", "30m", "1h", "2h"] as const).map((id) => (
                  <Button key={id} type="button" variant={scalpId === id ? "secondary" : "outline"} onClick={() => setScalpId(id)} className={scalpId === id ? "border-violet-500" : ""}>
                    {id}
                  </Button>
                ))}
              </div>
            )}

            {durationMode === "swing" && (
              <div className="flex flex-wrap items-center gap-2">
                {(["1h", "2h", "4h", "8h", "24h", "48h", "72h"] as const).map((id) => (
                  <Button key={id} type="button" variant={swingId === id ? "secondary" : "outline"} onClick={() => setSwingId(id)} className={swingId === id ? "border-violet-500" : ""}>
                    {id}
                  </Button>
                ))}
              </div>
            )}

            {durationMode === "hybrid_scalp_swing" && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs text-muted-foreground">Split:</span>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={scalpSplitPct}
                      onChange={(e) => setScalpSplitPct(Number(e.target.value))}
                    />
                    <span className="text-xs">{scalpSplitPct}% scalp</span>
                  </label>
                  <span className="text-xs text-muted-foreground">{100 - scalpSplitPct}% swing</span>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground">Scalp leg</span>
                    <select value={hybridScalpId} onChange={(e) => setHybridScalpId(e.target.value as any)} className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                      {(["5m", "15m", "30m", "1h", "2h"] as const).map((id) => (
                        <option value={id} key={id}>
                          {id}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground">Swing leg</span>
                    <select value={hybridSwingId} onChange={(e) => setHybridSwingId(e.target.value as any)} className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                      {(["1h", "2h", "4h", "8h", "24h", "48h", "72h"] as const).map((id) => (
                        <option value={id} key={id}>
                          {id}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {durationMode === "hybrid_short_long" && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs text-muted-foreground">Split:</span>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="range" min={0} max={100} value={shortSplitPct} onChange={(e) => setShortSplitPct(Number(e.target.value))} />
                    <span className="text-xs">{shortSplitPct}% short</span>
                  </label>
                  <span className="text-xs text-muted-foreground">{100 - shortSplitPct}% long</span>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground">Short leg</span>
                    <select value={hybridShortId} onChange={(e) => setHybridShortId(e.target.value as any)} className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                      {(["1d", "2d"] as const).map((id) => (
                        <option value={id} key={id}>
                          {id}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground">Long leg</span>
                    <select value={hybridLongId} onChange={(e) => setHybridLongId(e.target.value as any)} className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                      {(["1w", "2w", "1m", "2m"] as const).map((id) => (
                        <option value={id} key={id}>
                          {id}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button onClick={generate} disabled={loading} className="bg-violet-500 hover:bg-violet-600 text-white dark:bg-violet-600 dark:hover:bg-violet-700">
              {loading ? "Generating…" : "Generate Strategy"}
            </Button>
            {error && <span className="text-sm text-rose-600 dark:text-rose-400">{error}</span>}
          </div>

          {result && (
            <>
              <div className="rounded-lg border border-emerald-200/60 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/30 p-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">Expected return</span>
                  <Badge variant="outline" className="border-emerald-400/60 text-emerald-800 dark:text-emerald-200">
                    {formatUsd(result.totalExpectedReturnUsd)} ({formatPct(result.totalExpectedReturnPct)})
                  </Badge>
                  <span className="text-xs text-muted-foreground">Approximation based on selected TP + leverage (not a guarantee).</span>
                </div>
              </div>

              <div className="space-y-4">
                {result.legs.map((leg, idx) => (
                  <Card key={`${leg.timeframeId}-${idx}`} className="border-zinc-200 dark:border-zinc-700">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                              {leg.legType.toUpperCase()} • {leg.durationLabel}
                            </span>
                            <Badge
                              variant={leg.direction === "long" ? "default" : "secondary"}
                              className={leg.direction === "long" ? "bg-emerald-600 text-[10px] px-2" : "bg-rose-600 text-[10px] px-2"}
                            >
                              {leg.direction.toUpperCase()}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Leverage: <span className="font-mono">{leg.leverage}x</span> • SL:{" "}
                            <span className="font-mono">{leg.stopLossPct}%</span> • TP:{" "}
                            <span className="font-mono">{leg.takeProfitPct}%</span>
                          </div>
                        </div>
                        <Badge variant="outline" className="border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200">
                          Leg expected: {formatUsd(leg.expectedReturnUsdOnLeg)} ({formatPct(leg.expectedReturnPctOnMargin)})
                        </Badge>
                      </div>

                      {leg.notes && leg.notes.length > 0 && (
                        <div className="text-xs text-amber-800 dark:text-amber-200 bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/60 p-2 rounded">
                          {leg.notes.map((n) => (
                            <div key={n}>{n}</div>
                          ))}
                        </div>
                      )}

                      <div className="text-xs text-muted-foreground space-y-1">
                        <div>
                          <span className="text-zinc-700 dark:text-zinc-200 font-medium">Entry:</span> {leg.entryPlan}
                        </div>
                        <div>
                          <span className="text-zinc-700 dark:text-zinc-200 font-medium">Exit:</span> {leg.exitPlan}
                        </div>
                      </div>

                      {leg.coins.length > 0 && (
                        <div className="overflow-x-auto">
                          <Table className="text-xs">
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[18%]">Coin</TableHead>
                                <TableHead className="w-[12%] text-right">Alloc</TableHead>
                                <TableHead className="w-[22%] text-right">Entry zone</TableHead>
                                <TableHead className="w-[18%] text-right">Stop</TableHead>
                                <TableHead className="w-[18%] text-right">TP</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {leg.coins.map((c) => (
                                <TableRow key={`${c.symbol}-${c.allocationPct}`}>
                                  <TableCell className="font-mono">{c.symbol}</TableCell>
                                  <TableCell className="text-right font-mono">{c.allocationPct.toFixed(0)}%</TableCell>
                                  <TableCell className="text-right font-mono">
                                    ${c.entryZoneLow.toLocaleString(undefined, { maximumFractionDigits: 4 })} - $
                                    {c.entryZoneHigh.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                                  </TableCell>
                                  <TableCell className="text-right font-mono text-rose-600 dark:text-rose-400">
                                    ${c.stopLossPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                                  </TableCell>
                                  <TableCell className="text-right font-mono text-emerald-600 dark:text-emerald-400">
                                    ${c.takeProfitPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-200/60 dark:border-zinc-800/60">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void pinResult()}
                          disabled={portfolioActionLoading}
                        >
                          Accept & Pin to Portfolio
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {result.overallNote && <p className="text-xs text-muted-foreground">{result.overallNote}</p>}
            </>
          )}
        </CardContent>
      </Card>

      <details className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/40" open={pins.length > 0}>
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Portfolio (Nova Investment Agent) {pins.length > 0 ? `(${pins.length})` : ""}
        </summary>
        <div className="px-4 pb-4 pt-2 space-y-3">
          {portfolioError && pins.length === 0 && (
            <p className="text-xs text-rose-600 dark:text-rose-400">{portfolioError}</p>
          )}
          {pinsLoading && pins.length === 0 ? (
            <p className="text-xs text-muted-foreground">Loading portfolio…</p>
          ) : pins.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">Pin a strategy from above to track it here.</p>
          ) : (
            pins.map((p) => (
              <div key={p.id} className="rounded-md border border-zinc-200/70 dark:border-zinc-700/70 bg-white/40 dark:bg-zinc-900/30 p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                      {p.result.baseSymbol} • {p.result.durationMode.replace(/_/g, " ")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Pinned: {new Date(p.pinnedAt).toLocaleString()} • Expected: {formatUsd(p.result.totalExpectedReturnUsd)} ({formatPct(p.result.totalExpectedReturnPct)})
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => void unpin(p.id)} className="text-rose-600 dark:text-rose-400" disabled={portfolioActionLoading}>
                      Unpin
                    </Button>
                  </div>
                </div>

                {isOwner && (
                  <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-800/60 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-zinc-700 dark:text-zinc-200">Owner feedback:</span>
                      {p.ownerFeedback ? (
                        <Badge variant={p.ownerFeedback.worked ? "default" : "secondary"} className={p.ownerFeedback.worked ? "bg-emerald-600" : "bg-rose-600"}>
                          {p.ownerFeedback.worked ? "WORKED" : "DID NOT WORK"}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not rated yet</span>
                      )}
                    </div>
                    {!p.ownerFeedback && (
                      <OwnerFeedbackForm
                        onSubmit={(worked, note) => void submitOwnerFeedback(p.id, worked, note)}
                      />
                    )}
                    {p.ownerFeedback && (
                      <p className="text-xs text-muted-foreground">
                        {p.ownerFeedback.note ?? "—"} • {p.ownerFeedback.at ? new Date(p.ownerFeedback.at).toLocaleString() : "—"}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </details>
    </div>
  );
}

function OwnerFeedbackForm({ onSubmit }: { onSubmit: (worked: boolean, note: string) => void }) {
  const [worked, setWorked] = useState<"worked" | "not_worked" | null>(null);
  const [note, setNote] = useState("");

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={worked === "worked" ? "secondary" : "outline"}
          onClick={() => setWorked("worked")}
        >
          Yes (worked)
        </Button>
        <Button
          type="button"
          size="sm"
          variant={worked === "not_worked" ? "secondary" : "outline"}
          onClick={() => setWorked("not_worked")}
        >
          No (did not work)
        </Button>
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Reason (why it worked or didn’t)"
        className="w-full min-h-[80px] rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200"
      />
      <Button
        type="button"
        size="sm"
        onClick={() => {
          if (!worked) return;
          const trimmed = note.trim();
          onSubmit(worked === "worked", trimmed);
        }}
        disabled={!worked || note.trim().length === 0}
      >
        Save feedback
      </Button>
    </div>
  );
}

