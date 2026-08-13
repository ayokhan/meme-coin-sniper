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
  readWatchedScalpPlans,
  requestOpenWatchedScalpPlan,
  SCALP_STATUS_EVENT,
  SCALP_WATCH_EVENT,
  SCALP_WATCH_MAX,
  stopWatchingScalpPlan,
  watchPlanKey,
  type WatchedScalpPlan,
} from "@/lib/nova-scalp-plan-watch";
import {
  readActiveScalpTrade,
  SCALP_ACTIVE_TRADE_EVENT,
} from "@/lib/nova-scalp-active-trade";
import type { NovaScalpAnalysis } from "@/lib/nova-scalp-agent";
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

function sortPlans(plans: WatchedScalpPlan[]): WatchedScalpPlan[] {
  const rank = (s: ScalpPlanStatus) => {
    if (s === "at_entry") return 0;
    if (s === "invalidated" || s === "target_hit" || s === "missed") return 1;
    if (s === "stale") return 2;
    return 3;
  };
  return [...plans].sort((a, b) => {
    const rd = rank(a.lastStatus) - rank(b.lastStatus);
    if (rd !== 0) return rd;
    return (Date.parse(b.watchedAt) || 0) - (Date.parse(a.watchedAt) || 0);
  });
}

export default function NovaScalpWatchBanner() {
  const [plans, setPlans] = useState<WatchedScalpPlan[]>([]);
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState(false);
  const [hasActiveTrade, setHasActiveTrade] = useState(false);

  useEffect(() => {
    const syncActive = () => setHasActiveTrade(!!readActiveScalpTrade());
    syncActive();
    window.addEventListener(SCALP_ACTIVE_TRADE_EVENT, syncActive);
    return () => window.removeEventListener(SCALP_ACTIVE_TRADE_EVENT, syncActive);
  }, []);

  useEffect(() => {
    const sync = () => {
      setPlans(sortPlans(readWatchedScalpPlans().filter((p) => p.analysis.side !== "no_entry")));
    };

    const onStatus = (e: Event) => {
      const detail = (e as CustomEvent<{
        status: ScalpPlanStatus;
        analysis: NovaScalpAnalysis;
        livePrice: number | null;
        market?: "crypto" | "forex";
      }>).detail;
      if (!detail?.analysis) return;
      const market = detail.market ?? "crypto";
      const key = watchPlanKey(detail.analysis, market);
      if (detail.status !== "active") {
        setDismissedKeys((prev) => {
          if (!prev.has(key)) return prev;
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
        setCollapsed(false);
      }
      sync();
    };

    sync();
    window.addEventListener(SCALP_WATCH_EVENT, sync);
    window.addEventListener(SCALP_STATUS_EVENT, onStatus);
    return () => {
      window.removeEventListener(SCALP_WATCH_EVENT, sync);
      window.removeEventListener(SCALP_STATUS_EVENT, onStatus);
    };
  }, []);

  if (plans.length === 0) return null;

  const visiblePlans = plans.filter((p) => {
    const key = watchPlanKey(p.analysis, p.market ?? "crypto");
    if (dismissedKeys.has(key) && p.lastStatus === "active") return false;
    return true;
  });

  if (visiblePlans.length === 0 && collapsed) {
    return (
      <div
        className={`fixed right-4 z-[60] rounded-xl border border-cyan-400/50 bg-zinc-900/95 text-zinc-100 shadow-lg px-3 py-2 ${hasActiveTrade ? "bottom-44" : "bottom-20"}`}
      >
        <button
          type="button"
          className="text-xs font-medium inline-flex items-center gap-1.5"
          onClick={() => {
            setDismissedKeys(new Set());
            setCollapsed(false);
          }}
        >
          <Bell className="h-3.5 w-3.5" />
          Watching {plans.length}/{SCALP_WATCH_MAX} — show
        </button>
      </div>
    );
  }

  if (visiblePlans.length === 0) return null;

  const headlineTone = planStatusTone(visiblePlans[0]!.lastStatus);

  return (
    <div
      className={`fixed left-3 right-3 sm:left-auto sm:right-4 sm:max-w-md z-[60] rounded-xl border shadow-lg px-3 py-2.5 space-y-2 ${hasActiveTrade ? "bottom-44" : "bottom-20"} ${toneClass(headlineTone)}`}
      role="status"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide opacity-90 inline-flex items-center gap-1.5">
          <Bell className="h-3.5 w-3.5" aria-hidden />
          Watching {plans.length}/{SCALP_WATCH_MAX}
        </p>
        <button
          type="button"
          className="shrink-0 rounded p-1 opacity-70 hover:opacity-100"
          aria-label="Collapse watch list"
          onClick={() => {
            setCollapsed(true);
            setDismissedKeys(new Set(plans.map((p) => watchPlanKey(p.analysis, p.market ?? "crypto"))));
          }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-0.5">
        {visiblePlans.map((w) => {
          const market = w.market ?? "crypto";
          const a = w.analysis;
          const key = watchPlanKey(a, market);
          const label = planStatusLabel(w.lastStatus, {
            side: a.side === "long" || a.side === "short" ? a.side : undefined,
            entryPrice: a.entryPrice,
            stopPrice: a.stopLossPrice,
            entryMode: a.entryMode,
          });
          return (
            <div
              key={key}
              className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-2 text-xs"
            >
              <p className="font-semibold truncate">
                {scalpPlanWatchLabel(market)} · {a.symbol} · {a.timeframeLabel}
              </p>
              <p className="mt-0.5 opacity-90">{label}</p>
              {w.lastLivePrice != null && (
                <p className="mt-0.5 font-mono opacity-80">
                  Live ${w.lastLivePrice.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                </p>
              )}
              <div className="flex flex-wrap gap-2 mt-2">
                <Button asChild size="sm" variant="secondary" className="h-7 text-xs">
                  <Link
                    href={
                      market === "forex"
                        ? "/?tab=nova-pulse&pulse=forex#nova-scalp-watched-plan"
                        : "/?tab=nova-pulse&pulse=futures#nova-scalp-watched-plan"
                    }
                    onClick={() => requestOpenWatchedScalpPlan(a, market)}
                  >
                    Open plan
                  </Link>
                </Button>
                <button
                  type="button"
                  className="text-[10px] underline opacity-70 hover:opacity-100"
                  onClick={() => stopWatchingScalpPlan(a, market)}
                >
                  Stop
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
