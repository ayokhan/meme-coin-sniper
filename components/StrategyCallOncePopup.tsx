"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export const STRATEGY_CALL_NUDGE_SEEN_KEY = "novastaris_strategy_call_nudge_seen";

function readSeen(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(STRATEGY_CALL_NUDGE_SEEN_KEY) === "1";
  } catch {
    return true;
  }
}

function markSeen(): void {
  try {
    localStorage.setItem(STRATEGY_CALL_NUDGE_SEEN_KEY, "1");
  } catch {
    /* ignore */
  }
}

type Props = {
  /** When false, never show. */
  enabled: boolean;
  /** Mention the top-nav button when it's visible. */
  showNavButton: boolean;
};

/**
 * Small one-time popup pointing customers to the free strategy call.
 * Dismissed permanently via localStorage (once per browser).
 */
export function StrategyCallOncePopup({ enabled, showNavButton }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    if (readSeen()) return;
    const t = window.setTimeout(() => setOpen(true), 1600);
    return () => window.clearTimeout(t);
  }, [enabled]);

  const dismiss = useCallback(() => {
    markSeen();
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dismiss]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[104] flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="strategy-call-nudge-title"
      onClick={dismiss}
    >
      <div
        className="relative w-full max-w-sm rounded-xl border border-teal-200/80 dark:border-teal-800/50 bg-white dark:bg-zinc-900 shadow-xl p-4 sm:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={dismiss}
          className="absolute top-2.5 right-2.5 rounded-md p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3 pr-6">
          <div className="shrink-0 rounded-full bg-teal-100 dark:bg-teal-900/40 p-2">
            <CalendarDays className="h-4 w-4 text-teal-700 dark:text-teal-300" aria-hidden />
          </div>
          <div className="min-w-0">
            <h2
              id="strategy-call-nudge-title"
              className="text-sm font-semibold text-zinc-900 dark:text-zinc-50"
            >
              Book a Strategy call
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Get a short guided walkthrough of NovaStaris
              {showNavButton ? (
                <>
                  . Find{" "}
                  <span className="font-medium text-zinc-800 dark:text-zinc-200">Strategy call</span> in the top
                  menu, or continue here.
                </>
              ) : (
                <> when you are ready.</>
              )}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button asChild size="sm" className="bg-teal-600 hover:bg-teal-500 text-white">
                <Link href="/strategy-call" onClick={dismiss}>
                  Book a Strategy call
                </Link>
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={dismiss}>
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
