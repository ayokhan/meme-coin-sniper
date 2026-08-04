"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { NovaQFibResult, NovaQFibTimeframeResult } from "@/lib/nova-q-fib";

import { formatQuotePriceUsd } from "@/lib/format-quote-price";
import { NOVA_UI_TIMEFRAME_IDS } from "@/lib/nova-timeframes";
import {
  clampTimeframesToAllowed,
  loadNovaQSession,
  writeNovaQSession,
} from "@/lib/nova-q-watch";
import { normalizeNovaQSymbol } from "@/lib/nova-q-symbol";
import NovaQRunBar, { notifyNovaQRunSuccess } from "@/components/NovaQRunBar";
import NovaQResultToolbar from "@/components/NovaQResultToolbar";

const FIB_TIMEFRAME_OPTIONS = NOVA_UI_TIMEFRAME_IDS.filter((id) =>
  ["1m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "12h", "24h", "48h", "1w", "2w", "4w"].includes(id)
);

type Props = {
  enabled: boolean;
  isVip: boolean;
  /** Switch to NovaQ tab with same setup. */
  onOpenNovaQ?: (symbol: string, timeframes: string[]) => void;
};

function fibBiasBadgeClass(bias: NovaQFibTimeframeResult["fibBias"] | NovaQFibResult["overallFibBias"]): string {
  if (bias === "bullish_pullback") return "border-emerald-500/60 text-emerald-700 dark:text-emerald-300";
  if (bias === "bearish_pullback") return "border-rose-500/60 text-rose-700 dark:text-rose-300";
  if (bias === "extended") return "border-amber-500/60 text-slate-600 dark:text-slate-300";
  if (bias === "breakdown_risk") return "border-orange-500/60 text-orange-700 dark:text-orange-300";
  if (bias === "mixed") return "border-violet-500/60 text-violet-700 dark:text-violet-300";
  return "border-zinc-400/60 text-zinc-700 dark:text-zinc-300";
}

function formatFibBiasLabel(bias: string): string {
  return bias.replace(/_/g, " ");
}

export default function NovaQFibPanel({ enabled, isVip, onOpenNovaQ }: Props) {
  const [timeframes, setTimeframes] = useState<string[]>(["15m", "1h", "1w"]);
  const [symbol, setSymbol] = useState("BTC");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<NovaQFibResult | null>(null);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    const hydrate = () => {
      const session = loadNovaQSession();
      if (session) {
        setSymbol(session.symbol);
        setTimeframes(clampTimeframesToAllowed(session.timeframes, FIB_TIMEFRAME_OPTIONS));
      }
    };
    hydrate();
    setSessionReady(true);
    window.addEventListener("nova-q-session-changed", hydrate);
    return () => window.removeEventListener("nova-q-session-changed", hydrate);
  }, []);

  const run = useCallback(
    async (overrides?: { symbol?: string; timeframes?: string[] }) => {
      if (!enabled) {
        setError("NovaQ Fib is not available on your account yet. Contact support if you need access.");
        return;
      }
      if (!isVip) {
        setError("NovaQ Fib is for VIP subscribers.");
        return;
      }
      const sym = normalizeNovaQSymbol(overrides?.symbol ?? symbol) || (overrides?.symbol ?? symbol).trim().toUpperCase();
      const tfs = overrides?.timeframes ?? timeframes;
      if (!sym) {
        setError("Enter a contract symbol.");
        return;
      }
      if (sym !== symbol) setSymbol(sym);
      if (tfs.length === 0) {
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
          body: JSON.stringify({ symbol: sym, timeframes: tfs }),
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
        notifyNovaQRunSuccess("fib", sym, tfs);
      } catch {
        setError("NovaQ Fib request failed");
        setResult(null);
      } finally {
        setLoading(false);
      }
    },
    [enabled, isVip, symbol, timeframes]
  );

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
      <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-3">NovaQ Fib</h2>
      {sessionReady && (
        <NovaQRunBar
          tool="fib"
          symbol={symbol}
          timeframes={timeframes}
          onSymbolChange={setSymbol}
          onTimeframesChange={(tfs) =>
            setTimeframes(clampTimeframesToAllowed(tfs, FIB_TIMEFRAME_OPTIONS))
          }
          onApplySetup={(sym, tfs, opts) => {
            const nextTfs = clampTimeframesToAllowed(tfs, FIB_TIMEFRAME_OPTIONS);
            setSymbol(sym);
            setTimeframes(nextTfs);
            writeNovaQSession(sym, nextTfs);
            if (opts?.run) void run({ symbol: sym, timeframes: nextTfs });
          }}
          onRun={() => void run()}
          loading={loading}
          runLabel="Run NovaQ Fib"
          allowedTimeframes={FIB_TIMEFRAME_OPTIONS}
          otherToolLabel={onOpenNovaQ ? "Open in NovaQ" : undefined}
          onOpenOtherTool={onOpenNovaQ}
          helpSummary="Fibonacci retracement from recent pivot swing high/low per timeframe. Enter XAU or XAG for Blofin metals (XAU-USDT, XAG-USDT); other symbols use Hyperliquid. Period support/resistance is the same window high/low for reference. Favorites and recents are shared with NovaQ."
          disabled={!isVip}
        />
      )}
      {error && <p className="text-sm text-rose-600 dark:text-rose-400 mt-3 mb-1">{error}</p>}
      {!loading && !error && !result && sessionReady && (
        <p className="text-xs text-muted-foreground mt-3">
          Pick a favorite or major, or type a symbol — then run.
        </p>
      )}
      {result && (
        <div className="space-y-4 mt-4">
          <div className="rounded-md border border-zinc-200 dark:border-zinc-700 p-3 bg-zinc-50/60 dark:bg-zinc-900/30">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-sm font-semibold text-zinc-800 dark:text-zinc-200">{result.symbol}</span>
              <span className="text-xs text-muted-foreground">
                Price: {result.currentPrice != null ? formatQuotePriceUsd(result.currentPrice) : "—"}
              </span>
              <Badge variant="outline" className={fibBiasBadgeClass(result.overallFibBias)}>
                Overall: {formatFibBiasLabel(result.overallFibBias)}
              </Badge>
            </div>
            <div className="mt-2">
              <NovaQResultToolbar
                tool="fib"
                symbol={result.symbol}
                timeframes={timeframes}
                onRerun={() => void run({ symbol: result.symbol, timeframes })}
                otherToolLabel={onOpenNovaQ ? "Open in NovaQ" : undefined}
                onOpenOtherTool={onOpenNovaQ}
              />
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
                          <Badge
                            variant="outline"
                            className={
                              tf.swingLeg === "up"
                                ? "border-emerald-500/60 text-emerald-700 dark:text-emerald-300"
                                : "border-rose-500/60 text-rose-700 dark:text-rose-300"
                            }
                          >
                            {tf.swingLeg === "up" ? "up leg" : "down leg"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-rose-600 dark:text-rose-400">
                          {formatQuotePriceUsd(tf.swingHigh)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-emerald-600 dark:text-emerald-400">
                          {formatQuotePriceUsd(tf.swingLow)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {formatQuotePriceUsd(tf.periodSupport)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {formatQuotePriceUsd(tf.periodResistance)}
                        </TableCell>
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
                <details
                  key={`nova-q-fib-levels-${tf.id}`}
                  className="rounded-md border border-zinc-200 dark:border-zinc-700 p-3 text-xs"
                >
                  <summary className="cursor-pointer font-medium text-zinc-800 dark:text-zinc-200">
                    {tf.label} — Fib levels ({tf.swingLeg === "up" ? "pullback from high" : "bounce from low"})
                  </summary>
                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {tf.levels.map((lv) => (
                      <div key={`${tf.id}-${lv.key}`} className="font-mono text-[11px] text-zinc-700 dark:text-zinc-300">
                        <span className="text-muted-foreground">{lv.key}</span> {formatQuotePriceUsd(lv.price)}
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
