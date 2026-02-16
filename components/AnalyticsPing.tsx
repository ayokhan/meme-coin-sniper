"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Sends a single page-view ping to /api/analytics when the route changes.
 * No auth required; API records path + server-derived country and device from headers.
 */
export default function AnalyticsPing() {
  const pathname = usePathname();
  const sent = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;
    const key = pathname;
    if (sent.current === key) return;
    sent.current = key;
    fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname }),
    }).catch(() => {});
  }, [pathname]);

  return null;
}
