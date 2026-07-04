"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "novastaris-meme-analyze-hint-dismiss";

export type MemeAnalyzeHintTier = "guest" | "free" | "vip";

type Props = {
  tier: MemeAnalyzeHintTier;
  className?: string;
};

function readDismissed(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export function useMemeAnalyzeHintDismissed() {
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    setDismissed(readDismissed());
  }, []);
  return [dismissed, setDismissed] as const;
}

export function dismissMemeAnalyzeHint(setDismissed: (v: boolean) => void) {
  try {
    sessionStorage.setItem(DISMISS_KEY, "1");
  } catch {
    /* ignore */
  }
  setDismissed(true);
}

export default function MemeTableAnalyzeHint({ tier, className = "" }: Props) {
  const [dismissed, setDismissed] = useMemeAnalyzeHintDismissed();
  if (dismissed) return null;

  const title =
    tier === "guest"
      ? "Analyze any coin with Nova AI Analysis"
      : tier === "vip"
        ? "Unlimited Nova AI Analysis"
        : "Tap Analyze for Nova AI Analysis";

  const body =
    tier === "guest"
      ? "Sign in or register free, then tap the purple Analyze button on any row. Nova AI Analysis works on Solana and BSC meme coins."
      : tier === "vip"
        ? "Tap the purple Analyze button on any row to run Nova AI Analysis on any Solana or BSC meme coin — unlimited Meme Agent uses."
        : "Tap the purple Analyze button on any row to run Nova AI Analysis on any Solana or BSC meme coin.";

  return (
    <div
      className={`mx-3 sm:mx-6 mb-4 sm:mb-5 rounded-lg border border-violet-300/50 dark:border-violet-700/50 bg-gradient-to-r from-violet-50/90 via-slate-50/90 to-cyan-50/70 dark:from-violet-950/35 dark:via-slate-900/80 dark:to-cyan-950/25 px-3 py-2.5 sm:px-4 sm:py-3 ${className}`.trim()}
    >
      <div className="flex items-start gap-2 sm:gap-3">
        <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 text-violet-600 dark:text-violet-400 mt-0.5" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</p>
          <p className="mt-0.5 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{body}</p>
          {tier === "guest" && (
            <div className="mt-2.5 flex flex-wrap gap-2">
              <Link
                href="/register"
                className="inline-flex items-center rounded-md bg-violet-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-violet-700 dark:bg-violet-600 dark:hover:bg-violet-500 transition-colors"
              >
                Register free
              </Link>
              <Link
                href="/signin"
                className="inline-flex items-center rounded-md border border-slate-300/90 dark:border-slate-500/70 bg-white/80 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 px-3 py-1.5 text-xs font-semibold hover:bg-white dark:hover:bg-slate-700 transition-colors"
              >
                Sign in
              </Link>
            </div>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 shrink-0 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
          onClick={() => dismissMemeAnalyzeHint(setDismissed)}
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
