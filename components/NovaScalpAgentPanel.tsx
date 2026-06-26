"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  NOVA_SCALP_DISCLAIMER,
  QUICK_WIN_SCALP_TIMEFRAME_ID,
  SCALP_TIMEFRAMES,
  type NovaScalpAnalysis,
  type NovaScalpNearSetup,
  type NovaScalpQuickWin,
  type QuickWinScanSummary,
  type ScalpTimeframeId,
} from "@/lib/nova-scalp-agent";
import {
  formatNovaScalpAnalysisForShare,
  formatNovaScalpQuickWinForShare,
} from "@/lib/nova-scalp-agent-format";

type Props = {
  enabled: boolean;
  isVip: boolean;
  canShareCoach?: boolean;
};

function CoachShareButtons({
  canShare,
  getPayload,
  className = "",
}: {
  canShare: boolean;
  getPayload: () => { title: string; content: string };
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareOk, setShareOk] = useState(false);

  if (!canShare) return null;

  const copyAll = async () => {
    const { title, content } = getPayload();
    try {
      await navigator.clipboard.writeText([title, content].filter(Boolean).join("\n\n"));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const shareToCoachCalls = async () => {
    if (shareLoading) return;
    setShareLoading(true);
    setShareOk(false);
    const { title, content } = getPayload();
    try {
      const res = await fetch("/api/coach-calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        alert(data.error ?? "Failed to share");
        return;
      }
      setShareOk(true);
      window.setTimeout(() => setShareOk(false), 3000);
    } catch {
      alert("Failed to share");
    } finally {
      setShareLoading(false);
    }
  };

  return (
    <div className={`flex flex-wrap gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-700 ${className}`}>
      <Button type="button" variant="outline" size="sm" onClick={() => void copyAll()} className="h-8 text-xs">
          {copied ? <Check className="h-3.5 w-3.5 mr-1 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
          {copied ? "Copied!" : "Copy"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={shareLoading}
          onClick={() => void shareToCoachCalls()}
          className="h-8 text-xs border-cyan-300/80 dark:border-cyan-700 text-cyan-800 dark:text-cyan-200"
        >
          {shareOk ? <Check className="h-3.5 w-3.5 mr-1" /> : <Send className="h-3.5 w-3.5 mr-1" />}
          {shareLoading ? "Sharing…" : shareOk ? "Shared!" : "Share to Coach Calls"}
        </Button>
    </div>
  );
}

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


export default function NovaScalpAgentPanel({ enabled, isVip, canShareCoach = false }: Props) {
  const [symbol, setSymbol] = useState("BTC");
  const [amount, setAmount] = useState("100");
  const [leverage, setLeverage] = useState("50");
  const [timeframeId, setTimeframeId] = useState("5m");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<NovaScalpAnalysis | null>(null);

  const [qwTimeframeId, setQwTimeframeId] = useState<ScalpTimeframeId>(QUICK_WIN_SCALP_TIMEFRAME_ID);
  const [qwTimeframeLabel, setQwTimeframeLabel] = useState("5 mins");
  const [qwLoading, setQwLoading] = useState(false);
  const [qwError, setQwError] = useState<string | null>(null);
  const [quickWins, setQuickWins] = useState<NovaScalpQuickWin[]>([]);
  const [nearSetups, setNearSetups] = useState<NovaScalpNearSetup[]>([]);
  const [qwScanSummary, setQwScanSummary] = useState<QuickWinScanSummary | null>(null);

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

  const findQuickWins = useCallback(async (tfId = qwTimeframeId, lev = Number(leverage) || 10) => {
    setQwLoading(true);
    setQwError(null);
    try {
      const margin = Number(amount) || 100;
      const params = new URLSearchParams({
        timeframe: tfId,
        leverage: String(Math.min(125, Math.max(1, lev))),
        amountUsd: String(Math.max(1, margin)),
      });
      const res = await fetch(`/api/nova-scalp-agent/quick-wins?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setQwError(data.error ?? "Quick Wins scan failed");
        setQuickWins([]);
        setNearSetups([]);
        setQwScanSummary(null);
        return;
      }
      setQuickWins((data.quickWins as NovaScalpQuickWin[]) ?? []);
      setNearSetups((data.nearSetups as NovaScalpNearSetup[]) ?? []);
      setQwScanSummary((data.scanSummary as QuickWinScanSummary) ?? null);
      if (typeof data.timeframeLabel === "string") setQwTimeframeLabel(data.timeframeLabel);
    } catch {
      setQwError("Network error");
      setQuickWins([]);
      setNearSetups([]);
      setQwScanSummary(null);
    } finally {
      setQwLoading(false);
    }
  }, [qwTimeframeId, leverage, amount]);

  useEffect(() => {
    if (!enabled || !isVip) return;
    void findQuickWins(QUICK_WIN_SCALP_TIMEFRAME_ID, Number(leverage) || 10);
    // Initial scan only — user clicks "Find me quick wins" after changing leverage/timeframe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, isVip]);

  if (!enabled) {
    return (
      <LockedMessage
        title="Nova Scalp Agent"
        body="Nova Scalp Agent is not available on your account yet. Contact support if you need access."
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
            Leveraged scalp plan from market structure, regression trendline, and range position. Hyperliquid perps for most symbols; use XAU or XAG for Blofin metals (XAU-USDT, XAG-USDT).
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
                    {result.entryTouches != null && result.side !== "no_entry" && (
                      <p className="text-[11px] text-muted-foreground">
                        {result.entryTouches} touch{result.entryTouches === 1 ? "" : "es"} in {result.timeframeLabel}
                      </p>
                    )}
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Exit target</span>
                    <p className="font-mono font-medium">{fmtUsd(result.exitPrice)}</p>
                    {result.exitTouches != null && result.side !== "no_entry" && (
                      <p className="text-[11px] text-muted-foreground">
                        {result.exitTouches} touch{result.exitTouches === 1 ? "" : "es"} in {result.timeframeLabel}
                      </p>
                    )}
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
              {result.side === "no_entry" && timeframeId !== qwTimeframeId && (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Quick Wins is scanning on <strong>{qwTimeframeLabel}</strong>. Match that timeframe here, or pick a symbol
                  from Quick Wins and use Analyze.
                </p>
              )}
              <p className="text-[11px] text-muted-foreground">{result.disclaimer}</p>
              <CoachShareButtons
                canShare={canShareCoach}
                getPayload={() => formatNovaScalpAnalysisForShare(result)}
              />
            </CardContent>
          </Card>
        )}
      </div>

      <div className="rounded-lg border border-cyan-200/80 dark:border-cyan-900/60 bg-cyan-50/40 dark:bg-cyan-950/20 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-200">Quick Wins</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Symbols with a confirmed LONG or SHORT on your selected timeframe (same rules as Run Agent).
              {qwTimeframeLabel ? ` Showing: ${qwTimeframeLabel}.` : ""}
              {` Preview at $${Number(amount) || 100} margin · ${Number(leverage) || 10}x.`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>Leverage</span>
              <input
                type="number"
                min={1}
                max={125}
                value={leverage}
                onChange={(e) => setLeverage(e.target.value)}
                className="w-16 text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800"
              />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>Time frame</span>
              <select
                value={qwTimeframeId}
                onChange={(e) => setQwTimeframeId(e.target.value as ScalpTimeframeId)}
                className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800"
              >
                {SCALP_TIMEFRAMES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void findQuickWins(qwTimeframeId, Number(leverage) || 10)}
              disabled={qwLoading}
            >
              {qwLoading ? "Scanning…" : "Find me quick wins"}
            </Button>
          </div>
        </div>
        {qwError && <p className="text-sm text-rose-600 dark:text-rose-400">{qwError}</p>}
        {quickWins.length === 0 && !qwLoading && !qwError && (
          <div className="space-y-3 text-xs text-muted-foreground">
            <p>
              {qwScanSummary
                ? `Scanned ${qwScanSummary.symbolsScanned} Hyperliquid perps on ${qwTimeframeLabel}: ${qwScanSummary.oscillationQualified} had tight range + liquidity, but none had a confirmed LONG/SHORT entry (price mid-range or structure conflict). This is normal in chop — not a platform error.`
                : "No quick-win candidates right now."}
            </p>
            <p>
              Try <strong className="text-zinc-700 dark:text-zinc-300">15m</strong> or{" "}
              <strong className="text-zinc-700 dark:text-zinc-300">30m</strong>, or run the agent on a symbol you
              like (e.g. BTC, DOGE, SOL).
            </p>
            {nearSetups.length > 0 && (
              <div className="rounded-md border border-amber-200/70 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 p-3 space-y-2">
                <p className="font-medium text-amber-900 dark:text-amber-200">Near setup (no entry yet)</p>
                <ul className="space-y-1.5">
                  {nearSetups.map((n) => (
                    <li key={n.symbol} className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-200">{n.symbol}</span>
                        <span className="text-muted-foreground"> · score {n.quickWinScore}</span>
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() =>
                          void runAgent({
                            symbol: n.symbol,
                            leverage: Number(leverage) || 10,
                            timeframeId: qwTimeframeId,
                          })
                        }
                      >
                        Analyze
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
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
                        {w.entryTouches > 0 ? ` (${w.entryTouches} touches)` : ""}
                      </p>
                      <p className="text-muted-foreground">
                        ~{w.estHoldMinutes}m · ~{w.suggestedLeverage}x · 15m range {w.rangePct15m}%
                        {w.momentumBias !== w.scalpSide && w.momentumBias !== "neutral"
                          ? ` · momentum ${w.momentumBias}`
                          : ""}
                      </p>
                      <div className="flex flex-wrap gap-1 justify-end mt-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() =>
                            void runAgent({
                              symbol: w.symbol,
                              leverage: w.suggestedLeverage,
                              timeframeId: w.scalpTimeframeId,
                            })
                          }
                        >
                          Analyze
                        </Button>
                        {canShareCoach && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs border-cyan-300/80 dark:border-cyan-700 text-cyan-800 dark:text-cyan-200"
                            onClick={async () => {
                              const { title, content } = formatNovaScalpQuickWinForShare(w);
                              try {
                                const res = await fetch("/api/coach-calls", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ title, content }),
                                });
                                const data = (await res.json()) as { success?: boolean; error?: string };
                                if (!res.ok || !data.success) alert(data.error ?? "Failed to share");
                              } catch {
                                alert("Failed to share");
                              }
                            }}
                          >
                            <Send className="h-3 w-3 mr-0.5" />
                            Share
                          </Button>
                        )}
                      </div>
                    </div>
              </div>
            ))}
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">{NOVA_SCALP_DISCLAIMER}</p>
      </div>
    </div>
  );
}
