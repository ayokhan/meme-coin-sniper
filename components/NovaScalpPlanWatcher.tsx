"use client";

import { useEffect, useRef } from "react";
import type { NovaScalpAnalysis } from "@/lib/nova-scalp-agent";
import { fetchScalpLivePrice, SCALP_LIVE_PRICE_MS } from "@/lib/nova-scalp-plan-price";
import {
  planStatusFromAnalysis,
  planStatusLabel,
  type ScalpPlanStatus,
} from "@/lib/nova-scalp-plan-status";
import {
  dispatchScalpStatusChange,
  readWatchedScalpPlans,
  SCALP_WATCH_EVENT,
  watchPlanKey,
  writeWatchedScalpPlans,
  type WatchedScalpPlan,
} from "@/lib/nova-scalp-plan-watch";
import { scalpPlanWatchLabel } from "@/lib/scalp-plan-market";

const NOTIFY_STATUSES: ScalpPlanStatus[] = ["at_entry", "invalidated", "target_hit", "missed", "stale"];

function notifyScalpStatus(
  analysis: NovaScalpAnalysis,
  status: ScalpPlanStatus,
  livePrice: number | null,
  market: WatchedScalpPlan["market"]
) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  if (!NOTIFY_STATUSES.includes(status)) return;

  const label = planStatusLabel(status, {
    side: analysis.side === "long" || analysis.side === "short" ? analysis.side : undefined,
    entryPrice: analysis.entryPrice,
    stopPrice: analysis.stopLossPrice,
    entryMode: analysis.entryMode,
  });
  const priceBit = livePrice != null ? ` · ${livePrice.toLocaleString(undefined, { maximumFractionDigits: 4 })}` : "";
  try {
    new Notification(`${scalpPlanWatchLabel(market ?? "crypto")} · ${analysis.symbol}`, {
      body: `${label}${priceBit}`,
      tag: `scalp-watch-${analysis.symbol}-${analysis.timeframeId}`,
    });
  } catch {
    /* ignore */
  }
}

export default function NovaScalpPlanWatcher() {
  const lastNotified = useRef<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    let intervalId: number | undefined;
    let ticking = false;

    const tick = async () => {
      if (ticking) return;
      ticking = true;
      try {
        const snapshot = readWatchedScalpPlans().filter((w) => w.analysis.side !== "no_entry");
        if (snapshot.length === 0) return;

        const updates = await Promise.all(
          snapshot.map(async (watched) => {
            const market = watched.market ?? "crypto";
            const livePrice = await fetchScalpLivePrice(watched.analysis.symbol, market);
            return { watched, market, livePrice };
          })
        );
        if (cancelled) return;

        const current = readWatchedScalpPlans();
        const currentKeys = new Set(current.map((p) => watchPlanKey(p.analysis, p.market ?? "crypto")));
        let next = [...current];
        let changed = false;

        for (const { watched, market, livePrice } of updates) {
          const key = watchPlanKey(watched.analysis, market);
          if (!currentKeys.has(key)) continue;

          const status = planStatusFromAnalysis(watched.analysis, livePrice);
          const prev = watched.lastStatus;
          const idx = next.findIndex((p) => watchPlanKey(p.analysis, p.market ?? "crypto") === key);
          if (idx < 0) continue;

          const updated: WatchedScalpPlan = {
            ...next[idx]!,
            analysis: next[idx]!.analysis,
            lastStatus: status,
            lastLivePrice: livePrice,
            statusUpdatedAt:
              status !== prev ? new Date().toISOString() : next[idx]!.statusUpdatedAt,
          };
          if (
            updated.lastStatus !== next[idx]!.lastStatus ||
            updated.lastLivePrice !== next[idx]!.lastLivePrice
          ) {
            next[idx] = updated;
            changed = true;
          }

          dispatchScalpStatusChange({
            status,
            analysis: watched.analysis,
            livePrice,
            market,
          });

          const notifyKey = `${key}:${status}`;
          if (status !== prev && lastNotified.current[key] !== notifyKey) {
            lastNotified.current[key] = notifyKey;
            notifyScalpStatus(watched.analysis, status, livePrice, market);
          }
        }

        if (changed) writeWatchedScalpPlans(next);
      } finally {
        ticking = false;
      }
    };

    const start = () => {
      if (intervalId) window.clearInterval(intervalId);
      void tick();
      intervalId = window.setInterval(() => void tick(), SCALP_LIVE_PRICE_MS);
    };

    start();
    window.addEventListener(SCALP_WATCH_EVENT, start);

    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
      window.removeEventListener(SCALP_WATCH_EVENT, start);
    };
  }, []);

  return null;
}
