"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/** Higher priority wins; only one blocking overlay at a time. */
export type DashboardOverlayId = "path-picker" | "site-announcement" | "two-factor" | "futures-onboarding";

const OVERLAY_PRIORITY: Record<DashboardOverlayId, number> = {
  "path-picker": 100,
  "site-announcement": 90,
  "two-factor": 70,
  "futures-onboarding": 50,
};

type OverlayContextValue = {
  activeOverlay: DashboardOverlayId | null;
  registerOverlay: (id: DashboardOverlayId, wantsOpen: boolean) => void;
};

const OverlayContext = createContext<OverlayContextValue | null>(null);

export function DashboardOverlayProvider({ children }: { children: React.ReactNode }) {
  const [claims, setClaims] = useState<Partial<Record<DashboardOverlayId, boolean>>>({});

  const registerOverlay = useCallback((id: DashboardOverlayId, wantsOpen: boolean) => {
    setClaims((prev) => {
      if (!!prev[id] === wantsOpen) return prev;
      return { ...prev, [id]: wantsOpen };
    });
  }, []);

  const activeOverlay = useMemo(() => {
    let winner: DashboardOverlayId | null = null;
    let best = -1;
    for (const [id, wants] of Object.entries(claims) as [DashboardOverlayId, boolean][]) {
      if (!wants) continue;
      const p = OVERLAY_PRIORITY[id];
      if (p > best) {
        best = p;
        winner = id;
      }
    }
    return winner;
  }, [claims]);

  const value = useMemo(
    () => ({ activeOverlay, registerOverlay }),
    [activeOverlay, registerOverlay]
  );

  return <OverlayContext.Provider value={value}>{children}</OverlayContext.Provider>;
}

/** Returns true only when this overlay wins the priority queue. */
export function useDashboardOverlay(id: DashboardOverlayId, wantsOpen: boolean): boolean {
  const ctx = useContext(OverlayContext);

  useEffect(() => {
    if (!ctx) return;
    ctx.registerOverlay(id, wantsOpen);
    return () => ctx.registerOverlay(id, false);
  }, [ctx, id, wantsOpen]);

  if (!ctx) return wantsOpen;
  return wantsOpen && ctx.activeOverlay === id;
}
