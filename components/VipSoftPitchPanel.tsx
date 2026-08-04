"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

const UNLOCKS = [
  "NovaForecast + NovaRadar — crypto perp ranges and structure",
  "Nova Forex Agent — Market Watch for XAUUSD, FX, indices",
  "CT Scan, Coach Calls, deeper wallet intelligence",
  "Higher AI limits and VIP workspaces",
] as const;

type Props = {
  /** tab that triggered the lock — for contextual line */
  tabLabel?: string;
};

/** Soft VIP pitch shown on lock screens for signed-in free users (not guests). */
export default function VipSoftPitchPanel({ tabLabel }: Props) {
  return (
    <div className="mt-6 w-full max-w-md rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-left">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
        Ready when you are
      </p>
      <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {tabLabel
          ? `${tabLabel} is part of the full VIP desk`
          : "Unlock the full NovaStaris desk"}
      </p>
      <ul className="mt-3 space-y-1.5 text-xs text-zinc-700 dark:text-zinc-300 list-disc list-inside">
        {UNLOCKS.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        Plans from $150/month (USDC). No hard sell — explore free tools as long as you need.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button asChild size="sm" className="bg-amber-500 hover:bg-amber-600 text-white">
          <Link href="/subscribe">See VIP plans</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/start-here">Start here map</Link>
        </Button>
        <Button asChild size="sm" variant="ghost">
          <Link href="/chat">Chat</Link>
        </Button>
      </div>
    </div>
  );
}
