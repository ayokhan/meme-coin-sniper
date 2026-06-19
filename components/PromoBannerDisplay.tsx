"use client";

import Link from "next/link";
import { Gift, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPromoDrawDate, type PromoBannerAdmin } from "@/lib/promo-banner";

export const PROMO_BANNER_DISMISS_KEY = "novastaris_promo_banner_dismissed";

/** Shared with guest registration banner — NovaStaris cyan/violet site accent. */
const BANNER_SHELL =
  "rounded-xl border border-cyan-200/80 dark:border-cyan-800/60 bg-gradient-to-r from-cyan-50/90 via-white to-violet-50/80 dark:from-cyan-950/40 dark:via-zinc-900/80 dark:to-violet-950/30 shadow-sm";
const BANNER_ICON =
  "shrink-0 rounded-full bg-cyan-100 dark:bg-cyan-900/50 p-2";
const PRIZE_ACCENT = "text-cyan-600 dark:text-cyan-400";

type PromoBannerDisplayProps = {
  promo: PromoBannerAdmin;
  onDismiss?: () => void;
  compact?: boolean;
};

export function PromoBannerDisplay({ promo, onDismiss, compact }: PromoBannerDisplayProps) {
  if (!promo.active) return null;

  const drawLabel = formatPromoDrawDate(promo.drawAt);

  if (compact) {
    return (
      <div className={`rounded-lg px-4 py-3 text-sm ${BANNER_SHELL}`}>
        <p className="font-semibold text-zinc-900 dark:text-zinc-100">
          {promo.headline}{" "}
          <span className={PRIZE_ACCENT}>{promo.prizeLabel}</span>
        </p>
        <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
          Draw: {drawLabel}. Free to join — no credit card.{" "}
          <Link href="/promo-terms" className={`underline font-medium ${PRIZE_ACCENT}`}>
            Terms
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className={`mb-6 px-4 py-3 sm:py-4 ${BANNER_SHELL}`}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={BANNER_ICON}>
            <Gift className={`h-4 w-4 ${PRIZE_ACCENT}`} aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {promo.headline}{" "}
              <span className={PRIZE_ACCENT}>{promo.prizeLabel}</span>
            </p>
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mt-0.5">
              {promo.bodyText ?? "Create your free account — no credit card required."}{" "}
              <span className="whitespace-nowrap">Draw: {drawLabel}.</span>{" "}
              <Link href="/promo-terms" className={`underline font-medium hover:no-underline ${PRIZE_ACCENT}`}>
                Promo terms
              </Link>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 sm:ml-auto">
          <Button
            asChild
            size="sm"
            className="bg-cyan-600 hover:bg-cyan-700 text-white dark:bg-cyan-600 dark:hover:bg-cyan-500"
          >
            <Link href={promo.ctaHref}>{promo.ctaLabel}</Link>
          </Button>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-md p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
              aria-label="Dismiss promo"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
