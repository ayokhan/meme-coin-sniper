"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import NovaTimeframeCheckboxPicker from "@/components/NovaTimeframeCheckboxPicker";
import { formatQuotePriceUsd } from "@/lib/format-quote-price";
import type { NovaPatternResult } from "@/lib/nova-pattern-detector";
import { NOVA_PATTERN_LOOKBACK_OPTIONS } from "@/lib/nova-pattern-detector";

type Props = {
  enabled: boolean;
  isVip: boolean;
};

function patternBadgeClass(type: NovaPatternResult["patternType"]): string {
  if (type === "range") return "border-violet-500/60 text-violet-700 dark:text-violet-300 bg-violet-500/10";
  if (type === "uptrend") return "border-emerald-500/60 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10";
  if (type === "downtrend") return "border-rose-500/60 text-rose-700 dark:text-rose-300 bg-rose-500/10";
  return "border-zinc-400/60 text-zinc-600 dark:text-zinc-400";
}

export default function NovaPatternDetectorPanel({ enabled, isVip }: Props) {
  const [symbol, setSymbol] = useState("XAU");
  const [lookbackId, setLookbackId] = useState("6w");
  const [timeframes, setTimeframes] = useState<string[]>(["24h", "48h", "1w"]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<NovaPatternResult | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/nova-pattern-detector", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, lookbackId, timeframes }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "Analysis failed");
        setResult(null);
        return;
      }
      setResult(data.result as NovaPatternResult);
    } catch {
      setError("Network error");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [symbol, lookbackId, timeframes]);

  if (!enabled) {
    return (
      <p className="text-sm text-muted-foreground">
        Nova Pattern Detector is not enabled for this site yet. Ask an admin to turn on the feature flag.
      </p>
    );
  }

  if (!isVip) {
    return (
      <p className="text-sm text-muted-foreground">
        Nova Pattern Detector is for VIP subscribers. Upgrade to unlock swing-cycle analysis for XAU, BTC, and more.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">Nova Pattern Detector</h2>
        <p className="text-xs text-muted-foreground mt-1 max-w-3xl">
          Discover recurring swing highs and lows — e.g. whether {symbol || "XAU"} tends to rally toward a typical ceiling then
          retrace to a floor within a week. Uses daily swings for the lookback window plus your selected intraday timeframes.
          XAU and XAG use Blofin; other symbols use Hyperliquid.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-muted-foreground">
          Contract
          <input
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            placeholder="XAU, BTC, ETH…"
            className="mt-1 block w-28 rounded-md border border-zinc-300 dark:border-zinc-600 px-2 py-1.5 text-sm bg-white dark:bg-zinc-800"
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Swing lookback
          <select
            value={lookbackId}
            onChange={(e) => setLookbackId(e.target.value)}
            className="mt-1 block rounded-md border border-zinc-300 dark:border-zinc-600 px-2 py-1.5 text-sm bg-white dark:bg-zinc-800"
          >
            {NOVA_PATTERN_LOOKBACK_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <Button type="button" onClick={() => void run()} disabled={loading}>
          {loading ? "Analyzing…" : "Run pattern scan"}
        </Button>
      </div>

      <NovaTimeframeCheckboxPicker selected={timeframes} onChange={setTimeframes} idPrefix="nova-pattern-tf" />

      {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

      {result && (
        <div className="space-y-4">
          <div className="rounded-lg border border-violet-500/30 bg-gradient-to-br from-violet-500/10 to-transparent p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-lg font-bold">{result.symbol}</span>
              <span className="text-sm text-muted-foreground">{formatQuotePriceUsd(result.currentPrice)}</span>
              <Badge variant="outline" className={patternBadgeClass(result.patternType)}>
                {result.patternLabel}
              </Badge>
              <span className="text-[10px] text-muted-foreground uppercase">
                {result.dataSource === "blofin" ? "Blofin" : "Hyperliquid"} · {result.lookbackLabel}
              </span>
            </div>
            <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">{result.summaryParagraph}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="rounded-md border border-zinc-200/80 dark:border-zinc-700/80 p-2">
                <p className="text-muted-foreground text-[10px] uppercase">Typical high zone</p>
                <p className="font-mono font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                  {formatQuotePriceUsd(result.typicalHighZone)}
                </p>
              </div>
              <div className="rounded-md border border-zinc-200/80 dark:border-zinc-700/80 p-2">
                <p className="text-muted-foreground text-[10px] uppercase">Typical low zone</p>
                <p className="font-mono font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {formatQuotePriceUsd(result.typicalLowZone)}
                </p>
              </div>
              <div className="rounded-md border border-zinc-200/80 dark:border-zinc-700/80 p-2">
                <p className="text-muted-foreground text-[10px] uppercase">In range</p>
                <p className="font-mono font-semibold tabular-nums">{result.positionInRangePct.toFixed(0)}%</p>
              </div>
              <div className="rounded-md border border-zinc-200/80 dark:border-zinc-700/80 p-2">
                <p className="text-muted-foreground text-[10px] uppercase">Swing spacing</p>
                <p className="font-mono font-semibold tabular-nums">
                  {result.medianDaysBetweenSwings != null
                    ? `~${result.medianDaysBetweenSwings.toFixed(1)}d`
                    : "—"}
                </p>
              </div>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
              {result.observations.map((o, i) => (
                <li key={i}>{o}</li>
              ))}
            </ul>
          </div>

          {result.swings.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-2">Recent swing turns</h3>
              <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Date</TableHead>
                      <TableHead className="text-xs">Type</TableHead>
                      <TableHead className="text-right text-xs">Price</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.swings.map((s, i) => (
                      <TableRow key={`${s.ts}-${i}`}>
                        <TableCell className="text-xs">{s.label || "—"}</TableCell>
                        <TableCell className="text-xs capitalize">
                          <span
                            className={
                              s.kind === "high"
                                ? "text-rose-600 dark:text-rose-400"
                                : "text-emerald-600 dark:text-emerald-400"
                            }
                          >
                            Swing {s.kind}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs tabular-nums">
                          {formatQuotePriceUsd(s.price)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {result.timeframes.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-2">Per timeframe snapshot</h3>
              <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">TF</TableHead>
                      <TableHead className="text-right text-xs">Support</TableHead>
                      <TableHead className="text-right text-xs">Resistance</TableHead>
                      <TableHead className="text-right text-xs">In range</TableHead>
                      <TableHead className="text-right text-xs">Δ window</TableHead>
                      <TableHead className="text-xs">Read</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.timeframes.map((tf) => (
                      <TableRow key={tf.id}>
                        <TableCell className="text-xs font-medium">{tf.label}</TableCell>
                        <TableCell className="text-right font-mono text-xs text-emerald-600 dark:text-emerald-400">
                          {formatQuotePriceUsd(tf.support)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-rose-600 dark:text-rose-400">
                          {formatQuotePriceUsd(tf.resistance)}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">{tf.positionInRangePct.toFixed(0)}%</TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {tf.changePctWindow != null
                            ? `${tf.changePctWindow >= 0 ? "+" : ""}${tf.changePctWindow.toFixed(2)}%`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px]">{tf.patternHint}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <p className="text-[11px] text-muted-foreground leading-relaxed">{result.contractNote}</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">{result.disclaimer}</p>
        </div>
      )}
    </div>
  );
}
