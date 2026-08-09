"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Gift, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDashboardOverlay, useMarkMarketingOverlayDone } from "@/components/DashboardOverlayProvider";

const DISMISS_KEY = "novastaris_vip_trial_popup_dismissed_at";
const LATER_KEY = "novastaris_vip_trial_popup_later_at";

type TrialOffer = {
  enabled: boolean;
  showLoginPopup: boolean;
  trialDays: number;
  reminderHoursBefore: number;
  planLabel: string;
  planPriceUsd: number;
  eligible: boolean;
  alreadyVip: boolean;
  updatedAt: string | null;
  popupTitle: string;
  popupBody: string;
  popupCtaLabel: string;
  popupSecondaryCtaLabel: string;
};

function readDismissedAt(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(DISMISS_KEY);
  } catch {
    return null;
  }
}

function readLaterAt(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(LATER_KEY);
  } catch {
    return null;
  }
}

function dismissPermanent(updatedAt: string) {
  try {
    localStorage.setItem(DISMISS_KEY, updatedAt);
    sessionStorage.removeItem(LATER_KEY);
  } catch {
    /* ignore */
  }
}

function dismissLater(updatedAt: string) {
  try {
    sessionStorage.setItem(LATER_KEY, updatedAt);
  } catch {
    /* ignore */
  }
}

type ModalProps = {
  open: boolean;
  offer: TrialOffer;
  onRemindLater: () => void;
  onDismissPermanent: () => void;
};

function VipTrialPopupModal({ open, offer, onRemindLater, onDismissPermanent }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onRemindLater();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onRemindLater]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[106] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vip-trial-popup-title"
      onClick={onRemindLater}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-amber-200/80 dark:border-amber-800/50 bg-white dark:bg-zinc-900 shadow-2xl p-5 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onRemindLater}
          className="absolute top-3 right-3 rounded-md p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center text-center sm:items-start sm:text-left">
          <div className="mb-4 rounded-full bg-amber-100 dark:bg-amber-900/40 p-3">
            <Gift className="h-7 w-7 text-amber-600 dark:text-amber-400" aria-hidden />
          </div>
          <h2 id="vip-trial-popup-title" className="text-lg font-bold text-zinc-900 dark:text-zinc-100 pr-8">
            {offer.popupTitle}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
            {offer.popupBody}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            By starting a trial you agree to our{" "}
            <Link href="/payment-terms" className="underline hover:no-underline text-cyan-600 dark:text-cyan-400">
              Payment Terms
            </Link>
            , including auto-charge after the free trial if you don’t cancel.
          </p>
        </div>

        <div className="mt-5 flex flex-col gap-2">
          <Button asChild className="w-full bg-amber-500 hover:bg-amber-600 text-white">
            <Link href="/subscribe?trial=1" onClick={onRemindLater}>
              {offer.popupCtaLabel}
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/subscribe" onClick={onRemindLater}>
              {offer.popupSecondaryCtaLabel}
            </Link>
          </Button>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={onRemindLater}
              className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 underline-offset-2 hover:underline"
            >
              Remind me later
            </button>
            <button
              type="button"
              onClick={onDismissPermanent}
              className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              Don&apos;t show again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Login popup for eligible free users when owner enables trial + showLoginPopup. */
export function VipTrialPopupHost() {
  const { status } = useSession();
  const [wantsOpen, setWantsOpen] = useState(false);
  const [offer, setOffer] = useState<TrialOffer | null>(null);
  const open = useDashboardOverlay("vip-trial-popup", wantsOpen);
  const markMarketingDone = useMarkMarketingOverlayDone();

  const closeLater = useCallback(() => {
    if (offer?.updatedAt) dismissLater(offer.updatedAt);
    markMarketingDone();
    setWantsOpen(false);
  }, [offer?.updatedAt, markMarketingDone]);

  const closePermanent = useCallback(() => {
    if (offer?.updatedAt) dismissPermanent(offer.updatedAt);
    markMarketingDone();
    setWantsOpen(false);
  }, [offer?.updatedAt, markMarketingDone]);

  useEffect(() => {
    if (status !== "authenticated") return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      fetch("/api/vip-trial", { credentials: "include", cache: "no-store" })
        .then((r) => r.json())
        .then((data: { success?: boolean; offer?: TrialOffer }) => {
          if (cancelled || !data.success || !data.offer) return;
          const o = data.offer;
          if (!o.enabled || !o.showLoginPopup || !o.eligible || o.alreadyVip) return;
          if (!o.updatedAt) return;
          if (readDismissedAt() === o.updatedAt) return;
          if (readLaterAt() === o.updatedAt) return;
          setOffer(o);
          setWantsOpen(true);
        })
        .catch(() => {});
    }, 900);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [status]);

  if (!offer) return null;

  return (
    <VipTrialPopupModal
      open={open}
      offer={offer}
      onRemindLater={closeLater}
      onDismissPermanent={closePermanent}
    />
  );
}
