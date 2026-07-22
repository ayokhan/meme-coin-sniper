"use client";

import { useEffect, useState } from "react";
import { forexBrokerPartnerRegisterPath } from "@/lib/forex-broker-partner-promo";
import type { ForexBrokerId } from "@/lib/forex-broker-user-config";
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
  broker: ForexBrokerId;
  className?: string;
  compact?: boolean;
  /** Admin preview — bypasses live API fetch. */
  preview?: PromoView | null;
};

export function ForexBrokerPartnerPromoBanner({ broker, className = "", compact = false, preview = null }: Props) {
  const [fetchedPromo, setFetchedPromo] = useState<PromoView | null>(null);
  const promo = preview ?? fetchedPromo;

  useEffect(() => {
    if (preview) return;
    let cancelled = false;
    fetch(`/api/forex-broker-partner-promo?broker=${broker}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.success && data.promo?.active) setFetchedPromo(data.promo);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [preview, broker]);

  if (!promo?.active && !preview) return null;
  if (!preview && !promo) return null;

  const view = promo!;
  const showLogos = view.showLogosInBanner !== false;

  return (
    <div
      className={`rounded-xl border border-emerald-500/25 bg-gradient-to-br from-emerald-950/40 via-zinc-950/80 to-cyan-950/30 p-4 ${className}`}
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
            href={forexBrokerPartnerRegisterPath(broker)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-2 transition-colors"
          >
            {view.ctaLabel}
          </a>
        )}
        {preview && (
          <span className="inline-flex items-center justify-center rounded-md bg-emerald-600/80 text-white text-xs font-semibold px-3 py-2">
            {view.ctaLabel}
          </span>
        )}
        {compact && <p className="text-[11px] text-zinc-500">Register first, then connect your MT4/MT5 login below.</p>}
      </div>
    </div>
  );
}
