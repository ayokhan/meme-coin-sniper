"use client";

import Link from "next/link";
import { X, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";

export const GUEST_NUDGE_DISMISS_KEY = "novastaris_guest_nudge_dismissed";
const GUEST_TAB_COUNT_KEY = "novastaris_guest_tab_views";

/** Track unique dashboard tabs visited this session (guests only). */
export function registerGuestTabView(tab: string): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = sessionStorage.getItem(GUEST_TAB_COUNT_KEY);
    const tabs = raw ? (JSON.parse(raw) as string[]) : [];
    if (!tabs.includes(tab)) {
      tabs.push(tab);
      sessionStorage.setItem(GUEST_TAB_COUNT_KEY, JSON.stringify(tabs));
    }
    return tabs.length;
  } catch {
    return 0;
  }
}

export function readGuestNudgeDismissed(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(GUEST_NUDGE_DISMISS_KEY) === "1";
}

export function dismissGuestNudgeStorage(): void {
  localStorage.setItem(GUEST_NUDGE_DISMISS_KEY, "1");
}

type GuestRegistrationBannerProps = {
  onDismiss: () => void;
  /** After exploring multiple tabs, use a slightly stronger message. */
  engaged?: boolean;
};

export function GuestRegistrationBanner({ onDismiss, engaged }: GuestRegistrationBannerProps) {
  return (
    <div className="mb-6 rounded-xl border border-cyan-200/80 dark:border-cyan-800/60 bg-gradient-to-r from-cyan-50/90 via-white to-violet-50/80 dark:from-cyan-950/40 dark:via-zinc-900/80 dark:to-violet-950/30 px-4 py-3 sm:py-4 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="shrink-0 rounded-full bg-cyan-100 dark:bg-cyan-900/50 p-2">
            <UserPlus className="h-4 w-4 text-cyan-600 dark:text-cyan-400" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {engaged ? "Enjoying NovaStaris? Save your progress with a free account." : "Create a free NovaStaris account"}
            </p>
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mt-0.5">
              {engaged
                ? "Sign up free in under a minute — save watchlists, track wallets, and unlock member features. No credit card required."
                : "Free to join · no credit card · save watchlists and get ready to upgrade when you want VIP tools."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 sm:ml-auto">
          <Button asChild size="sm" className="bg-cyan-600 hover:bg-cyan-700 text-white dark:bg-cyan-600 dark:hover:bg-cyan-500">
            <Link href="/register">Sign up free</Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="border-zinc-300 dark:border-zinc-600">
            <Link href="/signin">Sign in</Link>
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

type GuestAuthActionsProps = {
  registerHref?: string;
  signInHref?: string;
  showPlansLink?: boolean;
};

export function GuestAuthActions({
  registerHref = "/register",
  signInHref = "/signin",
  showPlansLink = true,
}: GuestAuthActionsProps) {
  return (
    <div className="mt-6 flex flex-col items-center gap-3 w-full max-w-sm mx-auto">
      <div className="flex flex-col sm:flex-row gap-2 w-full">
        <Button asChild className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white dark:bg-cyan-600 dark:hover:bg-cyan-500">
          <Link href={registerHref}>Sign up free</Link>
        </Button>
        <Button asChild variant="outline" className="flex-1 border-zinc-300 dark:border-zinc-600">
          <Link href={signInHref}>Sign in</Link>
        </Button>
      </div>
      <p className="text-xs text-muted-foreground text-center">Free to join · No credit card required</p>
      {showPlansLink && (
        <Link href="/subscribe" className="text-sm text-amber-600 dark:text-amber-400 hover:underline font-medium">
          View VIP plans →
        </Link>
      )}
    </div>
  );
}

type GuestLockedFeatureCardProps = {
  title: string;
  body: string;
  registerHref?: string;
};

/** Locked bot / premium preview for signed-out visitors. */
export function GuestLockedFeatureCard({ title, body, registerHref = "/register" }: GuestLockedFeatureCardProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center max-w-lg mx-auto">
      <div className="rounded-2xl border border-cyan-200/80 dark:border-cyan-800/60 bg-gradient-to-b from-cyan-50/80 to-white dark:from-cyan-950/30 dark:to-zinc-900/80 p-8 shadow-lg w-full">
        <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-100">{title}</h2>
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{body}</p>
        <GuestAuthActions registerHref={registerHref} />
      </div>
    </div>
  );
}
