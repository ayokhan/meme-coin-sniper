"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const UNLOCKS = [
  "NovaForecast + NovaRadar — crypto perp ranges and structure",
  "Nova Forex Agent — Market Watch for XAUUSD, FX, indices",
  "Wallet Tracker, Coach Calls, deeper wallet intelligence",
  "Higher AI limits and VIP workspaces",
] as const;

type TrialOffer = {
  enabled: boolean;
  trialDays: number;
  reminderHoursBefore: number;
  planLabel: string;
  planPriceUsd: number;
  eligible: boolean;
  ineligibleReason: string | null;
  alreadyVip: boolean;
};

type Props = {
  /** tab that triggered the lock — for contextual line */
  tabLabel?: string;
};

/** Soft VIP pitch shown on lock screens for signed-in free users (not guests). */
export default function VipSoftPitchPanel({ tabLabel }: Props) {
  const [offer, setOffer] = useState<TrialOffer | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/vip-trial", { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d?.success && d.offer) setOffer(d.offer as TrialOffer);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const showTrial = !!offer?.enabled && !!offer.eligible;

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

      {showTrial ? (
        <div className="mt-3 rounded-lg border border-amber-500/40 bg-white/50 dark:bg-zinc-950/30 px-3 py-2.5">
          <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
            Try VIP free for {offer.trialDays} days
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Card required. We’ll email you about {offer.reminderHoursBefore} hours before the trial ends so you
            can cancel. If you don’t cancel, you’re billed for {offer.planLabel} (${offer.planPriceUsd} + card
            fee) and VIP renews until you turn it off.
          </p>
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          Plans from $150/month (USDC). Explore free tools as long as you need.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {showTrial ? (
          <Button asChild size="sm" className="bg-amber-500 hover:bg-amber-600 text-white">
            <Link href={`/subscribe?trial=1`}>Start {offer.trialDays}-day VIP trial</Link>
          </Button>
        ) : null}
        <Button asChild size="sm" variant={showTrial ? "outline" : "default"} className={showTrial ? "" : "bg-amber-500 hover:bg-amber-600 text-white"}>
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
