/** Cookie name for referral code captured from ?ref= links (30-day attribution). */
export const REFERRAL_COOKIE_NAME = "novastaris_ref";
export const REFERRAL_COOKIE_MAX_AGE_DAYS = 30;

export const REFERRAL_COMMISSION_RATE_PCT = 10;

export const REFERRAL_COMMISSION_STATUS = {
  PENDING: "pending_verification",
  PAID: "paid",
} as const;

export type ReferralCommissionStatus =
  (typeof REFERRAL_COMMISSION_STATUS)[keyof typeof REFERRAL_COMMISSION_STATUS];

export const AFFILIATE_TERMS = {
  title: "NovaStaris Affiliate Program — Terms",
  bullets: [
    "Earn 10% of the VIP subscription fee when someone you refer subscribes to VIP on NovaStaris.",
    "The referred customer must have completed payment and must not have requested a refund or chargeback.",
    "Commissions start as Pending verification until NovaStaris confirms the subscription is valid.",
    "Payouts are processed weekly, every Friday, for all commissions marked as paid by NovaStaris.",
    "Self-referrals, fraudulent sign-ups, or abuse of the program may result in forfeited commissions.",
    "NovaStaris may update these terms; continued participation constitutes acceptance of the current terms.",
  ],
  payoutNote: "Payouts are sent weekly on Fridays after your commission is verified and marked paid.",
} as const;

export function referralRegisterPath(code: string): string {
  return `/register?ref=${encodeURIComponent(code)}`;
}

export function referralLinkForCode(code: string, origin?: string): string {
  const base = (origin ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://novastaris.ai").replace(/\/$/, "");
  return `${base}${referralRegisterPath(code)}`;
}

export function normalizeReferralCode(raw: string | null | undefined): string | null {
  const code = String(raw ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9]/g, "");
  if (!code || code.length < 4 || code.length > 24) return null;
  return code;
}

export function formatReferralStatus(status: string): string {
  if (status === REFERRAL_COMMISSION_STATUS.PAID) return "Paid";
  if (status === REFERRAL_COMMISSION_STATUS.PENDING) return "Pending verification";
  return status;
}

export function commissionAmountFromSubscription(amountUsd: number, ratePct = REFERRAL_COMMISSION_RATE_PCT): number {
  return Math.round(amountUsd * (ratePct / 100) * 100) / 100;
}

/** Next Friday 00:00 local (for display). */
export function nextFridayLabel(now = new Date()): string {
  const d = new Date(now);
  const day = d.getDay();
  const daysUntilFriday = (5 - day + 7) % 7 || 7;
  d.setDate(d.getDate() + daysUntilFriday);
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}
