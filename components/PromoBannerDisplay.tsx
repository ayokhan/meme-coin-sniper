"use client";

import Link from "next/link";
import { Gift, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPromoDrawDate, type PromoBannerAdmin } from "@/lib/promo-banner";

export const PROMO_BANNER_DISMISS_KEY = "novastaris_promo_banner_dismissed";

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
      <div className="rounded-lg border border-amber-300/70 dark:border-amber-700/60 bg-gradient-to-r from-amber-50 via-yellow-50/80 to-amber-50 dark:from-amber-950/50 dark:via-zinc-900 dark:to-amber-950/40 px-4 py-3 text-sm">
        <p className="font-semibold text-amber-900 dark:text-amber-100">
          {promo.headline} <span className="text-amber-600 dark:text-amber-400">{promo.prizeLabel}</span>
        </p>
        <p className="text-xs text-amber-800/80 dark:text-amber-200/80 mt-1">
          Draw: {drawLabel}. Free to join — no credit card.{" "}
          <Link href="/promo-terms" className="underline font-medium">
            Terms
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-xl border border-amber-300/80 dark:border-amber-700/60 bg-gradient-to-r from-amber-50/95 via-yellow-50/90 to-orange-50/80 dark:from-amber-950/50 dark:via-zinc-900/90 dark:to-amber-950/40 px-4 py-3 sm:py-4 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="shrink-0 rounded-full bg-amber-200/80 dark:bg-amber-900/60 p-2">
            <Gift className="h-4 w-4 text-amber-700 dark:text-amber-300" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-amber-950 dark:text-amber-50">
              {promo.headline}{" "}
              <span className="text-amber-600 dark:text-amber-400">{promo.prizeLabel}</span>
            </p>
            <p className="text-xs sm:text-sm text-amber-900/80 dark:text-amber-100/80 mt-0.5">
              {promo.bodyText ?? "Create your free account — no credit card required."}{" "}
              <span className="whitespace-nowrap">Draw: {drawLabel}.</span>{" "}
              <Link href="/promo-terms" className="underline font-medium hover:no-underline">
                Promo terms
              </Link>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 sm:ml-auto">
          <Button
            asChild
            size="sm"
            className="bg-amber-500 hover:bg-amber-600 text-white dark:bg-amber-600 dark:hover:bg-amber-500"
          >
            <Link href={promo.ctaHref}>{promo.ctaLabel}</Link>
          </Button>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-md p-1.5 text-amber-700/60 hover:text-amber-900 hover:bg-amber-100 dark:text-amber-300/60 dark:hover:bg-amber-900/40"
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
