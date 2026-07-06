"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Megaphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SiteAnnouncementBannerAdmin } from "@/lib/site-announcement-banner";
import { DEFAULT_SITE_ANNOUNCEMENT } from "@/lib/site-announcement-banner";

export const SITE_ANNOUNCEMENT_DISMISS_KEY = "novastaris_site_announcement_dismissed_at";
export const SITE_ANNOUNCEMENT_LATER_KEY = "novastaris_site_announcement_later_at";

function readDismissedAt(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(SITE_ANNOUNCEMENT_DISMISS_KEY);
}

function readLaterAt(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(SITE_ANNOUNCEMENT_LATER_KEY);
}

export function dismissSiteAnnouncementPermanent(updatedAt: string): void {
  try {
    localStorage.setItem(SITE_ANNOUNCEMENT_DISMISS_KEY, updatedAt);
    sessionStorage.removeItem(SITE_ANNOUNCEMENT_LATER_KEY);
  } catch {
    /* ignore */
  }
}

export function dismissSiteAnnouncementLater(updatedAt: string): void {
  try {
    sessionStorage.setItem(SITE_ANNOUNCEMENT_LATER_KEY, updatedAt);
  } catch {
    /* ignore */
  }
}

function shouldShowAnnouncement(banner: SiteAnnouncementBannerAdmin): boolean {
  if (!banner.enabled || !banner.updatedAt) return false;
  if (readDismissedAt() === banner.updatedAt) return false;
  if (readLaterAt() === banner.updatedAt) return false;
  return true;
}

type ModalProps = {
  open: boolean;
  banner: SiteAnnouncementBannerAdmin;
  onRemindLater: () => void;
  onDismissPermanent: () => void;
};

export function SiteAnnouncementModal({ open, banner, onRemindLater, onDismissPermanent }: ModalProps) {
  const cfg = banner ?? { ...DEFAULT_SITE_ANNOUNCEMENT, usesDefault: true, updatedAt: null };
  const showCta = !!(cfg.ctaLabel.trim() && cfg.ctaHref.trim());

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
      className="fixed inset-0 z-[105] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="site-announcement-title"
      onClick={onRemindLater}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-violet-200/80 dark:border-violet-800/50 bg-white dark:bg-zinc-900 shadow-2xl p-5 sm:p-6"
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
          <div className="mb-4 rounded-full bg-violet-100 dark:bg-violet-900/40 p-3">
            <Megaphone className="h-7 w-7 text-violet-600 dark:text-violet-400" aria-hidden />
          </div>
          <h2 id="site-announcement-title" className="text-lg font-bold text-zinc-900 dark:text-zinc-100 pr-8">
            {cfg.title}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{cfg.body}</p>
        </div>

        <div className="mt-5 flex flex-col gap-2">
          {showCta && (
            <Button asChild className="w-full bg-violet-600 hover:bg-violet-700 text-white">
              <Link
                href={
                  cfg.ctaHref.startsWith("http://") || cfg.ctaHref.startsWith("https://") || cfg.ctaHref.startsWith("/")
                    ? cfg.ctaHref
                    : `/${cfg.ctaHref}`
                }
                onClick={onRemindLater}
              >
                {cfg.ctaLabel}
              </Link>
            </Button>
          )}
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

type HostProps = {
  blocked?: boolean;
};

/** Shows owner-managed site announcement modal for signed-in users. */
export function SiteAnnouncementHost({ blocked = false }: HostProps) {
  const { status } = useSession();
  const [open, setOpen] = useState(false);
  const [banner, setBanner] = useState<SiteAnnouncementBannerAdmin | null>(null);

  const closeLater = useCallback(() => {
    if (banner?.updatedAt) dismissSiteAnnouncementLater(banner.updatedAt);
    setOpen(false);
  }, [banner?.updatedAt]);

  const closePermanent = useCallback(() => {
    if (banner?.updatedAt) dismissSiteAnnouncementPermanent(banner.updatedAt);
    setOpen(false);
  }, [banner?.updatedAt]);

  useEffect(() => {
    if (status !== "authenticated" || blocked) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      fetch("/api/site-announcement-banner")
        .then((r) => r.json())
        .then((data: { success?: boolean; banner?: SiteAnnouncementBannerAdmin }) => {
          if (cancelled || !data.success || !data.banner) return;
          const b = data.banner;
          if (!shouldShowAnnouncement(b)) return;
          setBanner(b);
          setOpen(true);
        })
        .catch(() => {});
    }, 2000);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [status, blocked]);

  if (!banner) return null;

  return (
    <SiteAnnouncementModal open={open} banner={banner} onRemindLater={closeLater} onDismissPermanent={closePermanent} />
  );
}
