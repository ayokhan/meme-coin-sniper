"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, BellOff, Check, Copy, RefreshCw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { NovaScalpAnalysis } from "@/lib/nova-scalp-agent";
import { formatNovaScalpAnalysisForShare } from "@/lib/nova-scalp-agent-format";
import {
  markScalpPlanFeedbackSent,
  readScalpPlanEntry,
  scalpPlanKey,
  SCALP_ENTRY_EVENT,
  setScalpPlanEntryChoice,
  type ScalpPlanEntryRecord,
} from "@/lib/nova-scalp-plan-entry";
import { fetchScalpLivePrice, SCALP_LIVE_PRICE_MS } from "@/lib/nova-scalp-plan-price";
import {
  formatAnalyzedAtLocal,
  formatDistanceLabel,
  formatPlanAge,
  planStatusFromAnalysis,
  planStatusHint,
  planStatusLabel,
  planStatusTone,
} from "@/lib/nova-scalp-plan-status";
import {
  isWatchingScalpPlan,
  SCALP_WATCH_EVENT,
  startWatchingScalpPlan,
  stopWatchingScalpPlan,
  updateWatchedScalpPlan,
} from "@/lib/nova-scalp-plan-watch";

type BlofinPositionSummary = {
  symbol: string;
  side: "long" | "short";
  entryPrice: number | null;
  markPrice: number | null;
  leverage: number | null;
  unrealizedPnl: number | null;
  hasExchangeStopLoss: boolean;
  exchangeStopLossPrice: number | null;
  label: string;
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

function statusBadgeClass(tone: ReturnType<typeof planStatusTone>): string {
  switch (tone) {
    case "good":
      return "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border-emerald-300/60 dark:border-emerald-800";
    case "bad":
      return "bg-rose-500/15 text-rose-800 dark:text-rose-200 border-rose-300/60 dark:border-rose-800";
    case "warn":
      return "bg-amber-500/15 text-amber-900 dark:text-amber-200 border-amber-300/60 dark:border-amber-800";
    default:
      return "bg-cyan-500/10 text-cyan-900 dark:text-cyan-200 border-cyan-300/50 dark:border-cyan-800";
  }
}

function CoachShareFooter({
  canShare,
  getPayload,
}: {
  canShare: boolean;
  getPayload: () => { title: string; content: string };
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
    <div className="flex flex-wrap gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-700">
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

type Props = {
  result: NovaScalpAnalysis;
  onRefresh: () => void;
  refreshing: boolean;
  canShareCoach?: boolean;
  shareFooter?: React.ReactNode;
};

export function NovaScalpPlanCard({
  result,
  onRefresh,
  refreshing,
  canShareCoach = false,
  shareFooter,
}: Props) {
  const [livePrice, setLivePrice] = useState<number | null>(result.currentPrice);
  const [priceError, setPriceError] = useState(false);
  const [watching, setWatching] = useState(false);
  const [entryRecord, setEntryRecord] = useState<ScalpPlanEntryRecord | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [blofinPosition, setBlofinPosition] = useState<BlofinPositionSummary | null>(null);
  const [blofinConfigured, setBlofinConfigured] = useState<boolean | null>(null);
  const [, tick] = useState(0);

  const planKey = scalpPlanKey(result);

  useEffect(() => {
    setLivePrice(result.currentPrice);
    setEntryRecord(readScalpPlanEntry(planKey));
  }, [result, planKey]);

  useEffect(() => {
    const sync = () => setEntryRecord(readScalpPlanEntry(planKey));
    sync();
    window.addEventListener(SCALP_ENTRY_EVENT, sync);
    return () => window.removeEventListener(SCALP_ENTRY_EVENT, sync);
  }, [planKey]);

  useEffect(() => {
    const sync = () => setWatching(isWatchingScalpPlan(result));
    sync();
    window.addEventListener(SCALP_WATCH_EVENT, sync);
    return () => window.removeEventListener(SCALP_WATCH_EVENT, sync);
  }, [result]);

  useEffect(() => {
    if (result.side === "no_entry") return;

    let cancelled = false;

    const fetchPrice = async () => {
      try {
        const price = await fetchScalpLivePrice(result.symbol);
        if (cancelled) return;
        if (price != null) {
          setLivePrice(price);
          setPriceError(false);
        } else {
          setPriceError(true);
        }
      } catch {
        if (!cancelled) setPriceError(true);
      }
    };

    void fetchPrice();
    const id = window.setInterval(() => {
      void fetchPrice();
      tick((n) => n + 1);
    }, SCALP_LIVE_PRICE_MS);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [result.symbol, result.side]);

  useEffect(() => {
    if (result.side === "no_entry") return;
    let cancelled = false;

    const loadBlofin = async () => {
      try {
        const res = await fetch(
          `/api/nova-scalp-agent/blofin-position?symbol=${encodeURIComponent(result.symbol)}&side=${result.side}`,
          { credentials: "include", cache: "no-store" }
        );
        const data = (await res.json()) as {
          success?: boolean;
          configured?: boolean;
          position?: BlofinPositionSummary | null;
        };
        if (cancelled || !data.success) return;
        setBlofinConfigured(data.configured ?? false);
        setBlofinPosition(data.position ?? null);
      } catch {
        if (!cancelled) setBlofinConfigured(null);
      }
    };

    void loadBlofin();
    const id = window.setInterval(() => void loadBlofin(), SCALP_LIVE_PRICE_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [result.symbol, result.side]);

  const submitFeedback = async (payload: {
    entered: boolean;
    outcome: "win" | "loss" | "scratch" | "skipped";
  }) => {
    if (feedbackLoading) return;
    setFeedbackLoading(true);
    try {
      const res = await fetch("/api/nova-scalp-agent/feedback", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: result.symbol,
          timeframeId: result.timeframeId,
          side: result.side,
          entered: payload.entered,
          outcome: payload.outcome,
          entryPrice: result.entryPrice,
          exitPrice: result.exitPrice,
          stopLossPrice: result.stopLossPrice,
          amountUsd: result.amountUsd,
          leverage: result.leverage,
          analyzedAt: result.analyzedAt,
        }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        alert(data.error ?? "Failed to save feedback");
        return;
      }
      markScalpPlanFeedbackSent(planKey);
      setEntryRecord(readScalpPlanEntry(planKey));
    } catch {
      alert("Failed to save feedback");
    } finally {
      setFeedbackLoading(false);
    }
  };

  const planStatus =
    result.side === "no_entry" ? ("no_entry" as const) : planStatusFromAnalysis(result, livePrice);
  const statusCtx = {
    side: result.side === "long" || result.side === "short" ? result.side : undefined,
    entryPrice: result.entryPrice,
    stopPrice: result.stopLossPrice,
    entryMode: result.entryMode,
    livePrice,
  };
  const statusTone = planStatusTone(planStatus);
  const showPlanMonitor = result.side === "long" || result.side === "short";
  const planInvalidated =
    planStatus === "invalidated" || planStatus === "target_hit" || planStatus === "stale";
  const statusLabel = planStatusLabel(planStatus, statusCtx);
  const statusHint = planStatusHint(planStatus, statusCtx);

  useEffect(() => {
    if (!watching || result.side === "no_entry") return;
    updateWatchedScalpPlan({
      analysis: result,
      lastStatus: planStatus,
      lastLivePrice: livePrice,
      statusUpdatedAt: new Date().toISOString(),
    });
  }, [watching, result, planStatus, livePrice]);

  const toggleWatch = async () => {
    if (watching) {
      stopWatchingScalpPlan();
      return;
    }
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      try {
        await Notification.requestPermission();
      } catch {
        /* ignore */
      }
    }
    startWatchingScalpPlan(result, planStatus);
  };

  const getSharePayload = () =>
    formatNovaScalpAnalysisForShare(result, {
      planStatusLabel: statusLabel,
      livePrice,
      statusUpdatedAt: new Date().toISOString(),
    });

  return (
    <Card
      className={`border-violet-300/50 dark:border-violet-800/50 ${
        planStatus === "invalidated" || planStatus === "target_hit" ? "opacity-80" : ""
      }`}
    >
      <CardHeader className="pb-2 space-y-2">
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <CardTitle className="text-base font-mono">
            {result.symbol} · {result.timeframeLabel}
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            {sideBadge(result.side)}
            {showPlanMonitor && (
              <Button
                type="button"
                variant={watching ? "secondary" : "outline"}
                size="sm"
                className="h-8 text-xs"
                onClick={() => void toggleWatch()}
              >
                {watching ? (
                  <BellOff className="h-3.5 w-3.5 mr-1" />
                ) : (
                  <Bell className="h-3.5 w-3.5 mr-1" />
                )}
                {watching ? "Stop watching" : "Watch plan"}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              disabled={refreshing}
              onClick={onRefresh}
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Refreshing…" : "Refresh plan"}
            </Button>
          </div>
        </div>
        {result.analyzedAt && (
          <p className="text-[11px] text-muted-foreground">
            Generated {formatAnalyzedAtLocal(result.analyzedAt)}
            {formatPlanAge(result.analyzedAt) ? ` · ${formatPlanAge(result.analyzedAt)}` : ""}
          </p>
        )}
        {showPlanMonitor && (
          <div
            className={`rounded-md border px-2.5 py-1.5 text-xs font-medium ${statusBadgeClass(statusTone)}`}
          >
            {statusLabel}
            {livePrice != null && (
              <span className="font-normal text-muted-foreground ml-1">
                · Live {fmtUsd(livePrice)}
                {priceError ? " (delayed)" : ""}
              </span>
            )}
          </div>
        )}
        {showPlanMonitor && statusHint && (
          <p className="text-[11px] text-muted-foreground leading-relaxed">{statusHint}</p>
        )}
        {showPlanMonitor && planStatus !== "invalidated" && (
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            <strong>Invalidated</strong> only appears if live price hits{" "}
            <strong>Stop (invalidation)</strong> before you enter. Until then you are{" "}
            {result.entryMode === "limit" ? "waiting for the limit entry price" : "watching for entry"}.
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <span className="text-muted-foreground text-xs">
              {result.entryMode === "limit" ? "Limit entry" : "Entry"}
            </span>
            <p className="font-mono font-medium">{fmtUsd(result.entryPrice)}</p>
            {result.entryMode === "market" && result.enterNowPrice != null && (
              <p className="text-[11px] text-emerald-700 dark:text-emerald-300">Enter now</p>
            )}
            {result.entryMode === "limit" && result.enterNowPrice != null && (
              <p className="text-[11px] text-muted-foreground">
                Now {fmtUsd(result.enterNowPrice)}
              </p>
            )}
            {result.entryTouches != null && result.side !== "no_entry" && (
              <p className="text-[11px] text-muted-foreground">
                {result.entryTouches} touch{result.entryTouches === 1 ? "" : "es"} in {result.timeframeLabel}
              </p>
            )}
            {showPlanMonitor && livePrice != null && result.entryPrice != null && (
              <p className="text-[11px] text-cyan-700 dark:text-cyan-300">
                {formatDistanceLabel(livePrice, result.entryPrice, result.side as "long" | "short", "entry")}
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
            {showPlanMonitor && livePrice != null && result.exitPrice != null && (
              <p className="text-[11px] text-cyan-700 dark:text-cyan-300">
                {formatDistanceLabel(livePrice, result.exitPrice, result.side as "long" | "short", "exit")}
              </p>
            )}
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Stop (invalidation)</span>
            <p className="font-mono font-medium text-amber-700 dark:text-amber-300">
              {fmtUsd(result.stopLossPrice)}
            </p>
            {showPlanMonitor && livePrice != null && result.stopLossPrice != null && (
              <p className="text-[11px] text-amber-700/90 dark:text-amber-300/90">
                {formatDistanceLabel(livePrice, result.stopLossPrice, result.side as "long" | "short", "stop")}
              </p>
            )}
          </div>
          {result.riskStopLossPrice != null && result.side !== "no_entry" && (
            <div>
              <span className="text-muted-foreground text-xs">
                Risk stop ({result.maxLossPctOnMargin}% margin)
              </span>
              <p className="font-mono font-medium">{fmtUsd(result.riskStopLossPrice)}</p>
            </div>
          )}
          {result.recommendedStopPrice != null &&
            result.recommendedStopPrice !== result.stopLossPrice &&
            result.side !== "no_entry" && (
              <div>
                <span className="text-muted-foreground text-xs">Suggested stop (tighter)</span>
                <p className="font-mono font-medium">{fmtUsd(result.recommendedStopPrice)}</p>
              </div>
            )}
          <div>
            <span className="text-muted-foreground text-xs">Live price</span>
            <p className="font-mono">{fmtUsd(livePrice)}</p>
            {result.enterNowPrice != null && result.enterNowPrice !== livePrice && (
              <p className="text-[11px] text-muted-foreground">At run: {fmtUsd(result.enterNowPrice)}</p>
            )}
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
            <p className="text-[11px] text-muted-foreground mt-0.5">If target hit at entry</p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Loss if stopped</span>
            <p className="font-mono font-medium text-rose-600 dark:text-rose-400">
              {result.lossAtStopUsd != null
                ? `-$${Math.abs(result.lossAtStopUsd).toLocaleString()} (${Math.abs(result.lossAtStopPctOnMargin ?? 0).toFixed(1)}% on margin)`
                : "—"}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              At stop (invalidation) · ${result.amountUsd} margin · {result.leverage}x
            </p>
            {result.lossAtRiskStopUsd != null &&
              result.lossAtRiskStopUsd !== result.lossAtStopUsd && (
                <p className="text-[11px] text-amber-700 dark:text-amber-300">
                  Risk cap: -${Math.abs(result.lossAtRiskStopUsd).toLocaleString()} (
                  {Math.abs(result.lossAtRiskStopPctOnMargin ?? 0).toFixed(1)}%)
                </p>
              )}
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Est. hold time</span>
            <p className="font-mono">
              {result.estimatedHoldMinutes != null ? `~${result.estimatedHoldMinutes} min` : "—"}
            </p>
          </div>
        </div>
        {showPlanMonitor && blofinConfigured === true && blofinPosition && (
          <div className="rounded-md border border-orange-300/50 dark:border-orange-800/60 bg-orange-50/50 dark:bg-orange-950/20 px-3 py-2 text-xs">
            <p className="font-medium text-orange-900 dark:text-orange-200">Blofin live position</p>
            <p className="mt-0.5 font-mono text-orange-800 dark:text-orange-100">{blofinPosition.label}</p>
            {blofinPosition.unrealizedPnl != null && (
              <p
                className={`mt-0.5 font-mono ${
                  blofinPosition.unrealizedPnl >= 0
                    ? "text-emerald-700 dark:text-emerald-300"
                    : "text-rose-700 dark:text-rose-300"
                }`}
              >
                uPnL {blofinPosition.unrealizedPnl >= 0 ? "+" : ""}$
                {blofinPosition.unrealizedPnl.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </p>
            )}
            {!blofinPosition.hasExchangeStopLoss && (
              <p className="mt-1 text-amber-800 dark:text-amber-200">No exchange stop loss set on Blofin.</p>
            )}
          </div>
        )}
        {showPlanMonitor && blofinConfigured === false && (
          <p className="text-[11px] text-muted-foreground">
            Add Blofin API keys in Trading Bot settings to see your live position here.
          </p>
        )}
        {showPlanMonitor && (
          <div className="rounded-md border border-zinc-200/80 dark:border-zinc-700/80 px-3 py-2.5 space-y-2">
            <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200">Your trade</p>
            {!entryRecord ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Did you enter this plan?</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={feedbackLoading}
                  onClick={() => {
                    setScalpPlanEntryChoice(result, "entered");
                    setEntryRecord(readScalpPlanEntry(planKey));
                  }}
                >
                  I entered
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={feedbackLoading}
                  onClick={() => {
                    setScalpPlanEntryChoice(result, "skipped");
                    void submitFeedback({ entered: false, outcome: "skipped" });
                  }}
                >
                  Skipped
                </Button>
              </div>
            ) : entryRecord.choice === "entered" && !entryRecord.feedbackSent ? (
              <div className="space-y-2">
                <p className="text-xs text-emerald-700 dark:text-emerald-300">Marked as entered.</p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">How did it go?</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs border-emerald-300 dark:border-emerald-800"
                    disabled={feedbackLoading}
                    onClick={() => void submitFeedback({ entered: true, outcome: "win" })}
                  >
                    Win
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs border-rose-300 dark:border-rose-800"
                    disabled={feedbackLoading}
                    onClick={() => void submitFeedback({ entered: true, outcome: "loss" })}
                  >
                    Loss
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={feedbackLoading}
                    onClick={() => void submitFeedback({ entered: true, outcome: "scratch" })}
                  >
                    Scratch
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                {entryRecord.choice === "skipped"
                  ? "Marked as skipped — thanks."
                  : "Thanks — feedback saved."}
              </p>
            )}
          </div>
        )}
        <p className="text-xs text-muted-foreground leading-relaxed">{result.rationale}</p>
        {planInvalidated && (
          <div className="space-y-2">
            <p className="text-xs text-rose-700 dark:text-rose-300 font-medium">
              {planStatus === "invalidated"
                ? "This plan is invalidated — price hit the structural stop before entry."
                : planStatus === "target_hit"
                  ? "Target was hit before you entered — run a fresh scan."
                  : "This plan is stale — refresh for updated levels."}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                disabled={refreshing}
                onClick={onRefresh}
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1 ${refreshing ? "animate-spin" : ""}`} />
                Refresh plan
              </Button>
              <Button asChild variant="secondary" size="sm" className="h-8 text-xs">
                <Link href="/?tab=nova-forecast&forecast=nova-scalp#nova-scalp-quick-wins">
                  Find quick wins
                </Link>
              </Button>
            </div>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">{result.disclaimer}</p>
        {shareFooter ?? (
          <CoachShareFooter canShare={canShareCoach} getPayload={getSharePayload} />
        )}
      </CardContent>
    </Card>
  );
}
