"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useDashboardScreenAnalytics } from "@/components/DashboardScreenContext";

const VISITOR_ID_KEY = "novastaris_visitor_id";

function getVisitorId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = sessionStorage.getItem(VISITOR_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(VISITOR_ID_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

/**
 * Sends a page-view ping to /api/analytics when the route or home dashboard tab changes.
 * Home (`/`) uses a synthetic path with query params (tab + sub-views) so admin insights show the real screen.
 * Skipped when owner disables Admin → Feature flags → Analytics page pings.
 */
export default function AnalyticsPing() {
  const pathname = usePathname();
  const { homeAnalyticsPath } = useDashboardScreenAnalytics();
  const sent = useRef<string | null>(null);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    fetch("/api/feature-flags-public")
      .then((r) => r.json())
      .then((data: { analyticsPingEnabled?: boolean }) => {
        if (data.analyticsPingEnabled === false) setEnabled(false);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!enabled || !pathname) return;
    if (pathname === "/" && !homeAnalyticsPath) return;

    const pathToRecord = pathname === "/" && homeAnalyticsPath ? homeAnalyticsPath : pathname;
    if (sent.current === pathToRecord) return;
    sent.current = pathToRecord;
    const visitorId = getVisitorId();
    fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathToRecord, visitorId: visitorId || undefined }),
    }).catch(() => {});
  }, [pathname, homeAnalyticsPath, enabled]);

  return null;
}
