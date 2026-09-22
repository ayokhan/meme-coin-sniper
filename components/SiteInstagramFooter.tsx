"use client";

import { useEffect, useState } from "react";
import { Instagram } from "lucide-react";
import {
  DEFAULT_ENTER_LANDING,
  formatPublicInstagramFooterLabel,
  type EnterLandingConfig,
} from "@/lib/enter-landing";
import { NOVASTARIS_SOCIAL, PLAY_STORE_URL } from "@/lib/app-distribution";
import GooglePlayDownloadLink from "@/components/GooglePlayDownloadLink";

/** Quiet social + Play Store links for public page footers. */
export default function SiteInstagramFooter({ className = "" }: { className?: string }) {
  const [ig, setIg] = useState<EnterLandingConfig["instagram"] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/public/enter-landing", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.success && data.landing?.instagram) {
          setIg(data.landing.instagram as EnterLandingConfig["instagram"]);
        } else {
          setIg(DEFAULT_ENTER_LANDING.instagram);
        }
      })
      .catch(() => {
        if (!cancelled) setIg(DEFAULT_ENTER_LANDING.instagram);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const showIg = ig && ig.enabled && ig.showOnPublicFooters;
  const label = showIg ? formatPublicInstagramFooterLabel(ig) : null;

  return (
    <div
      className={`mt-auto border-t border-zinc-200/80 dark:border-zinc-800/80 pt-6 pb-8 ${className}`}
    >
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {showIg && label && (
            <a
              href={ig.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-zinc-500 transition-colors hover:text-zinc-800 dark:text-zinc-500 dark:hover:text-zinc-300"
            >
              <Instagram className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>{label}</span>
            </a>
          )}
          <a
            href={NOVASTARIS_SOCIAL.tiktok.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-500 transition-colors hover:text-zinc-800 dark:hover:text-zinc-300"
          >
            TikTok @{NOVASTARIS_SOCIAL.tiktok.handle}
          </a>
          <a
            href={NOVASTARIS_SOCIAL.x.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-500 transition-colors hover:text-zinc-800 dark:hover:text-zinc-300"
          >
            X @{NOVASTARIS_SOCIAL.x.handle}
          </a>
          <a
            href={PLAY_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-500 transition-colors hover:text-cyan-600 dark:hover:text-cyan-400"
          >
            Google Play
          </a>
        </div>
        <GooglePlayDownloadLink variant="compact" className="sm:ml-auto" />
      </div>
    </div>
  );
}
