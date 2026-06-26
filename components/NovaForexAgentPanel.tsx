"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { normalizeForexSymbol, type ForexSymbolEntry } from "@/lib/forex-market";
import { NOVA_SCALP_DISCLAIMER, SCALP_TIMEFRAMES, type NovaScalpAnalysis } from "@/lib/nova-scalp-agent";
import { NovaScalpPlanCard } from "@/components/NovaScalpPlanCard";

import NovaForexRadarPanel from "@/components/NovaForexRadarPanel";
import NovaQTradePlanCard from "@/components/NovaQTradePlanCard";
import { NOVA_FORECAST_RANGES, NOVA_FOREX_Q_TIMEFRAMES } from "@/lib/nova-forex-timeframes";
import type { NovaQAlignment, NovaQTradePlan } from "@/lib/nova-q-trade-plan";

const Q_TF = NOVA_FOREX_Q_TIMEFRAMES.map((t) => t.id);
const FORECAST_RANGES = NOVA_FORECAST_RANGES.map((r) => ({ id: r.id, label: r.label }));

type NovaQResult = {
  symbol: string;
  currentPrice: number | null;
  marketDirection: string;
  overallTrendlineSummary?: string;
  contractDescription?: string;
  alignment?: NovaQAlignment | null;
  tradePlan?: NovaQTradePlan | null;
  timeframes: Array<{
    id: string;
    label: string;
    support: number;
    resistance: number;
    supportTouches: number;
    resistanceTouches: number;
    structureDirection: string;
    trendlineBias: string;
    direction: string;
    trendlineRead?: string;
    demandSupplyRead?: string;
  }>;
};

type Props = {
  enabled: boolean;
  isVip: boolean;
  novaForexFib: boolean;
  novaForexScalp: boolean;
};

function fmtUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 4, minimumFractionDigits: 2 })}`;
}

export default function NovaForexAgentPanel({ enabled, isVip, novaForexFib, novaForexScalp }: Props) {
  const [subTab, setSubTab] = useState<
    "forecast" | "nova-q" | "nova-smart" | "nova-q-fib" | "nova-radar" | "nova-scalp"
  >("forecast");
  const [catalog, setCatalog] = useState<ForexSymbolEntry[]>([]);
  const [symbol, setSymbol] = useState("XAUUSD");
  const [qTfs, setQTfs] = useState<string[]>(["15m", "1h", "1w"]);
  const [smartTfs, setSmartTfs] = useState<string[]>(["15m", "1h", "1w"]);
  const [forecastRange, setForecastRange] = useState("2w");
  const [forecastItems, setForecastItems] = useState<Array<{
    symbol: string;
    high: number;
    low: number;
    currentPrice: number | null;
    direction?: string;
    insight: string;
  }>>([]);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [qResult, setQResult] = useState<NovaQResult | null>(null);
  const [qLoading, setQLoading] = useState(false);
  const [qError, setQError] = useState<string | null>(null);
  const [smartResults, setSmartResults] = useState<Array<Record<string, unknown>>>([]);
  const [smartLoading, setSmartLoading] = useState(false);
  const [smartError, setSmartError] = useState<string | null>(null);
  const [scalpTf, setScalpTf] = useState("5m");
  const [scalpAmount, setScalpAmount] = useState("100");
  const [scalpLev, setScalpLev] = useState("20");
  const [scalpMaxLoss, setScalpMaxLoss] = useState("5");
  const [scalpResult, setScalpResult] = useState<NovaScalpAnalysis | null>(null);
  const [scalpLoading, setScalpLoading] = useState(false);
  const [scalpError, setScalpError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "nova-forex" && params.get("forex") === "nova-scalp") {
      setSubTab("nova-scalp");
    }
  }, []);

  useEffect(() => {
    if (!enabled || !isVip) return;
    fetch("/api/nova-forex/symbols", { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.success && Array.isArray(d.symbols)) setCatalog(d.symbols);
      })
      .catch(() => {});
  }, [enabled, isVip]);

  const toggleTf = (list: string[], setList: (v: string[]) => void, tf: string) => {
    setList(
      list.includes(tf)
        ? list.filter((t) => t !== tf)
        : [...list, tf].sort((a, b) => Q_TF.indexOf(a) - Q_TF.indexOf(b))
    );
  };

  const fetchForecast = useCallback(async () => {
    if (!enabled || !isVip) return;
    setForecastLoading(true);
    setError(null);
    try {
      const qs = `?range=${forecastRange}`;
      const res = await fetch(`/api/nova-forex/forecast${qs}`, { credentials: "include", cache: "no-store" });
      const d = await res.json();
      if (!res.ok || !d.success) {
        setError(d.error ?? "Forecast failed");
        setForecastItems([]);
        return;
      }
      setForecastItems(d.items ?? []);
    } catch {
      setError("Forecast request failed");
    } finally {
      setForecastLoading(false);
    }
  }, [enabled, isVip, forecastRange]);

  const runNovaQ = async () => {
    setQLoading(true);
    setQError(null);
    try {
      const res = await fetch("/api/nova-forex/nova-q", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ symbol: symbol.trim(), timeframes: qTfs }),
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        setQError(d.error ?? "NovaQ Forex failed");
        setQResult(null);
        return;
      }
      setQResult(d.result);
    } catch {
      setQError("Request failed");
    } finally {
      setQLoading(false);
    }
  };

  const runSmart = async () => {
    setSmartLoading(true);
    setSmartError(null);
    try {
      const res = await fetch("/api/nova-forex/nova-smart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ symbol: symbol.trim(), timeframes: smartTfs }),
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        setSmartError(d.error ?? "Smart analysis failed");
        setSmartResults([]);
        return;
      }
      setSmartResults(d.results ?? []);
    } catch {
      setSmartError("Request failed");
    } finally {
      setSmartLoading(false);
    }
  };

  const runScalp = useCallback(async () => {
    setScalpLoading(true);
    setScalpError(null);
    try {
      const res = await fetch("/api/nova-forex/scalp/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          symbol: symbol.trim(),
          timeframeId: scalpTf,
          amountUsd: Number(scalpAmount) || 100,
          leverage: Number(scalpLev) || 20,
          maxLossPctOnMargin: Number(scalpMaxLoss) || 5,
        }),
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        setScalpError(d.error ?? "Scalp failed");
        setScalpResult(null);
        return;
      }
      setScalpResult(d.analysis as NovaScalpAnalysis);
    } catch {
      setScalpError("Request failed");
    } finally {
      setScalpLoading(false);
    }
  }, [symbol, scalpTf, scalpAmount, scalpLev, scalpMaxLoss]);

  if (!enabled) {
    return (
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-6 text-center">
        <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-2">Nova Forex Agent</h2>
        <p className="text-sm text-muted-foreground">
          Nova Forex Agent is not available on your account yet. If you have VIP and do not see this tab, contact support.
        </p>
      </div>
    );
  }

  if (!isVip) {
    return (
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-6 text-center">
        <p className="text-sm text-muted-foreground">Nova Forex Agent is for VIP subscribers.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
        <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-1">Nova Forex Agent</h2>
        <p className="text-xs text-muted-foreground mb-3">
          Forex, indices, and equities from a Market Watch catalog (XAUUSD, EURUSD, NAS100, TSLA, etc.). Gold/silver use **spot-calibrated** prices (Swissquote mid, TradingView/FOREX.com–style); other symbols via Yahoo Finance.
        </p>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="text-xs text-muted-foreground">Symbol:</span>
          <input
            list="nova-forex-symbols"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            onBlur={() => {
              const normalized = normalizeForexSymbol(symbol);
              if (normalized) setSymbol(normalized);
            }}
            placeholder="XAUUSD or XAU"
            className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 w-40 bg-white dark:bg-zinc-800"
          />
          <datalist id="nova-forex-symbols">
            <option value="XAU">Gold (XAUUSD)</option>
            <option value="XAG">Silver (XAGUSD)</option>
            {catalog.map((c) => (
              <option key={c.symbol} value={c.symbol}>
                {c.label}
              </option>
            ))}
          </datalist>
        </div>
      </div>

      <Tabs value={subTab} onValueChange={(v) => setSubTab(v as typeof subTab)} className="space-y-4">
        <TabsList className="bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700/80 p-1 rounded-lg flex-wrap h-auto gap-1">
          <TabsTrigger value="forecast">NovaForex Forecast</TabsTrigger>
          <TabsTrigger value="nova-q">NovaQ Forex</TabsTrigger>
          <TabsTrigger value="nova-smart">Nova Forex Smart</TabsTrigger>
          {novaForexFib && <TabsTrigger value="nova-q-fib">NovaForex Fib</TabsTrigger>}
          <TabsTrigger value="nova-radar">NovaForex Radar</TabsTrigger>
          {novaForexScalp && <TabsTrigger value="nova-scalp">Nova Forex Scalp</TabsTrigger>}
        </TabsList>

        <TabsContent value="forecast" className="mt-0">
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
            <p className="text-xs text-muted-foreground mb-3">
              High / low for all Market Watch symbols (like NovaForecast Agent for crypto). Default range: 2 weeks.
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              <select
                value={forecastRange}
                onChange={(e) => setForecastRange(e.target.value)}
                className="text-sm border rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800"
              >
                {FORECAST_RANGES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
              <Button size="sm" onClick={fetchForecast} disabled={forecastLoading}>
                {forecastLoading ? "Loading…" : "Refresh Market Watch"}
              </Button>
            </div>
            {error && <p className="text-sm text-rose-600 mb-2">{error}</p>}
            {forecastItems.length > 0 && (
              <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Symbol</TableHead>
                      <TableHead className="text-right text-xs">High</TableHead>
                      <TableHead className="text-right text-xs">Low</TableHead>
                      <TableHead className="text-right text-xs">Price</TableHead>
                      <TableHead className="text-xs">Insight</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {forecastItems.map((row) => (
                      <TableRow key={row.symbol}>
                        <TableCell className="font-mono text-xs">{row.symbol}</TableCell>
                        <TableCell className="text-right font-mono text-xs text-rose-600">{fmtUsd(row.high)}</TableCell>
                        <TableCell className="text-right font-mono text-xs text-emerald-600">{fmtUsd(row.low)}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{fmtUsd(row.currentPrice)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[240px]">{row.insight}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="nova-q" className="mt-0">
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
            <p className="text-xs text-muted-foreground mb-3">
              Support / resistance, structure, trendline, blended direction, and <strong>S/R touches</strong> per timeframe (same engine as NovaQ).
            </p>
            <TfPicker options={Q_TF} selected={qTfs} onToggle={(tf) => toggleTf(qTfs, setQTfs, tf)} />
            <Button className="mt-3" onClick={runNovaQ} disabled={qLoading || qTfs.length === 0}>
              {qLoading ? "Running…" : "Run NovaQ Forex"}
            </Button>
            {qError && <p className="text-sm text-rose-600 mt-2">{qError}</p>}
            {qResult && (
              <div className="mt-4 space-y-3">
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="font-mono font-semibold">{qResult.symbol}</span>
                  <span className="text-xs text-muted-foreground">Price: {fmtUsd(qResult.currentPrice)}</span>
                  <Badge variant="outline">{qResult.marketDirection}</Badge>
                </div>
                {qResult.contractDescription && (
                  <p className="text-xs text-muted-foreground">{qResult.contractDescription}</p>
                )}
                {qResult.tradePlan ? <NovaQTradePlanCard plan={qResult.tradePlan} /> : null}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">TF</TableHead>
                      <TableHead className="text-right text-xs">Support</TableHead>
                      <TableHead className="text-right text-xs">S touches</TableHead>
                      <TableHead className="text-right text-xs">Resistance</TableHead>
                      <TableHead className="text-right text-xs">R touches</TableHead>
                      <TableHead className="text-xs">Blended</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {qResult.timeframes.map((tf) => (
                      <TableRow key={tf.id}>
                        <TableCell className="text-xs">{tf.label}</TableCell>
                        <TableCell className="text-right font-mono text-xs text-emerald-600">{fmtUsd(tf.support)}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums">{tf.supportTouches}</TableCell>
                        <TableCell className="text-right font-mono text-xs text-rose-600">{fmtUsd(tf.resistance)}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums">{tf.resistanceTouches}</TableCell>
                        <TableCell className="text-xs">{tf.direction}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="nova-smart" className="mt-0">
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
            <TfPicker options={Q_TF} selected={smartTfs} onToggle={(tf) => toggleTf(smartTfs, setSmartTfs, tf)} />
            <Button className="mt-3" onClick={runSmart} disabled={smartLoading}>
              {smartLoading ? "Running…" : "Run Nova Forex Smart"}
            </Button>
            {smartError && <p className="text-sm text-rose-600 mt-2">{smartError}</p>}
            {smartResults.map((r, i) => (
              <div key={i} className="mt-4 rounded-md border p-3 text-xs space-y-1">
                <p className="font-mono font-semibold">{String(r.symbol)}</p>
                <p>
                  Smart long {fmtUsd(r.smartLongEntry as number)} · Smart short {fmtUsd(r.smartShortEntry as number)} · Strategy:{" "}
                  {String(r.strategy)}
                </p>
                <p className="text-muted-foreground">{String(r.recommendationNote ?? r.strategyNote)}</p>
              </div>
            ))}
          </div>
        </TabsContent>

        {novaForexFib && (
          <TabsContent value="nova-q-fib" className="mt-0">
            <NovaForexFibPanel symbol={symbol} isVip={isVip} enabled={novaForexFib} />
          </TabsContent>
        )}

        <TabsContent value="nova-radar" className="mt-0">
          <NovaForexRadarPanel symbol={symbol} />
        </TabsContent>

        {novaForexScalp && (
          <TabsContent value="nova-scalp" className="mt-0">
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
              <p className="text-xs text-muted-foreground mb-3">
                Short-hold scalp plan from structure and range position on your symbol (e.g. XAUUSD). Not financial advice.
              </p>
              <div className="flex flex-wrap items-end gap-3 mb-3">
                <label className="space-y-1">
                  <span className="text-xs text-muted-foreground">Timeframe</span>
                  <select
                    value={scalpTf}
                    onChange={(e) => setScalpTf(e.target.value)}
                    className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800 block min-w-[7rem]"
                  >
                    {SCALP_TIMEFRAMES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-muted-foreground">Amount (USD margin)</span>
                  <input
                    type="number"
                    min={1}
                    value={scalpAmount}
                    onChange={(e) => setScalpAmount(e.target.value)}
                    className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 w-28 bg-white dark:bg-zinc-800"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-muted-foreground">Leverage</span>
                  <input
                    type="number"
                    min={1}
                    max={125}
                    value={scalpLev}
                    onChange={(e) => setScalpLev(e.target.value)}
                    className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 w-24 bg-white dark:bg-zinc-800"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-muted-foreground">Max loss (% margin)</span>
                  <input
                    type="number"
                    min={0.5}
                    max={100}
                    step={0.5}
                    value={scalpMaxLoss}
                    onChange={(e) => setScalpMaxLoss(e.target.value)}
                    className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 w-24 bg-white dark:bg-zinc-800"
                    title="Used for optional risk stop alongside structural invalidation"
                  />
                </label>
                <Button onClick={() => void runScalp()} disabled={scalpLoading} className="mb-0.5">
                  {scalpLoading ? "Running…" : "Run Nova Forex Scalp"}
                </Button>
              </div>
              {scalpError && <p className="text-sm text-rose-600">{scalpError}</p>}
              {scalpResult && (
                <NovaScalpPlanCard
                  market="forex"
                  result={scalpResult}
                  onRefresh={() => void runScalp()}
                  refreshing={scalpLoading}
                />
              )}
              {!scalpResult && (
                <p className="text-[11px] text-muted-foreground">{NOVA_SCALP_DISCLAIMER}</p>
              )}
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function TfPicker({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: string[];
  onToggle: (tf: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((tf) => (
        <label key={tf} className="flex items-center gap-1 cursor-pointer text-sm">
          <input type="checkbox" checked={selected.includes(tf)} onChange={() => onToggle(tf)} className="rounded" />
          {tf}
        </label>
      ))}
    </div>
  );
}

/** Forex-specific Fib panel (calls /api/nova-forex/nova-q-fib). */
function NovaForexFibPanel({ symbol, isVip, enabled }: { symbol: string; isVip: boolean; enabled: boolean }) {
  const [timeframes, setTimeframes] = useState(["15m", "1h", "1w"]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/nova-forex/nova-q-fib", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ symbol: symbol.trim(), timeframes }),
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        setError(d.error ?? "Failed");
        setResult(null);
        return;
      }
      setResult(d.result);
    } catch {
      setError("Request failed");
    } finally {
      setLoading(false);
    }
  };

  if (!enabled) return <p className="text-sm text-muted-foreground">NovaForex Fib is not available on your account yet. Contact support if you need access.</p>;

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
      <p className="text-xs text-muted-foreground mb-3">Fib retracement from pivot swings for {symbol || "your symbol"}.</p>
      <TfPicker
        options={["5m", "15m", "1h", "4h", "24h", "1w", "2w", "4w"]}
        selected={timeframes}
        onToggle={(tf) =>
          setTimeframes((prev) =>
            prev.includes(tf) ? prev.filter((t) => t !== tf) : [...prev, tf]
          )
        }
      />
      <Button className="mt-3" onClick={run} disabled={loading || !isVip}>
        {loading ? "Running…" : "Run NovaForex Fib"}
      </Button>
      {error && <p className="text-sm text-rose-600 mt-2">{error}</p>}
      {result && (
        <p className="text-xs mt-3 text-muted-foreground">{String((result as { overallRead?: string }).overallRead ?? "")}</p>
      )}
    </div>
  );
}
