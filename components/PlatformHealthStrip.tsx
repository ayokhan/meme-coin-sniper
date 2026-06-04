"use client";

import { useEffect, useState } from "react";

type Service = { name: string; status: string; message: string };

export default function PlatformHealthStrip({ className = "" }: { className?: string }) {
  const [services, setServices] = useState<Service[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/health/public", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d.success && Array.isArray(d.services)) {
          setServices(d.services);
        }
      })
      .catch(() => {
        if (!cancelled) setServices(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <p className={`text-[11px] text-muted-foreground ${className}`}>Checking data feeds…</p>
    );
  }
  if (!services?.length) return null;

  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] ${className}`}
      title="Live check of price/data APIs used by NovaStaris"
    >
      <span className="text-muted-foreground font-medium">Feeds:</span>
      {services.map((s) => (
        <span key={s.name} className="inline-flex items-center gap-1">
          <span
            className={
              s.status === "ok"
                ? "text-emerald-600 dark:text-emerald-400"
                : s.status === "error"
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-amber-600 dark:text-amber-400"
            }
          >
            {s.status === "ok" ? "●" : s.status === "error" ? "●" : "◐"}
          </span>
          <span className="text-zinc-600 dark:text-zinc-400">
            {s.name}
            <span className="text-muted-foreground ml-0.5">({s.message})</span>
          </span>
        </span>
      ))}
    </div>
  );
}
