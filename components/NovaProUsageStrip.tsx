"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";

type Usage = { used: number; limit: number; remaining: number };
type Payload = { success: boolean; isNovaPro?: boolean; founding?: boolean; ai?: Usage; pulse?: Usage };

/** Compact "today's runs" meter for Nova Pro subscribers. Refreshes every minute. */
export default function NovaProUsageStrip({ className = "" }: { className?: string }) {
  const [data, setData] = useState<Payload | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/nova-pro/usage", { credentials: "include", cache: "no-store" });
        const json = (await res.json()) as Payload;
        if (!cancelled) setData(json);
      } catch {
        /* keep last value */
      }
    };
    void load();
    const id = window.setInterval(load, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  if (!data?.success || !data.isNovaPro || !data.ai || !data.pulse) return null;

  const meter = (label: string, u: Usage) => (
    <span className={u.remaining === 0 ? "text-rose-600 dark:text-rose-400 font-medium" : ""}>
      {label}: <strong>{u.used}</strong>/{u.limit}
    </span>
  );

  return (
    <div
      className={`flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-violet-200/80 dark:border-violet-800/60 bg-violet-50/70 dark:bg-violet-950/30 px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300 ${className}`}
    >
      <span className="inline-flex items-center gap-1 font-semibold text-violet-700 dark:text-violet-300">
        <Sparkles className="h-3.5 w-3.5" aria-hidden />
        Nova Pro{data.founding ? " · Founding member" : ""}
      </span>
      {meter("AI runs today", data.ai)}
      {meter("Nova Pulse today", data.pulse)}
      <span className="text-muted-foreground">Resets 00:00 UTC</span>
      <Link href="/subscribe?plan=vip" className="ml-auto font-medium text-amber-700 dark:text-amber-400 hover:underline">
        Go unlimited with VIP
      </Link>
    </div>
  );
}
