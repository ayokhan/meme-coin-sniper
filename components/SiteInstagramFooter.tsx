"use client";

import { useEffect, useState } from "react";
import { Instagram } from "lucide-react";
import {
  DEFAULT_ENTER_LANDING,
  formatPublicInstagramFooterLabel,
  type EnterLandingConfig,
} from "@/lib/enter-landing";

/** Quiet Instagram follow link for public page footers (no marquee). */
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

  if (!ig || !ig.enabled || !ig.showOnPublicFooters) return null;

  const label = formatPublicInstagramFooterLabel(ig);

  return (
    <div
      className={`mt-auto border-t border-zinc-200/80 dark:border-zinc-800/80 pt-6 pb-8 ${className}`}
    >
      <a
        href={ig.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs text-zinc-500 transition-colors hover:text-zinc-800 dark:text-zinc-500 dark:hover:text-zinc-300"
      >
        <Instagram className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>{label}</span>
      </a>
    </div>
  );
}
