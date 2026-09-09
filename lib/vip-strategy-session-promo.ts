/**
 * VIP Strategy Session promo — through end of December.
 * Flag: vip_strategy_session_promo. Hard end date still gates even if flag left ON.
 */
import { getFeatureFlag, FEATURE_FLAG_KEYS } from "@/lib/feature-flags";
import type { SiteAnnouncementBannerConfig } from "@/lib/site-announcement-banner";

const APP_ORIGIN = (process.env.NEXT_PUBLIC_APP_URL ?? "https://novastaris.ai").replace(/\/$/, "");

/** Inclusive through Dec 31, 2026 (America/New_York end of day → Jan 1 2027 05:00 UTC). */
export const VIP_STRATEGY_SESSION_PROMO_ENDS_AT = new Date("2027-01-01T05:00:00.000Z");

export const VIP_STRATEGY_SESSION_SUBSCRIBE_URL = `${APP_ORIGIN}/subscribe`;

export const VIP_STRATEGY_SESSION_PROMO_COPY = {
  title: "VIP promo through Dec 31: free 30-min strategy session",
  shortBlurb:
    "Subscribe to VIP and get one free 30-minute strategy session with an experienced coach. Book within 7 days of subscribe. After your session, if you’re not satisfied you can cancel VIP within 3 days for a 100% refund of the subscription fee. Not a trading profit guarantee.",
  sessionLengthMins: 30,
  bookWithinDays: 7,
  refundWithinDaysAfterSession: 3,
} as const;

/** Site announcement preset (Admin → Banners). Only one announcement is live at a time. */
export const VIP_STRATEGY_SESSION_BANNER: SiteAnnouncementBannerConfig = {
  enabled: true,
  title: VIP_STRATEGY_SESSION_PROMO_COPY.title,
  body: [
    "New VIP includes a free 30-minute strategy session with one of our experienced coaches.",
    "",
    `Book your session within ${VIP_STRATEGY_SESSION_PROMO_COPY.bookWithinDays} days of subscribe.`,
    `After the session, cancel within ${VIP_STRATEGY_SESSION_PROMO_COPY.refundWithinDaysAfterSession} days for a 100% refund of your VIP fee if you’re not satisfied.`,
    "",
    "This is a satisfaction guarantee after your coaching session — not a promise you will profit in the markets.",
    "Educational only — not financial advice.",
  ].join("\n"),
  ctaLabel: "See VIP plans",
  ctaHref: "/subscribe",
  showPartnerLogos: false,
  partnerBrand: "blofin",
};

export function isVipStrategySessionPromoInDateWindow(now = new Date()): boolean {
  return now.getTime() < VIP_STRATEGY_SESSION_PROMO_ENDS_AT.getTime();
}

/** Flag ON and before end date. */
export async function isVipStrategySessionPromoActive(now = new Date()): Promise<boolean> {
  if (!isVipStrategySessionPromoInDateWindow(now)) return false;
  return getFeatureFlag(FEATURE_FLAG_KEYS.VIP_STRATEGY_SESSION_PROMO);
}

export function vipStrategySessionPromoPublicPayload(active: boolean) {
  return {
    active,
    endsAt: VIP_STRATEGY_SESSION_PROMO_ENDS_AT.toISOString(),
    title: VIP_STRATEGY_SESSION_PROMO_COPY.title,
    shortBlurb: VIP_STRATEGY_SESSION_PROMO_COPY.shortBlurb,
    sessionLengthMins: VIP_STRATEGY_SESSION_PROMO_COPY.sessionLengthMins,
    bookWithinDays: VIP_STRATEGY_SESSION_PROMO_COPY.bookWithinDays,
    refundWithinDaysAfterSession: VIP_STRATEGY_SESSION_PROMO_COPY.refundWithinDaysAfterSession,
    subscribeUrl: VIP_STRATEGY_SESSION_SUBSCRIBE_URL,
  };
}
