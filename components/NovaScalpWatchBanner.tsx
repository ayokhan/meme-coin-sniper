"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  planStatusLabel,
  planStatusTone,
  type ScalpPlanStatus,
} from "@/lib/nova-scalp-plan-status";
import {
  readWatchedScalpPlan,
  SCALP_STATUS_EVENT,
  SCALP_WATCH_EVENT,
  stopWatchingScalpPlan,
} from "@/lib/nova-scalp-plan-watch";
import {
  readActiveScalpTrade,
  SCALP_ACTIVE_TRADE_EVENT,
} from "@/lib/nova-scalp-active-trade";
import type { NovaScalpAnalysis } from "@/lib/nova-scalp-agent";
import type { ScalpPlanMarket } from "@/lib/scalp-plan-market";
import { scalpPlanWatchLabel } from "@/lib/scalp-plan-market";

function toneClass(tone: ReturnType<typeof planStatusTone>): string {
  switch (tone) {
    case "good":
      return "border-emerald-400/60 bg-emerald-950/90 text-emerald-100";
    case "bad":
      return "border-rose-400/60 bg-rose-950/90 text-rose-100";
    case "warn":
      return "border-amber-400/60 bg-amber-950/90 text-amber-100";
    default:
      return "border-cyan-400/50 bg-zinc-900/95 text-zinc-100";
  }
}

export default function NovaScalpWatchBanner() {
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<ScalpPlanStatus>("active");
  const [analysis, setAnalysis] = useState<NovaScalpAnalysis | null>(null);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [market, setMarket] = useState<ScalpPlanMarket>("crypto");
  const [dismissedAt, setDismissedAt] = useState<string | null>(null);
  const [hasActiveTrade, setHasActiveTrade] = useState(false);

  useEffect(() => {
    const syncActive = () => setHasActiveTrade(!!readActiveScalpTrade());
    syncActive();
    window.addEventListener(SCALP_ACTIVE_TRADE_EVENT, syncActive);
    return () => window.removeEventListener(SCALP_ACTIVE_TRADE_EVENT, syncActive);
  }, []);

  useEffect(() => {
    const sync = () => {
      const w = readWatchedScalpPlan();
      if (!w) {
        setVisible(false);
        setAnalysis(null);
        return;
      }
      setAnalysis(w.analysis);
      setStatus(w.lastStatus);
      setLivePrice(w.lastLivePrice);
      setMarket(w.market ?? "crypto");
      if (dismissedAt === w.analysis.analyzedAt && w.lastStatus === "active") {
        setVisible(false);
        return;
      }
      setVisible(true);
    };

    const onStatus = (e: Event) => {
      const detail = (e as CustomEvent<{
        status: ScalpPlanStatus;
        analysis: NovaScalpAnalysis;
        livePrice: number | null;
      }>).detail;
      if (!detail) return;
      setAnalysis(detail.analysis);
      setStatus(detail.status);
      setLivePrice(detail.livePrice);
      // Actionable status (at entry / invalidated / target / stale): clear any
      // dismissal and surface the banner again.
      if (detail.status !== "active") {
        setDismissedAt(null);
        setVisible(true);
        return;
      }
      // Still just waiting for entry — respect the user's dismiss so the ~12s
      // price poll can't keep re-showing a banner they closed with X.
      if (dismissedAt === detail.analysis.analyzedAt) {
        setVisible(false);
        return;
      }
      setVisible(true);
    };

    sync();
    window.addEventListener(SCALP_WATCH_EVENT, sync);
    window.addEventListener(SCALP_STATUS_EVENT, onStatus);
    return () => {
      window.removeEventListener(SCALP_WATCH_EVENT, sync);
      window.removeEventListener(SCALP_STATUS_EVENT, onStatus);
    };
  }, [dismissedAt]);

  if (!visible || !analysis || analysis.side === "no_entry") return null;

  const tone = planStatusTone(status);
  const label = planStatusLabel(status, {
    side: analysis.side,
    entryPrice: analysis.entryPrice,
    stopPrice: analysis.stopLossPrice,
    entryMode: analysis.entryMode,
  });

  return (
    <div
      className={`fixed left-3 right-3 sm:left-auto sm:right-4 sm:max-w-md z-[60] rounded-xl border shadow-lg px-3 py-2.5 ${hasActiveTrade ? "bottom-44" : "bottom-20"} ${toneClass(tone)}`}
      role="status"
    >
      <div className="flex items-start gap-2">
        <Bell className="h-4 w-4 shrink-0 mt-0.5 opacity-80" aria-hidden />
        <div className="flex-1 min-w-0 text-xs">
          <p className="font-semibold">
            {scalpPlanWatchLabel(market)} · {analysis.symbol} · {analysis.timeframeLabel}
          </p>
          <p className="mt-0.5 opacity-90">{label}</p>
          {livePrice != null && (
            <p className="mt-0.5 font-mono opacity-80">
              Live ${livePrice.toLocaleString(undefined, { maximumFractionDigits: 4 })}
            </p>
          )}
          {(status === "invalidated" || status === "target_hit" || status === "stale") && (
            <div className="flex flex-wrap gap-2 mt-2">
              <Button asChild size="sm" variant="secondary" className="h-7 text-xs">
                <Link
                  href={
                    market === "forex"
                      ? "/?tab=nova-forex&forex=nova-scalp"
                      : "/?tab=nova-forecast&forecast=nova-scalp#nova-scalp-quick-wins"
                  }
                >
                  {market === "forex" ? "Open Forex Scalp" : "Find quick wins"}
                </Link>
              </Button>
            </div>
          )}
        </div>
        <button
          type="button"
          className="shrink-0 rounded p-1 opacity-70 hover:opacity-100"
          aria-label="Dismiss banner"
          onClick={() => {
            setDismissedAt(analysis.analyzedAt);
            setVisible(false);
          }}
        >
          <X className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="shrink-0 text-[10px] underline opacity-70 hover:opacity-100"
          onClick={() => {
            stopWatchingScalpPlan();
            setVisible(false);
          }}
        >
          Stop watch
        </button>
      </div>
    </div>
  );
}
