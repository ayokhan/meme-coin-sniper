import {
  FOREX_PARTNERSHIP_EMAIL,
  FOREX_PARTNER_REBATE_EMAIL,
  NOVA_FOREX_BOTS_LAUNCH_EMAIL,
} from "@/lib/forex-broker-partner-promo";
import { BLOFIN_PARTNERSHIP_EMAIL } from "@/lib/blofin-partner-promo";
import { AFFILIATE_PROGRAM_EMAIL } from "@/lib/referral-program";
import { WELCOME_EMAIL } from "@/lib/welcome-email";
import { VIP_SOFT_PITCH_EMAIL } from "@/lib/vip-pitch-email";
import { VIP_EXPIRY_POST_EMAIL, VIP_EXPIRY_PRE_EMAIL } from "@/lib/vip-expiry-email";
import {
  VIP_TRIAL_REMINDER_EMAIL_PRESET,
  buildVipTrialInviteEmail,
} from "@/lib/vip-trial";
import {
  PATH_DEEPDIVE_FOREX_EMAIL,
  PATH_DEEPDIVE_FUTURES_EMAIL,
  PATH_DEEPDIVE_MEME_EMAIL,
  PATH_DEEPDIVE_POLYMARKET_EMAIL,
  PATH_DEEPDIVE_WALLETS_EMAIL,
} from "@/lib/path-deepdive-emails";
import { buildStrategyCallEmail } from "@/lib/strategy-call";
import {
  buildPaidStrategyCallMarketingEmail,
  buildPaidStrategyCallScheduleEmail,
} from "@/lib/paid-strategy-call";
import type { AnnouncementEmailTemplate } from "@/lib/announcement-email";
import type { PartnerBrandEmail } from "@/lib/partner-logos-email";

export type AdminEmailFormat = "rich" | "plain";

export type AdminEmailPresetId =
  | "custom"
  | "welcome"
  | "deepdive-meme"
  | "deepdive-futures"
  | "deepdive-forex"
  | "deepdive-wallets"
  | "deepdive-polymarket"
  | "vip-soft-pitch"
  | "vip-trial-invite"
  | "vip-trial-ending"
  | "strategy-call"
  | "paid-strategy-call"
  | "paid-strategy-schedule"
  | "vip-expiry-pre"
  | "vip-expiry-post"
  | "affiliate"
  | "forex-rebate"
  | "forex-bots-launch"
  | "tio-partnership"
  | "vantage-partnership"
  | "assex-partnership"
  | "blofin-partnership";

export type AdminEmailPreset = {
  id: AdminEmailPresetId;
  label: string;
  blurb: string;
  subject: string;
  body: string;
  /** Used when format = rich */
  template: AnnouncementEmailTemplate;
  includePartnerLogos: boolean;
  partnerBrand: PartnerBrandEmail;
  ctaLabel: string;
  ctaUrl: string;
  /** Suggested audience when loading this preset */
  defaultAudience?: "newsletter" | "all" | "new" | "free" | "vip" | "inactive7d" | "trial" | "trial-expiring";
};

const FOREX_BOTS = "https://novastaris.ai/?tab=nova-forex-bot";
const FOREX_REBATE = `${FOREX_BOTS}#forex-partner-rebate`;
const AFFILIATE = "https://novastaris.ai/affiliate";
const START_HERE = "https://novastaris.ai/start-here";
const STRATEGY_CALL = buildStrategyCallEmail("");
const PAID_STRATEGY = buildPaidStrategyCallMarketingEmail();
const PAID_STRATEGY_SCHEDULE = buildPaidStrategyCallScheduleEmail();
const VIP_TRIAL_INVITE = buildVipTrialInviteEmail({
  trialDays: 2,
  reminderHoursBefore: 24,
  planLabel: "1 month",
  planPriceUsd: 150,
});

export const ADMIN_EMAIL_PRESETS: AdminEmailPreset[] = [
  {
    id: "welcome",
    label: "Welcome / Start here",
    blurb: "Day 0–1 — NovaStaris banner + path guide",
    subject: WELCOME_EMAIL.subject,
    body: WELCOME_EMAIL.body,
    template: "welcome",
    includePartnerLogos: false,
    partnerBrand: "blofin",
    ctaLabel: "Open Start here",
    ctaUrl: START_HERE,
    defaultAudience: "new",
  },
  {
    id: "deepdive-meme",
    label: "Deep-dive: Meme hunter",
    blurb: "Day 3–4 — Go Hunting + AI Agent",
    subject: PATH_DEEPDIVE_MEME_EMAIL.subject,
    body: PATH_DEEPDIVE_MEME_EMAIL.body,
    template: "nova-branded",
    includePartnerLogos: false,
    partnerBrand: "blofin",
    ctaLabel: PATH_DEEPDIVE_MEME_EMAIL.ctaLabel,
    ctaUrl: PATH_DEEPDIVE_MEME_EMAIL.ctaUrl,
    defaultAudience: "new",
  },
  {
    id: "deepdive-futures",
    label: "Deep-dive: Crypto futures",
    blurb: "Day 3–4 — chart AI on Crypto Futures",
    subject: PATH_DEEPDIVE_FUTURES_EMAIL.subject,
    body: PATH_DEEPDIVE_FUTURES_EMAIL.body,
    template: "nova-branded",
    includePartnerLogos: false,
    partnerBrand: "blofin",
    ctaLabel: PATH_DEEPDIVE_FUTURES_EMAIL.ctaLabel,
    ctaUrl: PATH_DEEPDIVE_FUTURES_EMAIL.ctaUrl,
    defaultAudience: "new",
  },
  {
    id: "deepdive-forex",
    label: "Deep-dive: Forex & metals",
    blurb: "Day 3–4 — Nova Forex + NovaQ on XAUUSD",
    subject: PATH_DEEPDIVE_FOREX_EMAIL.subject,
    body: PATH_DEEPDIVE_FOREX_EMAIL.body,
    template: "nova-branded",
    includePartnerLogos: false,
    partnerBrand: "blofin",
    ctaLabel: PATH_DEEPDIVE_FOREX_EMAIL.ctaLabel,
    ctaUrl: PATH_DEEPDIVE_FOREX_EMAIL.ctaUrl,
    defaultAudience: "new",
  },
  {
    id: "deepdive-wallets",
    label: "Deep-dive: Wallet tracking",
    blurb: "Day 3–4 — Wallet Tracker action",
    subject: PATH_DEEPDIVE_WALLETS_EMAIL.subject,
    body: PATH_DEEPDIVE_WALLETS_EMAIL.body,
    template: "nova-branded",
    includePartnerLogos: false,
    partnerBrand: "blofin",
    ctaLabel: PATH_DEEPDIVE_WALLETS_EMAIL.ctaLabel,
    ctaUrl: PATH_DEEPDIVE_WALLETS_EMAIL.ctaUrl,
    defaultAudience: "new",
  },
  {
    id: "deepdive-polymarket",
    label: "Deep-dive: Polymarket",
    blurb: "Day 3–4 — prediction markets pass",
    subject: PATH_DEEPDIVE_POLYMARKET_EMAIL.subject,
    body: PATH_DEEPDIVE_POLYMARKET_EMAIL.body,
    template: "nova-branded",
    includePartnerLogos: false,
    partnerBrand: "blofin",
    ctaLabel: PATH_DEEPDIVE_POLYMARKET_EMAIL.ctaLabel,
    ctaUrl: PATH_DEEPDIVE_POLYMARKET_EMAIL.ctaUrl,
    defaultAudience: "new",
  },
  {
    id: "vip-soft-pitch",
    label: "VIP soft pitch",
    blurb: "Day 7 — free users → soft upgrade (no hard sell)",
    subject: VIP_SOFT_PITCH_EMAIL.subject,
    body: VIP_SOFT_PITCH_EMAIL.body,
    template: "nova-branded",
    includePartnerLogos: false,
    partnerBrand: "blofin",
    ctaLabel: VIP_SOFT_PITCH_EMAIL.ctaLabel,
    ctaUrl: VIP_SOFT_PITCH_EMAIL.ctaUrl,
    defaultAudience: "free",
  },
  {
    id: "vip-trial-invite",
    label: "VIP trial invite (existing free users)",
    blurb: "Rich footer — card-required trial CTA for registered free users",
    subject: VIP_TRIAL_INVITE.subject,
    body: VIP_TRIAL_INVITE.body,
    template: "nova-branded",
    includePartnerLogos: false,
    partnerBrand: "blofin",
    ctaLabel: VIP_TRIAL_INVITE.ctaLabel,
    ctaUrl: VIP_TRIAL_INVITE.ctaUrl,
    defaultAudience: "free",
  },
  {
    id: "vip-trial-ending",
    label: "VIP trial ending reminder",
    blurb: "Manual send if cron fails — same copy as auto reminder",
    subject: VIP_TRIAL_REMINDER_EMAIL_PRESET.subject,
    body: VIP_TRIAL_REMINDER_EMAIL_PRESET.body,
    template: "nova-branded",
    includePartnerLogos: false,
    partnerBrand: "blofin",
    ctaLabel: VIP_TRIAL_REMINDER_EMAIL_PRESET.ctaLabel,
    ctaUrl: VIP_TRIAL_REMINDER_EMAIL_PRESET.ctaUrl,
    defaultAudience: "trial-expiring",
  },
  {
    id: "strategy-call",
    label: "Discovery call",
    blurb: "Complimentary walkthrough — Calendly booking link",
    subject: STRATEGY_CALL.subject,
    body: STRATEGY_CALL.body,
    template: "nova-branded",
    includePartnerLogos: false,
    partnerBrand: "blofin",
    ctaLabel: STRATEGY_CALL.ctaLabel,
    ctaUrl: STRATEGY_CALL.ctaUrl,
    defaultAudience: "free",
  },
  {
    id: "paid-strategy-call",
    label: "Strategy call ($200/hr)",
    blurb: "Paid expert session — Stripe purchase page",
    subject: PAID_STRATEGY.subject,
    body: PAID_STRATEGY.body,
    template: "nova-branded",
    includePartnerLogos: false,
    partnerBrand: "blofin",
    ctaLabel: PAID_STRATEGY.ctaLabel,
    ctaUrl: PAID_STRATEGY.ctaUrl,
    defaultAudience: "all",
  },
  {
    id: "paid-strategy-schedule",
    label: "Strategy call — schedule session",
    blurb: "After payment — ask customer for times (edit placeholders)",
    subject: PAID_STRATEGY_SCHEDULE.subject,
    body: PAID_STRATEGY_SCHEDULE.body,
    template: "nova-branded",
    includePartnerLogos: false,
    partnerBrand: "blofin",
    ctaLabel: PAID_STRATEGY_SCHEDULE.ctaLabel,
    ctaUrl: PAID_STRATEGY_SCHEDULE.ctaUrl,
  },
  {
    id: "vip-expiry-pre",
    label: "VIP expiry (pre — ends soon)",
    blurb: "Manual send ~3 days before VIP ends — also auto via cron",
    subject: VIP_EXPIRY_PRE_EMAIL.subject,
    body: VIP_EXPIRY_PRE_EMAIL.body,
    template: "nova-branded",
    includePartnerLogos: false,
    partnerBrand: "blofin",
    ctaLabel: VIP_EXPIRY_PRE_EMAIL.ctaLabel,
    ctaUrl: VIP_EXPIRY_PRE_EMAIL.ctaUrl,
    defaultAudience: "vip",
  },
  {
    id: "vip-expiry-post",
    label: "VIP expiry (post — has ended)",
    blurb: "Manual win-back after VIP ends — also auto via cron",
    subject: VIP_EXPIRY_POST_EMAIL.subject,
    body: VIP_EXPIRY_POST_EMAIL.body,
    template: "nova-branded",
    includePartnerLogos: false,
    partnerBrand: "blofin",
    ctaLabel: VIP_EXPIRY_POST_EMAIL.ctaLabel,
    ctaUrl: VIP_EXPIRY_POST_EMAIL.ctaUrl,
    defaultAudience: "free",
  },
  {
    id: "affiliate",
    label: "Affiliate program (10%)",
    blurb: "VIP referral — rich layout or plain for WhatsApp",
    subject: AFFILIATE_PROGRAM_EMAIL.subject,
    body: AFFILIATE_PROGRAM_EMAIL.body,
    template: "affiliate",
    includePartnerLogos: false,
    partnerBrand: "blofin",
    ctaLabel: "Get your referral link",
    ctaUrl: AFFILIATE,
  },
  {
    id: "forex-rebate",
    label: "$2/lot USDC rebate",
    blurb: "TIOmarkets rebate — rich layout or plain for WhatsApp",
    subject: FOREX_PARTNER_REBATE_EMAIL.subject,
    body: FOREX_PARTNER_REBATE_EMAIL.body,
    template: "forex-rebate",
    includePartnerLogos: true,
    partnerBrand: "tiomarkets",
    ctaLabel: "Open Nova Forex Bots",
    ctaUrl: FOREX_REBATE,
  },
  {
    id: "forex-bots-launch",
    label: "Nova Forex Bots launch",
    blurb: "Announce Forex Bot + Scalper",
    subject: NOVA_FOREX_BOTS_LAUNCH_EMAIL.subject,
    body: NOVA_FOREX_BOTS_LAUNCH_EMAIL.body,
    template: "default",
    includePartnerLogos: false,
    partnerBrand: "tiomarkets",
    ctaLabel: "Open Nova Forex Bots",
    ctaUrl: FOREX_BOTS,
  },
  {
    id: "tio-partnership",
    label: "TIOmarkets partnership",
    blurb: "Unlimited Leverage signup",
    subject: FOREX_PARTNERSHIP_EMAIL.tiomarkets.subject,
    body: FOREX_PARTNERSHIP_EMAIL.tiomarkets.body,
    template: "default",
    includePartnerLogos: true,
    partnerBrand: "tiomarkets",
    ctaLabel: "Open Nova Forex Bots",
    ctaUrl: FOREX_BOTS,
  },
  {
    id: "vantage-partnership",
    label: "Vantage partnership",
    blurb: "Vantage Markets signup",
    subject: FOREX_PARTNERSHIP_EMAIL.vantage.subject,
    body: FOREX_PARTNERSHIP_EMAIL.vantage.body,
    template: "default",
    includePartnerLogos: true,
    partnerBrand: "vantage",
    ctaLabel: "Open Nova Forex Bots",
    ctaUrl: FOREX_BOTS,
  },
  {
    id: "assex-partnership",
    label: "Assexmarkets partnership",
    blurb: "Assexmarkets signup",
    subject: FOREX_PARTNERSHIP_EMAIL.assexmarkets.subject,
    body: FOREX_PARTNERSHIP_EMAIL.assexmarkets.body,
    template: "default",
    includePartnerLogos: true,
    partnerBrand: "assexmarkets",
    ctaLabel: "Open Nova Forex Bots",
    ctaUrl: FOREX_BOTS,
  },
  {
    id: "blofin-partnership",
    label: "Blofin partnership",
    blurb: "Crypto futures partner signup",
    subject: BLOFIN_PARTNERSHIP_EMAIL.subject,
    body: BLOFIN_PARTNERSHIP_EMAIL.body,
    template: "default",
    includePartnerLogos: true,
    partnerBrand: "blofin",
    ctaLabel: "Open NovaStaris",
    ctaUrl: "https://novastaris.ai",
  },
];

export function getAdminEmailPreset(id: string | null | undefined): AdminEmailPreset | null {
  if (!id || id === "custom") return null;
  return ADMIN_EMAIL_PRESETS.find((p) => p.id === id) ?? null;
}

/** WhatsApp / Telegram / IG friendly plain text (subject + body). */
export function formatPlainShareText(subject: string, body: string): string {
  const s = subject.trim();
  const b = body.trim();
  if (!s) return b;
  if (!b) return s;
  return `${s}\n\n${b}`;
}
