"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { estimateScalpPnl } from "@/lib/nova-scalp-agent";
import {
  endActiveScalpTrade,
  markActiveScalpTradeFeedbackSent,
  readActiveScalpTrade,
  SCALP_ACTIVE_TRADE_EVENT,
  type ScalpActiveTrade,
} from "@/lib/nova-scalp-active-trade";
import { fetchScalpLivePrice, SCALP_LIVE_PRICE_MS } from "@/lib/nova-scalp-plan-price";
import {
  activeTradeHitLabel,
  computeActiveTradeHit,
  formatAnalyzedAtLocal,
} from "@/lib/nova-scalp-plan-status";
import { scalpPlanFeedbackApi, scalpPlanWatchLabel } from "@/lib/scalp-plan-market";

function fmtUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return "$" + n.toLocaleString(undefined, { maximumFractionDigits: 4, minimumFractionDigits: 2 });
}

function scalpTabHref(market: ScalpActiveTrade["market"]): string {
  return market === "forex"
    ? "/?tab=nova-forex&forex=nova-scalp"
    : "/?tab=nova-forecast&forecast=nova-scalp";
}

export default function NovaScalpActiveTradeBar() {
  const [trade, setTrade] = useState<ScalpActiveTrade | null>(null);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [hitNotified, setHitNotified] = useState<"target_hit" | "stop_hit" | null>(null);

  useEffect(() => {
    const sync = () => {
      setTrade(readActiveScalpTrade());
      setHitNotified(null);
    };
    sync();
    window.addEventListener(SCALP_ACTIVE_TRADE_EVENT, sync);
    return () => window.removeEventListener(SCALP_ACTIVE_TRADE_EVENT, sync);
  }, []);

  useEffect(() => {
    if (!trade) {
      setLivePrice(null);
      return;
    }

    let cancelled = false;
    const load = async () => {
      const price = await fetchScalpLivePrice(trade.symbol, trade.market);
      if (!cancelled) setLivePrice(price);
    };

    void load();
    const id = window.setInterval(() => void load(), SCALP_LIVE_PRICE_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [trade?.symbol, trade?.market, trade?.enteredAt]);

  const tradeHit =
    trade
      ? computeActiveTradeHit({
          side: trade.side,
          livePrice,
          exitPrice: trade.exitPrice,
          stopLossPrice: trade.stopLossPrice,
        })
      : null;

  useEffect(() => {
    if (!trade || !tradeHit || hitNotified === tradeHit) return;
    setHitNotified(tradeHit);
    setExpanded(true);
    const title = tradeHit === "target_hit" ? "Take profit reached" : "Stop loss hit";
    const body = activeTradeHitLabel(tradeHit, {
      exitPrice: trade.exitPrice,
      stopLossPrice: trade.stopLossPrice,
    });
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification(`${title} · ${trade.symbol}`, {
          body,
          tag: `scalp-active-${trade.symbol}-${trade.enteredAt}-${tradeHit}`,
        });
      } else if (typeof Notification !== "undefined" && Notification.permission === "default") {
        void Notification.requestPermission().then((p) => {
          if (p === "granted") {
            new Notification(`${title} · ${trade.symbol}`, {
              body,
              tag: `scalp-active-${trade.symbol}-${trade.enteredAt}-${tradeHit}`,
            });
          }
        });
      }
    } catch {
      /* ignore notification errors */
    }
  }, [trade, tradeHit, hitNotified]);

  if (!trade) return null;

  const livePnl =
    livePrice != null
      ? estimateScalpPnl(
          trade.side,
          trade.filledEntryPrice,
          livePrice,
          trade.amountUsd,
          trade.leverage
        )
      : null;
  const atTarget =
    trade.exitPrice != null
      ? estimateScalpPnl(
          trade.side,
          trade.filledEntryPrice,
          trade.exitPrice,
          trade.amountUsd,
          trade.leverage
        )
      : null;
  const atStop =
    trade.stopLossPrice != null
      ? estimateScalpPnl(
          trade.side,
          trade.filledEntryPrice,
          trade.stopLossPrice,
          trade.amountUsd,
          trade.leverage
        )
      : null;

  const submitFeedback = async (outcome: "win" | "loss" | "scratch") => {
    if (feedbackLoading) return;
    setFeedbackLoading(true);
    try {
      const res = await fetch(scalpPlanFeedbackApi(trade.market), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: trade.symbol,
          timeframeId: trade.timeframeId,
          side: trade.side,
          entered: true,
          outcome,
          entryPrice: trade.filledEntryPrice,
          exitPrice: trade.exitPrice,
          stopLossPrice: trade.stopLossPrice,
          amountUsd: trade.amountUsd,
          leverage: trade.leverage,
          analyzedAt: trade.planAnalyzedAt,
        }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        alert(data.error ?? "Failed to save feedback");
        return;
      }
      markActiveScalpTradeFeedbackSent();
      setTrade(null);
    } catch {
      alert("Failed to save feedback");
    } finally {
      setFeedbackLoading(false);
    }
  };

  return (
    <div
      className={`fixed bottom-20 left-3 right-3 sm:left-auto sm:right-4 sm:max-w-lg z-[65] rounded-xl border shadow-xl ${
        tradeHit === "target_hit"
          ? "border-emerald-400/70 bg-emerald-950/95 text-zinc-100"
          : tradeHit === "stop_hit"
            ? "border-rose-400/70 bg-rose-950/95 text-zinc-100"
            : "border-emerald-400/50 bg-zinc-900/95 text-zinc-100"
      }`}
      role="status"
    >
      {tradeHit && (
        <div
          className={`px-3 py-2 text-xs font-semibold border-b ${
            tradeHit === "target_hit"
              ? "bg-emerald-500/20 text-emerald-200 border-emerald-500/30"
              : "bg-rose-500/20 text-rose-200 border-rose-500/30"
          }`}
        >
          {activeTradeHitLabel(tradeHit, {
            exitPrice: trade.exitPrice,
            stopLossPrice: trade.stopLossPrice,
          })}
        </div>
      )}
      <div className="flex items-start gap-2 px-3 py-2.5">
        {trade.side === "long" ? (
          <TrendingUp className="h-4 w-4 shrink-0 mt-0.5 text-emerald-400" aria-hidden />
        ) : (
          <TrendingDown className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" aria-hidden />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <p className="text-xs font-semibold">
              Active trade · {scalpPlanWatchLabel(trade.market)}
            </p>
            <span
              className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                trade.side === "long"
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "bg-rose-500/20 text-rose-300"
              }`}
            >
              {trade.side}
            </span>
          </div>
          <p className="text-xs mt-0.5 font-mono">
            {trade.symbol} · {trade.timeframeLabel} · entry {fmtUsd(trade.filledEntryPrice)}
          </p>
          {livePnl != null && (
            <p
              className={`text-sm font-mono font-semibold mt-1 ${
                livePnl.pnlUsd >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {livePnl.pnlUsd >= 0 ? "+" : "-"}$
              {Math.abs(livePnl.pnlUsd).toLocaleString(undefined, {
                maximumFractionDigits: 2,
                minimumFractionDigits: 2,
              })}{" "}
              ({livePnl.pnlPctMargin >= 0 ? "+" : ""}
              {livePnl.pnlPctMargin.toFixed(1)}% on ${trade.amountUsd} · {trade.leverage}x)
            </p>
          )}
          {livePrice != null && (
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Live {fmtUsd(livePrice)} · updates ~12s
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <button
            type="button"
            className="rounded p-1 opacity-70 hover:opacity-100"
            aria-label={expanded ? "Collapse" : "Expand"}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
          <button
            type="button"
            className="text-[10px] underline opacity-70 hover:opacity-100"
            onClick={() => {
              if (window.confirm("Stop tracking this trade without saving feedback?")) {
                endActiveScalpTrade();
                setTrade(null);
              }
            }}
          >
            End
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-zinc-700/80 px-3 py-2.5 space-y-2">
          <p className="text-[11px] text-zinc-400">
            Levels from plan {formatAnalyzedAtLocal(trade.planAnalyzedAt)} — browse other symbols
            freely; this bar stays pinned.
          </p>
          {(atTarget != null || atStop != null) && (
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              {atTarget != null && (
                <>
                  At target {fmtUsd(trade.exitPrice)}:{" "}
                  <span className="text-emerald-400">
                    {atTarget.pnlUsd >= 0 ? "+" : ""}$
                    {atTarget.pnlUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                </>
              )}
              {atTarget != null && atStop != null ? " · " : ""}
              {atStop != null && (
                <>
                  At stop {fmtUsd(trade.stopLossPrice)}:{" "}
                  <span className="text-rose-400">
                    -$
                    {Math.abs(atStop.pnlUsd).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                </>
              )}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-zinc-400">
              {tradeHit === "target_hit"
                ? "Close it out (suggested: Win):"
                : tradeHit === "stop_hit"
                  ? "Close it out (suggested: Loss):"
                  : "Close it out:"}
            </span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className={`h-7 text-xs ${tradeHit === "target_hit" ? "ring-2 ring-emerald-400" : ""}`}
              disabled={feedbackLoading}
              onClick={() => void submitFeedback("win")}
            >
              Win
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className={`h-7 text-xs ${tradeHit === "stop_hit" ? "ring-2 ring-rose-400" : ""}`}
              disabled={feedbackLoading}
              onClick={() => void submitFeedback("loss")}
            >
              Loss
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-7 text-xs"
              disabled={feedbackLoading}
              onClick={() => void submitFeedback("scratch")}
            >
              Scratch
            </Button>
            <Button asChild variant="outline" size="sm" className="h-7 text-xs ml-auto">
              <Link href={scalpTabHref(trade.market)}>Open scalp tab</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
