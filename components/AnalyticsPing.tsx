"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useDashboardScreenAnalytics } from "@/components/DashboardScreenContext";

/**
 * Sends a page-view ping to /api/analytics when the route or home dashboard tab changes.
 * Home (`/`) uses a synthetic path with query params (tab + sub-views) so admin insights show the real screen.
 */
export default function AnalyticsPing() {
  const pathname = usePathname();
  const { homeAnalyticsPath } = useDashboardScreenAnalytics();
  const sent = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;
    if (pathname === "/" && !homeAnalyticsPath) return;

    const pathToRecord = pathname === "/" && homeAnalyticsPath ? homeAnalyticsPath : pathname;
    if (sent.current === pathToRecord) return;
    sent.current = pathToRecord;
    fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathToRecord }),
    }).catch(() => {});
  }, [pathname, homeAnalyticsPath]);

  return null;
}
