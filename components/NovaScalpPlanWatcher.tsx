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
  readWatchedScalpPlan,
  SCALP_WATCH_EVENT,
  writeWatchedScalpPlan,
  type WatchedScalpPlan,
} from "@/lib/nova-scalp-plan-watch";
import { scalpPlanWatchLabel } from "@/lib/scalp-plan-market";

const NOTIFY_STATUSES: ScalpPlanStatus[] = ["at_entry", "invalidated", "target_hit", "stale"];

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
      tag: `scalp-watch-${analysis.symbol}-${analysis.analyzedAt}`,
    });
  } catch {
    /* ignore */
  }
}

export default function NovaScalpPlanWatcher() {
  const lastNotified = useRef<string>("");

  useEffect(() => {
    let cancelled = false;
    let intervalId: number | undefined;

    const tick = async () => {
      const watched = readWatchedScalpPlan();
      if (!watched || watched.analysis.side === "no_entry") return;

      const market = watched.market ?? "crypto";
      const livePrice = await fetchScalpLivePrice(watched.analysis.symbol, market);
      if (cancelled) return;

      // The fetch above is async; the user may have stopped watching (or switched
      // plans) while it was in flight. Re-read before writing so a stale tick can't
      // resurrect a dismissed plan and re-show the banner.
      const current = readWatchedScalpPlan();
      if (
        !current ||
        current.analysis.analyzedAt !== watched.analysis.analyzedAt ||
        current.analysis.symbol !== watched.analysis.symbol ||
        (current.market ?? "crypto") !== market
      ) {
        return;
      }

      const status = planStatusFromAnalysis(watched.analysis, livePrice);
      const prev = watched.lastStatus;
      const updated: WatchedScalpPlan = {
        ...watched,
        lastStatus: status,
        lastLivePrice: livePrice,
        statusUpdatedAt:
          status !== prev ? new Date().toISOString() : watched.statusUpdatedAt,
      };
      writeWatchedScalpPlan(updated);

      dispatchScalpStatusChange({
        status,
        analysis: watched.analysis,
        livePrice,
      });

      const notifyKey = `${watched.analysis.analyzedAt}:${status}`;
      if (status !== prev && lastNotified.current !== notifyKey) {
        lastNotified.current = notifyKey;
        notifyScalpStatus(watched.analysis, status, livePrice, market);
      }
    };

    const start = () => {
      if (intervalId) window.clearInterval(intervalId);
      void tick();
      intervalId = window.setInterval(() => void tick(), SCALP_LIVE_PRICE_MS);
    };

    const onWatchChange = () => start();

    start();
    window.addEventListener(SCALP_WATCH_EVENT, onWatchChange);

    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
      window.removeEventListener(SCALP_WATCH_EVENT, onWatchChange);
    };
  }, []);

  return null;
}
