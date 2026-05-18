"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  QUICK_WIN_SCALP_TIMEFRAME_ID,
  SCALP_TIMEFRAMES,
  type NovaScalpAnalysis,
  type NovaScalpQuickWin,
} from "@/lib/nova-scalp-agent";

type Props = {
  enabled: boolean;
  isVip: boolean;
};

function fmtUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return "$" + n.toLocaleString(undefined, { maximumFractionDigits: 4, minimumFractionDigits: 2 });
}

function sideBadge(side: NovaScalpAnalysis["side"]) {
  if (side === "long")
    return (
      <span className="inline-flex rounded-md bg-emerald-500/15 px-2.5 py-1 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
        LONG
      </span>
    );
  if (side === "short")
    return (
      <span className="inline-flex rounded-md bg-rose-500/15 px-2.5 py-1 text-sm font-semibold text-rose-700 dark:text-rose-300">
        SHORT
      </span>
    );
  return (
    <span className="inline-flex rounded-md bg-zinc-500/15 px-2.5 py-1 text-sm font-semibold text-zinc-600 dark:text-zinc-300">
      NO ENTRY
    </span>
  );
}

function LockedMessage({
  title,
  body,
  ctaHref,
  ctaLabel,
}: {
  title: string;
  body: string;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-6 text-center space-y-3">
      <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">{title}</h2>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">{body}</p>
      {ctaHref && ctaLabel && (
        <a
          href={ctaHref}
          className="inline-flex text-sm font-medium text-violet-600 dark:text-violet-400 hover:underline"
        >
          {ctaLabel}
        </a>
      )}
    </div>
  );
}


export default function NovaScalpAgentPanel({ enabled, isVip }: Props) {
  const [symbol, setSymbol] = useState("BTC");
  const [amount, setAmount] = useState("100");
  const [leverage, setLeverage] = useState("50");
  const [timeframeId, setTimeframeId] = useState("5m");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<NovaScalpAnalysis | null>(null);

  const [qwLoading, setQwLoading] = useState(false);
  const [qwError, setQwError] = useState<string | null>(null);
  const [quickWins, setQuickWins] = useState<NovaScalpQuickWin[]>([]);
  const [qwDisclaimer, setQwDisclaimer] = useState<string | null>(null);

  const runAgent = useCallback(
    async (overrides?: { symbol?: string; leverage?: number; timeframeId?: string }) => {
    const sym = (overrides?.symbol ?? symbol).trim();
    const lev = overrides?.leverage ?? (Number(leverage) || 10);
    const tf = overrides?.timeframeId ?? timeframeId;
    if (overrides?.symbol) setSymbol(overrides.symbol);
    if (overrides?.leverage != null) setLeverage(String(overrides.leverage));
    if (overrides?.timeframeId) setTimeframeId(overrides.timeframeId);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/nova-scalp-agent/analyze", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: sym,
          amountUsd: Number(amount) || 100,
          leverage: lev,
          timeframeId: tf,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "Analysis failed");
        setResult(null);
        return;
      }
      setResult(data.analysis as NovaScalpAnalysis);
    } catch {
      setError("Network error");
      setResult(null);
    } finally {
      setLoading(false);
    }
  },
    [symbol, amount, leverage, timeframeId]
  );

  const findQuickWins = useCallback(async () => {
    setQwLoading(true);
    setQwError(null);
    try {
      const res = await fetch("/api/nova-scalp-agent/quick-wins", { credentials: "include", cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setQwError(data.error ?? "Quick Wins scan failed");
        setQuickWins([]);
        return;
      }
      setQuickWins((data.quickWins as NovaScalpQuickWin[]) ?? []);
      setQwDisclaimer(data.disclaimer ?? null);
    } catch {
      setQwError("Network error");
      setQuickWins([]);
    } finally {
      setQwLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled || !isVip) return;
    void findQuickWins();
  }, [enabled, isVip, findQuickWins]);

  if (!enabled) {
    return (
      <LockedMessage
        title="Nova Scalp Agent"
        body="This feature is turned off. Ask an admin to enable Nova Scalp Agent under Admin → Feature Flags."
      />
    );
  }

  if (!isVip) {
    return (
      <LockedMessage
        title="VIP required"
        body="Nova Scalp Agent is for VIP subscribers. Upgrade to unlock leveraged scalp analysis and Quick Wins."
        ctaHref="/subscribe"
        ctaLabel="Upgrade to VIP"
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">Nova Scalp Agent</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Leveraged scalp plan from market structure, regression trendline, and range position on Hyperliquid perps.
            For gold use XAU (maps to PAXG).
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Contract</span>
            <input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="BTC"
              className="w-full text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-2 bg-white dark:bg-zinc-800 font-mono"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Amount (USD margin)</span>
            <input
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-2 bg-white dark:bg-zinc-800"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Leverage</span>
            <input
              type="number"
              min={1}
              max={125}
              value={leverage}
              onChange={(e) => setLeverage(e.target.value)}
              className="w-full text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-2 bg-white dark:bg-zinc-800"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Time frame</span>
            <select
              value={timeframeId}
              onChange={(e) => setTimeframeId(e.target.value)}
              className="w-full text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-2 bg-white dark:bg-zinc-800"
            >
              {SCALP_TIMEFRAMES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <Button onClick={() => void runAgent()} disabled={loading} className="bg-violet-600 hover:bg-violet-700 text-white">
          {loading ? "Running…" : "Run Agent"}
        </Button>
        {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

        {result && (
          <Card className="border-violet-300/50 dark:border-violet-800/50">
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <CardTitle className="text-base font-mono">
                  {result.symbol} · {result.timeframeLabel}
                </CardTitle>
                {sideBadge(result.side)}
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="text-muted-foreground text-xs">Entry</span>
                    <p className="font-mono font-medium">{fmtUsd(result.entryPrice)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Exit target</span>
                    <p className="font-mono font-medium">{fmtUsd(result.exitPrice)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Stop (invalidation)</span>
                    <p className="font-mono font-medium text-amber-700 dark:text-amber-300">
                      {fmtUsd(result.stopLossPrice)}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Current price</span>
                    <p className="font-mono">{fmtUsd(result.currentPrice)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Expected PnL</span>
                    <p
                      className={`font-mono font-medium ${
                        (result.expectedPnlUsd ?? 0) >= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {result.expectedPnlUsd != null
                        ? `${result.expectedPnlUsd >= 0 ? "+" : ""}$${result.expectedPnlUsd.toLocaleString()} (${result.expectedPnlPctOnMargin?.toFixed(1) ?? "—"}% on margin)`
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Est. hold time</span>
                    <p className="font-mono">
                      {result.estimatedHoldMinutes != null ? `~${result.estimatedHoldMinutes} min` : "—"}
                    </p>
                  </div>
                </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{result.rationale}</p>
              {result.side === "no_entry" && timeframeId !== QUICK_WIN_SCALP_TIMEFRAME_ID && (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Quick Wins uses the <strong>5 min</strong> timeframe. Try 5m or 15m here, or pick a symbol from Quick Wins
                  and use Analyze (sets 5m automatically).
                </p>
              )}
              <p className="text-[11px] text-muted-foreground">{result.disclaimer}</p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="rounded-lg border border-cyan-200/80 dark:border-cyan-900/60 bg-cyan-50/40 dark:bg-cyan-950/20 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-200">Quick Wins</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Only symbols with a confirmed <strong>5 min</strong> LONG or SHORT from Run Agent (tight range + entry zone).
              Momentum bias is extra context — not a separate signal.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={findQuickWins} disabled={qwLoading}>
            {qwLoading ? "Scanning…" : "Find me quick wins"}
          </Button>
        </div>
        {qwError && <p className="text-sm text-rose-600 dark:text-rose-400">{qwError}</p>}
        {quickWins.length === 0 && !qwLoading && !qwError && (
          <p className="text-xs text-muted-foreground">No quick-win candidates right now. Try again in a few minutes.</p>
        )}
        {quickWins.length > 0 && (
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {quickWins.map((w) => (
              <div
                key={w.symbol}
                className="flex flex-wrap items-start justify-between gap-2 rounded-md border border-zinc-200/80 dark:border-zinc-700/80 bg-white/80 dark:bg-zinc-900/50 px-3 py-2"
              >
                    <div>
                      <p className="font-mono font-semibold text-sm">{w.symbol}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{w.directionHint}</p>
                      <p className="text-[11px] text-muted-foreground">{w.liquidityNote}</p>
                    </div>
                    <div className="text-right text-xs space-y-0.5">
                      <p>
                        Score{" "}
                        <span className="font-mono font-semibold text-cyan-700 dark:text-cyan-300">
                          {w.quickWinScore}
                        </span>
                      </p>
                      <p>
                        Plan{" "}
                        <span
                          className={`font-medium uppercase ${
                            w.scalpSide === "long"
                              ? "text-emerald-700 dark:text-emerald-300"
                              : "text-rose-700 dark:text-rose-300"
                          }`}
                        >
                          {w.scalpSide}
                        </span>{" "}
                        · entry {fmtUsd(w.entryPrice)}
                      </p>
                      <p className="text-muted-foreground">
                        ~{w.estHoldMinutes}m · ~{w.suggestedLeverage}x · 15m range {w.rangePct15m}%
                        {w.momentumBias !== w.scalpSide && w.momentumBias !== "neutral"
                          ? ` · momentum ${w.momentumBias}`
                          : ""}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs mt-1"
                        onClick={() =>
                          void runAgent({
                            symbol: w.symbol,
                            leverage: w.suggestedLeverage,
                            timeframeId: QUICK_WIN_SCALP_TIMEFRAME_ID,
                          })
                        }
                      >
                        Analyze on 5m
                      </Button>
                    </div>
              </div>
            ))}
          </div>
        )}
        {qwDisclaimer && <p className="text-[11px] text-muted-foreground">{qwDisclaimer}</p>}
      </div>
    </div>
  );
}
