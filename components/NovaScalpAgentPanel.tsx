"use client";

import { useCallback, useEffect, useState } from "react";
import { Send, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NovaScalpPlanCard } from "@/components/NovaScalpPlanCard";
import { BlofinPartnerPromoBanner } from "@/components/BlofinPartnerPromoBanner";
import { NOVA_SCALPER_HANDOFF_URL, writeNovaScalperPrefill } from "@/lib/nova-scalper-prefill";
import { useScalpHandoffNav } from "@/components/useScalpHandoffNav";
import {
  clearOpenWatchedScalpPlanPending,
  findWatchedScalpPlan,
  hasOpenWatchedScalpPlanPending,
  peekOpenWatchedScalpPlanPending,
  SCALP_OPEN_WATCHED_EVENT,
} from "@/lib/nova-scalp-plan-watch";
import {
  NOVA_SCALP_DISCLAIMER,
  QUICK_WIN_SCALP_TIMEFRAME_ID,
  SCALP_TIMEFRAMES,
  resolveScalpSymbol,
  type NovaScalpAnalysis,
  type NovaScalpNearSetup,
  type NovaScalpQuickWin,
  type QuickWinScanSummary,
  type ScalpTimeframeId,
} from "@/lib/nova-scalp-agent";
import {
  formatNovaScalpQuickWinForShare,
} from "@/lib/nova-scalp-agent-format";

type Props = {
  enabled: boolean;
  isVip: boolean;
  canShareCoach?: boolean;
};

function fmtUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return "$" + n.toLocaleString(undefined, { maximumFractionDigits: 4, minimumFractionDigits: 2 });
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
  const [maxLossPct, setMaxLossPct] = useState("5");
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
  const { requestHandoff, dialog: handoffDialog } = useScalpHandoffNav();

  useEffect(() => {
    const scrollToQuickWins = () => {
      if (typeof window === "undefined" || window.location.hash !== "#nova-scalp-quick-wins") return;
      window.setTimeout(() => {
        document.getElementById("nova-scalp-quick-wins")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 300);
    };
    scrollToQuickWins();
    window.addEventListener("hashchange", scrollToQuickWins);
    return () => window.removeEventListener("hashchange", scrollToQuickWins);
  }, []);

  const restoreWatchedPlan = useCallback(() => {
    const pending = peekOpenWatchedScalpPlanPending();
    if (pending && pending.market !== "crypto") return false;
    const w = pending
      ? findWatchedScalpPlan({ symbol: pending.symbol, timeframeId: pending.timeframeId }, "crypto")
      : null;
    if (!w || (w.market ?? "crypto") !== "crypto") return false;
    const a = w.analysis;
    if (a.side === "no_entry") return false;
    setSymbol(a.symbol);
    setAmount(String(a.amountUsd));
    setLeverage(String(a.leverage));
    setMaxLossPct(String(a.maxLossPctOnMargin ?? 5));
    setTimeframeId(a.timeframeId as ScalpTimeframeId);
    setResult(a);
    setError(null);
    clearOpenWatchedScalpPlanPending();
    window.setTimeout(() => {
      document.getElementById("nova-scalp-watched-plan")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
    return true;
  }, []);

  useEffect(() => {
    if (!enabled || !isVip) return;
    const onOpen = () => {
      void restoreWatchedPlan();
    };
    window.addEventListener(SCALP_OPEN_WATCHED_EVENT, onOpen);
    if (hasOpenWatchedScalpPlanPending()) restoreWatchedPlan();
    return () => window.removeEventListener(SCALP_OPEN_WATCHED_EVENT, onOpen);
  }, [enabled, isVip, restoreWatchedPlan]);

  const runAgent = useCallback(
    async (overrides?: {
      symbol?: string;
      leverage?: number;
      timeframeId?: string;
      /** When refreshing a waiting plan, pass prior levels so mid-range rescans don't wipe to NO ENTRY. */
      reconfirmPrior?: boolean;
    }) => {
    const sym = (overrides?.symbol ?? symbol).trim();
    const lev = overrides?.leverage ?? (Number(leverage) || 10);
    const tf = overrides?.timeframeId ?? timeframeId;
    if (overrides?.symbol) setSymbol(overrides.symbol);
    if (overrides?.leverage != null) setLeverage(String(overrides.leverage));
    if (overrides?.timeframeId) setTimeframeId(overrides.timeframeId);
    setLoading(true);
    setError(null);
    try {
      const prior = result;
      const useReconfirm =
        overrides?.reconfirmPrior !== false &&
        prior &&
        (prior.side === "long" || prior.side === "short") &&
        prior.entryPrice != null &&
        prior.exitPrice != null &&
        prior.stopLossPrice != null &&
        prior.symbol.toUpperCase() === resolveScalpSymbol(sym) &&
        prior.timeframeId === tf;

      const res = await fetch("/api/nova-scalp-agent/analyze", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: sym,
          amountUsd: Number(amount) || 100,
          leverage: lev,
          timeframeId: tf,
          maxLossPctOnMargin: Number(maxLossPct) || 5,
          ...(useReconfirm
            ? {
                reconfirm: {
                  side: prior!.side,
                  entryPrice: prior!.entryPrice,
                  exitPrice: prior!.exitPrice,
                  stopLossPrice: prior!.stopLossPrice,
                  analyzedAt: prior!.analyzedAt,
                  entryMode: prior!.entryMode,
                },
              }
            : {}),
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
    [symbol, amount, leverage, maxLossPct, timeframeId, result]
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
    <>
    {handoffDialog}
    <div className="space-y-6">
      <BlofinPartnerPromoBanner compact />
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">Nova Scalp Agent</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Leveraged scalp plan from market structure, regression trendline, and range position. Prices and candles
            use <strong className="font-medium text-zinc-800 dark:text-zinc-200">Blofin USDT perps</strong> (e.g.
            INJUSDT) so levels match Blofin Trade. XAU / XAG use Blofin metals candles with spot mid calibration.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
            <span className="text-xs text-muted-foreground">Max loss (% margin)</span>
            <input
              type="number"
              min={0.5}
              max={100}
              step={0.5}
              value={maxLossPct}
              onChange={(e) => setMaxLossPct(e.target.value)}
              className="w-full text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-2 bg-white dark:bg-zinc-800"
              title="Used for optional risk stop alongside structural invalidation"
            />
          </label>
          <label className="space-y-1 sm:col-span-2 lg:col-span-1">
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
          <div id="nova-scalp-watched-plan" className="space-y-2 scroll-mt-24">
            <NovaScalpPlanCard
              result={result}
              onRefresh={() => void runAgent()}
              refreshing={loading}
              canShareCoach={canShareCoach}
            />
            {result.side === "no_entry" && timeframeId !== qwTimeframeId && (
              <p className="text-xs text-slate-600 dark:text-slate-300 px-1">
                Quick Wins is scanning on <strong>{qwTimeframeLabel}</strong>. Match that timeframe here, or pick a
                symbol from Quick Wins and use Analyze.
              </p>
            )}
          </div>
        )}
      </div>

      <div
        id="nova-scalp-quick-wins"
        className="rounded-lg border border-cyan-200/80 dark:border-cyan-900/60 bg-cyan-50/40 dark:bg-cyan-950/20 p-4 space-y-3"
      >
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
                ? `Scanned ${qwScanSummary.symbolsScanned} Blofin USDT perps on ${qwTimeframeLabel}: ${qwScanSummary.oscillationQualified} had tight range + liquidity, but none had a confirmed LONG/SHORT entry (price mid-range or structure conflict). This is normal in chop — not a platform error.`
                : "No quick-win candidates right now."}
            </p>
            <p>
              Try <strong className="text-zinc-700 dark:text-zinc-300">15m</strong> or{" "}
              <strong className="text-zinc-700 dark:text-zinc-300">30m</strong>, or run the agent on a symbol you
              like (e.g. BTC, DOGE, SOL).
            </p>
            {nearSetups.length > 0 && (
              <div className="rounded-md border border-slate-200/80 dark:border-slate-700/60 bg-slate-50/80 dark:bg-slate-900/50 p-3 space-y-2">
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
                        <Button
                          type="button"
                          size="sm"
                          className="h-7 text-xs bg-cyan-600 hover:bg-cyan-700 text-white"
                          title="Send these levels to NovaScalper (Crypto Futures) to place the trade"
                          onClick={() =>
                            requestHandoff({
                              label: "NovaScalper",
                              url: NOVA_SCALPER_HANDOFF_URL,
                              prepare: () =>
                                writeNovaScalperPrefill({
                                  symbol: w.symbol,
                                  side: w.scalpSide,
                                  entryPrice: w.entryPrice,
                                  exitPrice: w.exitPrice,
                                  stopLossPrice: Number.isFinite(w.stopLossPrice) ? w.stopLossPrice : null,
                                  leverage: w.suggestedLeverage,
                                  marginUsd: Number(amount) || 100,
                                  source: "Quick Win",
                                  createdAt: new Date().toISOString(),
                                }),
                            })
                          }
                        >
                          <Zap className="h-3 w-3 mr-0.5" />
                          Scalp
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
    </>
  );
}
