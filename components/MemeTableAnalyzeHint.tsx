"use client";

import { useEffect, useState } from "react";
import type { MemeTableAnalyzeHintBannerConfig } from "@/lib/meme-table-analyze-hint-banner";
import { DEFAULT_MEME_TABLE_HINT_BANNER } from "@/lib/meme-table-analyze-hint-banner";
import Link from "next/link";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "novastaris-meme-analyze-hint-dismiss";

export type MemeAnalyzeHintTier = "guest" | "free" | "vip";

type Props = {
  tier: MemeAnalyzeHintTier;
  className?: string;
  config?: MemeTableAnalyzeHintBannerConfig | null;
  /** Admin preview — ignores session dismiss state. */
  preview?: boolean;
  /**
   * Go Hunting: teal desk chrome + Open AI Agent CTA — one tip instead of
   * stacking “Do this first” + purple analyze banners.
   */
  variant?: "default" | "memeDesk";
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

export default function MemeTableAnalyzeHint({
  tier,
  className = "",
  config,
  preview = false,
  variant = "default",
}: Props) {
  const [dismissed, setDismissed] = useMemeAnalyzeHintDismissed();
  const cfg = config ?? DEFAULT_MEME_TABLE_HINT_BANNER;
  if (!cfg.enabled || (!preview && dismissed)) return null;

  const title =
    tier === "guest" ? cfg.guestTitle : tier === "vip" ? cfg.vipTitle : cfg.freeTitle;
  const body = tier === "guest" ? cfg.guestBody : tier === "vip" ? cfg.vipBody : cfg.freeBody;
  const desk = variant === "memeDesk";

  const shell = desk
    ? "rounded-xl border border-teal-500/30 dark:border-teal-400/25 bg-gradient-to-br from-teal-500/12 via-transparent to-violet-500/10 dark:from-teal-500/15 dark:via-zinc-950/40 dark:to-violet-950/20"
    : "rounded-lg border border-violet-300/50 dark:border-violet-700/50 bg-gradient-to-r from-violet-50/90 via-slate-50/90 to-cyan-50/70 dark:from-violet-950/35 dark:via-slate-900/80 dark:to-cyan-950/25";

  return (
    <div className={`mx-3 sm:mx-6 mb-4 sm:mb-5 ${shell} px-3 py-2.5 sm:px-4 sm:py-3 ${className}`.trim()}>
      <div className="flex items-start gap-2 sm:gap-3">
        <Sparkles
          className={`h-4 w-4 sm:h-5 sm:w-5 shrink-0 mt-0.5 ${
            desk ? "text-violet-600 dark:text-violet-400" : "text-violet-600 dark:text-violet-400"
          }`}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          {desk && (
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-700/90 dark:text-teal-200/85 mb-1">
              First move
            </p>
          )}
          {cfg.headline ? (
            <p
              className={`font-[family-name:var(--font-space-grotesk)] text-base sm:text-lg font-semibold tracking-tight leading-normal ${
                desk ? "text-zinc-900 dark:text-white" : "font-display font-bold text-rose-500 dark:text-rose-400"
              }`}
            >
              {cfg.headline}
            </p>
          ) : null}
          <p
            className={`text-sm font-semibold text-slate-900 dark:text-slate-100 ${
              cfg.headline ? "mt-1" : ""
            }`}
          >
            {title}
          </p>
          <p className="mt-0.5 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{body}</p>
          {(tier === "guest" || desk) && (
            <div className="mt-2.5 flex flex-wrap gap-2">
              {tier === "guest" ? (
                <>
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
                </>
              ) : (
                <Link
                  href="/?tab=ai-analysis"
                  className="inline-flex items-center rounded-md bg-teal-600 hover:bg-teal-500 text-white px-3 py-1.5 text-xs font-semibold transition-colors"
                >
                  Open AI Agent
                </Link>
              )}
            </div>
          )}
        </div>
        {!preview && (
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
        )}
      </div>
    </div>
  );
}
