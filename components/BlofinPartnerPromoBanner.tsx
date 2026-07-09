"use client";

import { useEffect, useState } from "react";
import { blofinPartnerRegisterPath } from "@/lib/blofin-partner-promo";
import { PartnerLogosStrip } from "@/components/PartnerLogosStrip";

type PromoView = {
  active?: boolean;
  headline: string;
  bodyText: string;
  promoLabel: string;
  ctaLabel: string;
  showLogosInBanner?: boolean;
};

type Props = {
  className?: string;
  compact?: boolean;
  /** Admin preview — bypasses live API fetch. */
  preview?: PromoView | null;
};

export function BlofinPartnerPromoBanner({ className = "", compact = false, preview = null }: Props) {
  const [promo, setPromo] = useState<PromoView | null>(preview);

  useEffect(() => {
    if (preview) {
      setPromo(preview);
      return;
    }
    let cancelled = false;
    fetch("/api/blofin-partner-promo", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.success && data.promo?.active) setPromo(data.promo);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [preview]);

  if (!promo?.active && !preview) return null;
  if (!preview && !promo) return null;

  const view = promo!;
  const showLogos = view.showLogosInBanner !== false;

  return (
    <div
      className={`rounded-xl border border-cyan-500/25 bg-gradient-to-br from-cyan-950/40 via-zinc-950/80 to-emerald-950/30 p-4 ${className}`}
    >
      {showLogos && <PartnerLogosStrip className="mb-3" />}
      <div className={compact ? "space-y-2" : "space-y-3"}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-zinc-100">{view.headline}</p>
            {!compact && <p className="text-xs text-zinc-400 mt-1 max-w-prose">{view.bodyText}</p>}
          </div>
          {view.promoLabel && (
            <span className="shrink-0 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
              {view.promoLabel}
            </span>
          )}
        </div>
        {!preview && (
          <a
            href={blofinPartnerRegisterPath()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-md bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold px-3 py-2 transition-colors"
          >
            {view.ctaLabel}
          </a>
        )}
        {preview && (
          <span className="inline-flex items-center justify-center rounded-md bg-cyan-600/80 text-white text-xs font-semibold px-3 py-2">
            {view.ctaLabel}
          </span>
        )}
        {compact && <p className="text-[11px] text-zinc-500">Register first, then save your Blofin API keys below.</p>}
      </div>
    </div>
  );
}
