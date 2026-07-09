"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { BlofinPartnerPromoAdmin } from "@/lib/blofin-partner-promo";
import { blofinPartnerRegisterPath } from "@/lib/blofin-partner-promo";

type Props = {
  className?: string;
  compact?: boolean;
};

export function BlofinPartnerPromoBanner({ className = "", compact = false }: Props) {
  const [promo, setPromo] = useState<BlofinPartnerPromoAdmin | null>(null);

  useEffect(() => {
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
  }, []);

  if (!promo?.active) return null;

  return (
    <div
      className={`rounded-xl border border-cyan-500/25 bg-gradient-to-br from-cyan-950/40 via-zinc-950/80 to-emerald-950/30 p-4 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-center gap-3 mb-3">
        <Image src="/partners/novastaris-logo.svg" alt="NovaStaris" width={120} height={32} className="h-7 w-auto" />
        <span className="text-xs font-semibold text-cyan-300/80 uppercase tracking-widest">×</span>
        <Image src="/partners/blofin-logo.svg" alt="Blofin" width={120} height={32} className="h-7 w-auto" />
      </div>
      <div className={compact ? "space-y-2" : "space-y-3"}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-zinc-100">{promo.headline}</p>
            {!compact && <p className="text-xs text-zinc-400 mt-1 max-w-prose">{promo.bodyText}</p>}
          </div>
          {promo.promoLabel && (
            <span className="shrink-0 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
              {promo.promoLabel}
            </span>
          )}
        </div>
        <a
          href={blofinPartnerRegisterPath()}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-md bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold px-3 py-2 transition-colors"
        >
          {promo.ctaLabel}
        </a>
        {compact && <p className="text-[11px] text-zinc-500">Register first, then save your Blofin API keys below.</p>}
      </div>
    </div>
  );
}
