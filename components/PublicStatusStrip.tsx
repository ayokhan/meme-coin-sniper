"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity } from "lucide-react";

type PublicStatus = "operational" | "degraded" | "outage" | "loading";

export default function PublicStatusStrip() {
  const [status, setStatus] = useState<PublicStatus>("loading");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/status/public")
      .then((r) => r.json())
      .then((data: { status?: PublicStatus; message?: string }) => {
        if (cancelled) return;
        setStatus(data.status ?? "operational");
        setMessage(data.message ?? null);
      })
      .catch(() => {
        if (!cancelled) setStatus("operational");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "loading" || status === "operational") return null;

  const isDegraded = status === "degraded";
  const border = isDegraded
    ? "border-amber-200/80 dark:border-amber-800/60"
    : "border-red-200/80 dark:border-red-800/60";
  const bg = isDegraded
    ? "bg-amber-50/95 dark:bg-amber-950/40"
    : "bg-red-50/95 dark:bg-red-950/40";
  const text = isDegraded
    ? "text-amber-900 dark:text-amber-100"
    : "text-red-900 dark:text-red-100";

  return (
    <div className={`border-b ${border} ${bg}`}>
      <div className={`mx-auto max-w-6xl px-3 sm:px-4 py-2 flex flex-wrap items-center gap-2 text-xs sm:text-sm ${text}`}>
        <Activity className="h-4 w-4 shrink-0" aria-hidden />
        <span className="font-medium">
          {isDegraded ? "Some services are slow" : "Service disruption"}
        </span>
        {message && <span className="text-muted-foreground">— {message}</span>}
        <Link
          href="/support"
          className="ml-auto underline underline-offset-2 font-medium hover:opacity-80"
        >
          Get help
        </Link>
      </div>
    </div>
  );
}
