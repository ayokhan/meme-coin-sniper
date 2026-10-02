"use client";

import Link from "next/link";
import { Crown, Lock } from "lucide-react";

/** Shown to Nova Pro subscribers on VIP-only desks (bots, Coach Calls). */
export default function NovaProVipOnlyLock({ tabLabel }: { tabLabel?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="max-w-lg rounded-2xl border border-amber-300/70 dark:border-amber-700/60 bg-gradient-to-b from-amber-50/90 to-white dark:from-amber-950/40 dark:to-zinc-900/80 p-8 shadow-lg">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50">
          <Lock className="h-7 w-7 text-amber-600 dark:text-amber-400" aria-hidden />
        </div>
        <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-100">
          VIP only{tabLabel ? ` — ${tabLabel}` : ""}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          Your <strong className="text-zinc-800 dark:text-zinc-200">Nova Pro</strong> plan includes every VIP desk with
          daily limits. <strong className="text-amber-700 dark:text-amber-400">Bots</strong> (NovaScalper, Forex Bots, GMGN,
          Prop Firm, Nova Ultimate, Polymarket) and <strong className="text-amber-700 dark:text-amber-400">Coach Calls</strong>{" "}
          are reserved for VIP.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Upgrade to VIP for unlimited runs, every bot and Coach Calls. Your unused Pro days are credited toward VIP.
        </p>
        <Link
          href="/subscribe?plan=vip"
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-700"
        >
          <Crown className="h-4 w-4" aria-hidden />
          Upgrade to VIP
        </Link>
      </div>
    </div>
  );
}
