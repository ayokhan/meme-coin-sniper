"use client";

import { GraduationCap, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export const TRADING_UNIVERSITY_BANNER_DISMISS_KEY = "novastaris_tu_invite_dismissed";

export function readTradingUniversityBannerDismissed(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(TRADING_UNIVERSITY_BANNER_DISMISS_KEY) === "1";
}

export function dismissTradingUniversityBannerStorage(): void {
  localStorage.setItem(TRADING_UNIVERSITY_BANNER_DISMISS_KEY, "1");
}

type Props = {
  variant: "guest" | "member";
  onOpen: () => void;
  onDismiss: () => void;
};

export default function TradingUniversityInviteBanner({ variant, onOpen, onDismiss }: Props) {
  const title =
    variant === "guest"
      ? "New to these markets? Start with Trading University"
      : "Continue your free Trading University course";
  const body =
    variant === "guest"
      ? "Learn meme coins, perps, prediction markets, and forex — then earn a certificate. Preview free; enroll to take the full course."
      : "Finish the modules and sit the final exam when you are ready. It is free for registered members.";

  return (
    <div className="mb-6 rounded-xl border border-amber-200/80 dark:border-amber-800/50 bg-gradient-to-r from-amber-50/90 via-white to-cyan-50/80 dark:from-amber-950/30 dark:via-zinc-900/80 dark:to-cyan-950/25 px-4 py-3 sm:py-4 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="shrink-0 rounded-full bg-amber-100 dark:bg-amber-900/40 p-2">
            <GraduationCap className="h-4 w-4 text-amber-700 dark:text-amber-300" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</p>
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mt-0.5">{body}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 sm:ml-auto">
          <Button
            type="button"
            size="sm"
            className="bg-amber-600 hover:bg-amber-700 text-white dark:bg-amber-600 dark:hover:bg-amber-500"
            onClick={onOpen}
          >
            {variant === "guest" ? "Preview course" : "Open University"}
          </Button>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-md p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
