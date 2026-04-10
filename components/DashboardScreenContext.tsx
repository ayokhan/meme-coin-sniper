"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type Ctx = {
  /** Full synthetic path for analytics when user is on `/`, e.g. `/?tab=perp-radar&futures=ai`. Null when not on home or before home registers. */
  homeAnalyticsPath: string | null;
  setHomeAnalyticsPath: (path: string | null) => void;
};

const DashboardScreenContext = createContext<Ctx | null>(null);

export function DashboardScreenProvider({ children }: { children: ReactNode }) {
  const [homeAnalyticsPath, setHomeAnalyticsPathState] = useState<string | null>(null);
  const setHomeAnalyticsPath = useCallback((path: string | null) => {
    setHomeAnalyticsPathState(path);
  }, []);
  const value = useMemo(
    () => ({ homeAnalyticsPath, setHomeAnalyticsPath }),
    [homeAnalyticsPath, setHomeAnalyticsPath]
  );
  return <DashboardScreenContext.Provider value={value}>{children}</DashboardScreenContext.Provider>;
}

export function useDashboardScreenAnalytics() {
  const ctx = useContext(DashboardScreenContext);
  if (!ctx) {
    throw new Error("useDashboardScreenAnalytics must be used within DashboardScreenProvider");
  }
  return ctx;
}
