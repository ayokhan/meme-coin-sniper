"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { NovaQFibResult, NovaQFibTimeframeResult } from "@/lib/nova-q-fib";

import { NOVA_UI_TIMEFRAME_IDS, sortNovaTimeframeIds } from "@/lib/nova-timeframes";

const FIB_TIMEFRAME_OPTIONS = NOVA_UI_TIMEFRAME_IDS.filter((id) =>
  ["1m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "12h", "24h", "48h", "1w", "2w", "4w"].includes(id)
);

type Props = {
  enabled: boolean;
  isVip: boolean;
};

function fibBiasBadgeClass(bias: NovaQFibTimeframeResult["fibBias"] | NovaQFibResult["overallFibBias"]): string {
  if (bias === "bullish_pullback") return "border-emerald-500/60 text-emerald-700 dark:text-emerald-300";
  if (bias === "bearish_pullback") return "border-rose-500/60 text-rose-700 dark:text-rose-300";
  if (bias === "extended") return "border-amber-500/60 text-amber-700 dark:text-amber-300";
  if (bias === "breakdown_risk") return "border-orange-500/60 text-orange-700 dark:text-orange-300";
  if (bias === "mixed") return "border-violet-500/60 text-violet-700 dark:text-violet-300";
  return "border-zinc-400/60 text-zinc-700 dark:text-zinc-300";
}

function formatFibBiasLabel(bias: string): string {
  return bias.replace(/_/g, " ");
}

function formatPrice(n: number): string {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 4, minimumFractionDigits: 2 })}`;
}

export default function NovaQFibPanel({ enabled, isVip }: Props) {
  const [timeframes, setTimeframes] = useState<string[]>(["15m", "1h", "1w"]);
  const [symbol, setSymbol] = useState("BTC");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<NovaQFibResult | null>(null);

  const run = useCallback(async () => {
    if (!enabled) {
      setError("NovaQ Fib is not available on your account yet. Contact support if you need access.");
      return;
    }
    if (!isVip) {
      setError("NovaQ Fib is for VIP subscribers.");
      return;
    }
    const sym = symbol.trim().toUpperCase();
    if (!sym) {
      setError("Enter a contract symbol.");
      return;
    }
    if (timeframes.length === 0) {
      setError("Select at least one timeframe.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/nova-q-fib", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ symbol: sym, timeframes }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        error?: string;
        disabled?: boolean;
        locked?: boolean;
        result?: NovaQFibResult;
      };
      if (!res.ok || !data.success) {
        setResult(null);
        setError(data.error ?? "NovaQ Fib failed");
        return;
      }
      setResult(data.result ?? null);
    } catch {
      setError("NovaQ Fib request failed");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [enabled, isVip, symbol, timeframes]);

  const toggleTf = (tf: string) => {
    setTimeframes((prev) => {
      const next = prev.includes(tf) ? prev.filter((t) => t !== tf) : [...prev, tf];
      return sortNovaTimeframeIds(next);
    });
  };

  if (!enabled) {
    return (
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
        <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-2">NovaQ Fib</h2>
        <p className="text-sm text-muted-foreground">
          NovaQ Fib is not available on your account yet. Contact support if you need access.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
      <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-2">NovaQ Fib</h2>
      <p className="text-xs text-muted-foreground mb-4">
        Fibonacci retracement from recent pivot swing high/low per timeframe—separate from classic{" "}
        <strong className="text-zinc-700 dark:text-zinc-300">NovaQ</strong> (no Fib there). Enter{" "}
        <strong className="text-zinc-700 dark:text-zinc-300">XAU</strong> or <strong className="text-zinc-700 dark:text-zinc-300">XAG</strong> for Blofin metals (
        <span className="font-mono">XAU-USDT</span>, <span className="font-mono">XAG-USDT</span>); other symbols use Hyperliquid. Period support/resistance in the table is the same window high/low reference only.
      </p>
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Timeframes:</span>
          {FIB_TIMEFRAME_OPTIONS.map((tf) => (
            <label key={`nova-q-fib-${tf}`} className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={timeframes.includes(tf)}
                onChange={() => toggleTf(tf)}
                className="rounded border-zinc-400 dark:border-zinc-500"
              />
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{tf}</span>
            </label>
          ))}
        </div>
        <input
          type="text"
          placeholder="Symbol e.g. BTC, XAU, XAG"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 w-56 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-500"
        />
        <Button onClick={run} disabled={loading || timeframes.length === 0 || !symbol.trim()}>
          {loading ? "Running…" : "Run NovaQ Fib"}
        </Button>
      </div>
      {timeframes.length === 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">Select at least one timeframe.</p>
      )}
      {error && <p className="text-sm text-rose-600 dark:text-rose-400 mb-3">{error}</p>}
      {!loading && !error && !result && (
        <p className="text-xs text-muted-foreground">Choose timeframe(s), enter a symbol (e.g. BTC, XAU, XAG), then run.</p>
      )}
      {result && (
        <div className="space-y-4">
          <div className="rounded-md border border-zinc-200 dark:border-zinc-700 p-3 bg-zinc-50/60 dark:bg-zinc-900/30">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-sm font-semibold text-zinc-800 dark:text-zinc-200">{result.symbol}</span>
              <span className="text-xs text-muted-foreground">
                Price: {result.currentPrice != null ? formatPrice(result.currentPrice) : "—"}
              </span>
              <Badge variant="outline" className={fibBiasBadgeClass(result.overallFibBias)}>
                Overall: {formatFibBiasLabel(result.overallFibBias)}
              </Badge>
            </div>
            {result.overallRead?.trim() ? (
              <p className="mt-2 text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">{result.overallRead}</p>
            ) : null}
            {result.contractDescription?.trim() ? (
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{result.contractDescription}</p>
            ) : null}
          </div>
          {result.timeframes.length === 0 ? (
            <p className="text-xs text-muted-foreground">No timeframe data. Try another symbol or wider timeframes.</p>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">TF</TableHead>
                      <TableHead className="text-xs">Leg</TableHead>
                      <TableHead className="text-right text-xs">Swing high</TableHead>
                      <TableHead className="text-right text-xs">Swing low</TableHead>
                      <TableHead className="text-right text-xs" title="Window low (NovaQ-style reference)">
                        Period S
                      </TableHead>
                      <TableHead className="text-right text-xs" title="Window high (NovaQ-style reference)">
                        Period R
                      </TableHead>
                      <TableHead className="text-right text-xs">Retrace %</TableHead>
                      <TableHead className="text-xs">Nearest Fib</TableHead>
                      <TableHead className="text-xs">Fib read</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.timeframes.map((tf) => (
                      <TableRow key={`nova-q-fib-${tf.id}`}>
                        <TableCell className="text-xs font-medium">{tf.label}</TableCell>
                        <TableCell className="text-xs">
                          <Badge variant="outline" className={tf.swingLeg === "up" ? "border-emerald-500/60 text-emerald-700 dark:text-emerald-300" : "border-rose-500/60 text-rose-700 dark:text-rose-300"}>
                            {tf.swingLeg === "up" ? "up leg" : "down leg"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-rose-600 dark:text-rose-400">{formatPrice(tf.swingHigh)}</TableCell>
                        <TableCell className="text-right font-mono text-xs text-emerald-600 dark:text-emerald-400">{formatPrice(tf.swingLow)}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{formatPrice(tf.periodSupport)}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{formatPrice(tf.periodResistance)}</TableCell>
                        <TableCell className="text-right font-mono text-xs tabular-nums">
                          {tf.retracementPct != null ? `${tf.retracementPct.toFixed(1)}%` : "—"}
                        </TableCell>
                        <TableCell className="text-xs font-mono">{tf.nearestFibLabel}</TableCell>
                        <TableCell className="text-xs align-top max-w-[280px]">
                          <Badge variant="outline" className={`mb-1 ${fibBiasBadgeClass(tf.fibBias)}`}>
                            {formatFibBiasLabel(tf.fibBias)}
                          </Badge>
                          <p className="text-muted-foreground leading-relaxed mt-1" title={tf.zoneRead}>
                            {tf.zoneRead}
                          </p>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {result.timeframes.map((tf) => (
                <details key={`nova-q-fib-levels-${tf.id}`} className="rounded-md border border-zinc-200 dark:border-zinc-700 p-3 text-xs">
                  <summary className="cursor-pointer font-medium text-zinc-800 dark:text-zinc-200">
                    {tf.label} — Fib levels ({tf.swingLeg === "up" ? "pullback from high" : "bounce from low"})
                  </summary>
                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {tf.levels.map((lv) => (
                      <div key={`${tf.id}-${lv.key}`} className="font-mono text-[11px] text-zinc-700 dark:text-zinc-300">
                        <span className="text-muted-foreground">{lv.key}</span> {formatPrice(lv.price)}
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
