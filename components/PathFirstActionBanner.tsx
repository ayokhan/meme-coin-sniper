"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export type PathFirstActionTab =
  | "new"
  | "futures"
  | "nova-forex"
  | "wallets"
  | "polymarket-bot";

const HINTS: Record<
  PathFirstActionTab,
  { title: string; body: string; ctaLabel: string; ctaHref: string }
> = {
  new: {
    title: "Do this first",
    body: "Scan new pairs, then open AI Agent and paste one contract for analysis.",
    ctaLabel: "Open AI Agent",
    ctaHref: "/?tab=ai-analysis",
  },
  futures: {
    title: "Do this first",
    body: "Open AI Chart Analysis, upload one chart, and get entry / TP / SL framing.",
    ctaLabel: "See workflow",
    ctaHref: "/?tab=futures",
  },
  "nova-forex": {
    title: "Do this first",
    body: "Refresh Market Watch, then run NovaQ on XAUUSD (or EURUSD) for one structured read.",
    ctaLabel: "Stay on Nova Forex",
    ctaHref: "/?tab=nova-forex",
  },
  wallets: {
    title: "Do this first",
    body: "Open Top Leverage Traders and review one smart-money wallet — or add a wallet you track.",
    ctaLabel: "Stay on Wallets",
    ctaHref: "/?tab=wallets",
  },
  "polymarket-bot": {
    title: "Do this first",
    body: "Explore Polymarket wallet intel / radar on one market you care about.",
    ctaLabel: "Stay on Polymarket",
    ctaHref: "/?tab=polymarket-bot",
  },
};

function storageKey(tab: PathFirstActionTab) {
  return `novastaris-path-first-action-dismissed:${tab}`;
}

type Props = {
  tab: PathFirstActionTab;
  className?: string;
};

/** Dismissible first-action tip for core paths (local only — not a modal spam). */
export default function PathFirstActionBanner({ tab, className = "" }: Props) {
  const [visible, setVisible] = useState(false);
  const hint = HINTS[tab];

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      if (localStorage.getItem(storageKey(tab))) {
        setVisible(false);
        return;
      }
      setVisible(true);
    } catch {
      setVisible(true);
    }
  }, [tab]);

  if (!visible || !hint) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(storageKey(tab), "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  return (
    <div
      className={`rounded-lg border border-teal-500/30 bg-teal-500/10 px-3 py-2.5 sm:px-4 sm:py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 ${className}`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-300">
          {hint.title}
        </p>
        <p className="text-sm text-zinc-700 dark:text-zinc-200 mt-0.5">{hint.body}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {hint.ctaHref.includes("ai-analysis") ? (
          <Button asChild size="sm" className="bg-teal-600 hover:bg-teal-500 text-white">
            <Link href={hint.ctaHref}>{hint.ctaLabel}</Link>
          </Button>
        ) : null}
        <button
          type="button"
          onClick={dismiss}
          className="text-xs text-muted-foreground hover:text-zinc-800 dark:hover:text-zinc-200 underline underline-offset-2"
        >
          Got it
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="p-1 rounded text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
