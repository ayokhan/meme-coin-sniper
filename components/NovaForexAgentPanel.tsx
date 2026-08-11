"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { normalizeForexSymbol, type ForexSymbolEntry } from "@/lib/forex-market";
import { clearNovaQPrefill, readNovaQPrefill } from "@/lib/nova-q-prefill";

import NovaForexRadarPanel from "@/components/NovaForexRadarPanel";
import NovaQTimeframeTable from "@/components/NovaQTimeframeTable";
import NovaQTradePlanCard from "@/components/NovaQTradePlanCard";
import { NOVA_FORECAST_RANGES, NOVA_FOREX_Q_TIMEFRAMES } from "@/lib/nova-forex-timeframes";
import { hasNovaForexScalperPrefill } from "@/lib/nova-forex-scalper-prefill";
import type { NovaQAlignment, NovaQTradePlan } from "@/lib/nova-q-trade-plan";
import Link from "next/link";
import { Flame } from "lucide-react";

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
  novaForexBot?: boolean;
  novaForexScalpBot?: boolean;
};

function fmtUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 4, minimumFractionDigits: 2 })}`;
}

export default function NovaForexAgentPanel({
  enabled,
  isVip,
  novaForexFib,
  novaForexBot = false,
  novaForexScalpBot = false,
}: Props) {
  const [subTab, setSubTab] = useState<
    "forecast" | "nova-q" | "nova-smart" | "nova-q-fib" | "nova-radar"
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "nova-forex" && params.get("forex") === "nova-scalp") {
      window.location.replace("/?tab=nova-pulse&pulse=forex");
      return;
    }
    if (params.get("tab") === "nova-forex" && params.get("forex") === "nova-q") {
      setSubTab("nova-q");
    }
    /** Legacy deep links → Focus → Bots → Nova Forex Bots */
    const forex = params.get("forex");
    if (
      params.get("tab") === "nova-forex" &&
      (forex === "forex-bot" || forex === "scalp-bot" || hasNovaForexScalperPrefill())
    ) {
      const target =
        forex === "forex-bot"
          ? "/?tab=nova-forex-bot&forex=forex-bot"
          : "/?tab=nova-forex-bot&forex=scalp-bot";
      window.location.replace(target);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!novaForexScalpBot && !novaForexBot) return;
    if (hasNovaForexScalperPrefill()) {
      window.location.replace("/?tab=nova-forex-bot&forex=scalp-bot");
    }
  }, [novaForexScalpBot, novaForexBot]);

  useEffect(() => {
    const prefill = readNovaQPrefill();
    if (!prefill || prefill.market !== "forex") return;
    clearNovaQPrefill();
    const sym = prefill.symbol.trim().toUpperCase();
    if (!sym) return;
    setSubTab("nova-q");
    setSymbol(sym);
    if (prefill.timeframeId && !qTfs.includes(prefill.timeframeId)) {
      setQTfs((prev) => [...prev, prefill.timeframeId!]);
    }
    let cancelled = false;
    const tfs = prefill.timeframeId && !qTfs.includes(prefill.timeframeId)
      ? [...qTfs, prefill.timeframeId]
      : qTfs;
    (async () => {
      setQLoading(true);
      setQError(null);
      try {
        const res = await fetch("/api/nova-forex/nova-q", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ symbol: sym, timeframes: tfs }),
        });
        const d = await res.json();
        if (cancelled) return;
        if (!res.ok || !d.success) {
          setQError(d.error ?? "NovaQ Forex failed");
          setQResult(null);
          return;
        }
        setQResult(d.result as NovaQResult);
      } catch {
        if (!cancelled) {
          setQError("NovaQ Forex failed");
          setQResult(null);
        }
      } finally {
        if (!cancelled) setQLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          Forex, indices, and equities from a Market Watch catalog (XAUUSD, EURUSD, NAS100, TSLA, etc.). When your MT
          account is connected, live gold/silver quotes prefer your <strong className="text-foreground">broker mid</strong>{" "}
          (same book the bots trade). Otherwise we use a spot mid — TradingView may still differ if you chart a different
          broker feed.
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
        </TabsList>

        <div className="rounded-lg border border-sky-500/30 bg-sky-950/10 dark:bg-sky-950/20 px-3 py-2.5 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Looking for short-horizon scalp plans? Open <strong className="text-foreground">Nova Pulse</strong> → Forex
            (Nova Forex Agent).
          </p>
          <Button asChild size="sm" variant="outline">
            <Link href="/?tab=nova-pulse&pulse=forex">Open Nova Pulse</Link>
          </Button>
        </div>

        {(novaForexBot || novaForexScalpBot) && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 px-3 py-2.5 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              <Flame className="inline-block h-3.5 w-3.5 mr-1 text-emerald-500 -mt-0.5" aria-hidden />
              Ready to trade? Open <strong className="text-foreground">Nova Forex Bots</strong> under Focus → Bots.
            </p>
            <Button asChild size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white">
              <Link href={novaForexScalpBot ? "/?tab=nova-forex-bot&forex=scalp-bot" : "/?tab=nova-forex-bot&forex=forex-bot"}>
                Open Forex Bots
              </Link>
            </Button>
          </div>
        )}

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
                <NovaQTimeframeTable
                  currentPrice={qResult.currentPrice}
                  timeframes={qResult.timeframes.map((tf) => ({
                    ...tf,
                    structureDirection: (tf.structureDirection as "bullish" | "bearish" | "sideways") || "sideways",
                    trendlineBias: (tf.trendlineBias as "up" | "down" | "flat") || "flat",
                    direction: (tf.direction as "bullish" | "bearish" | "sideways") || "sideways",
                  }))}
                />
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
