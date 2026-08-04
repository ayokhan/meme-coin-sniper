"use client";

import { useEffect, useState } from "react";
import { forexBrokerPartnerRegisterPath } from "@/lib/forex-broker-partner-promo";
import {
  isForexPartnerBrokerId,
  type ForexBrokerId,
  type ForexPartnerBrokerId,
} from "@/lib/forex-broker-user-config";
import { brokerOffersPartnerRebate } from "@/lib/forex-partner-rebates";
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
  const [loading, setLoading] = useState(false);
  const promo = preview ?? fetchedPromo;
  const partnerBroker: ForexPartnerBrokerId | null = isForexPartnerBrokerId(broker) ? broker : null;
  const hasRebate = partnerBroker != null && brokerOffersPartnerRebate(partnerBroker);

  useEffect(() => {
    if (preview || !partnerBroker) {
      setFetchedPromo(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    // Clear immediately so Vantage never keeps showing TIO copy (and vice versa).
    setFetchedPromo(null);
    setLoading(true);
    fetch(`/api/forex-broker-partner-promo?broker=${partnerBroker}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.success && data.promo?.active) setFetchedPromo(data.promo);
        else setFetchedPromo(null);
      })
      .catch(() => {
        if (!cancelled) setFetchedPromo(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [preview, partnerBroker]);

  if (!partnerBroker) return null;
  if (preview) {
    /* keep preview path below */
  } else if (loading) {
    return null;
  } else if (!promo?.active) {
    return null;
  }

  if (!preview && !promo) return null;

  const view = promo!;
  const showLogos = view.showLogosInBanner !== false;

  return (
    <div
      className={`rounded-xl border border-emerald-500/25 bg-gradient-to-br from-emerald-950/40 via-zinc-950/80 to-cyan-950/30 p-4 ${className}`}
    >
      {showLogos && <PartnerLogosStrip className="mb-3" partner={partnerBroker} />}
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
          <div className="flex flex-wrap gap-2">
            <a
              href={forexBrokerPartnerRegisterPath(partnerBroker)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-2 transition-colors"
            >
              {view.ctaLabel}
            </a>
            {hasRebate && (
              <a
                href="#forex-partner-rebate"
                className="inline-flex items-center justify-center rounded-md border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-200 text-xs font-semibold px-3 py-2 transition-colors"
              >
                Submit $2/lot rebate details
              </a>
            )}
          </div>
        )}
        {preview && (
          <span className="inline-flex items-center justify-center rounded-md bg-emerald-600/80 text-white text-xs font-semibold px-3 py-2">
            {view.ctaLabel}
          </span>
        )}
        {compact && hasRebate && (
          <p className="text-[11px] text-zinc-500">
            Register first, connect MT4/MT5 below, then submit rebate details for $2 USDC per lot.
          </p>
        )}
        {compact && !hasRebate && (
          <p className="text-[11px] text-zinc-500">
            Register through NovaStaris (if linked), then connect MT4/MT5 below. No lot rebate on this broker.
          </p>
        )}
      </div>
    </div>
  );
}
