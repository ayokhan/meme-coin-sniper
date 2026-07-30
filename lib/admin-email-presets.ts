import {
  FOREX_PARTNERSHIP_EMAIL,
  FOREX_PARTNER_REBATE_EMAIL,
  NOVA_FOREX_BOTS_LAUNCH_EMAIL,
} from "@/lib/forex-broker-partner-promo";
import { BLOFIN_PARTNERSHIP_EMAIL } from "@/lib/blofin-partner-promo";
import { AFFILIATE_PROGRAM_EMAIL } from "@/lib/referral-program";
import type { AnnouncementEmailTemplate } from "@/lib/announcement-email";
import type { PartnerBrandEmail } from "@/lib/partner-logos-email";

export type AdminEmailFormat = "rich" | "plain";

export type AdminEmailPresetId =
  | "custom"
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
};

const FOREX_BOTS = "https://novastaris.ai/?tab=nova-forex-bot";
const FOREX_REBATE = `${FOREX_BOTS}#forex-partner-rebate`;
const AFFILIATE = "https://novastaris.ai/affiliate";

export const ADMIN_EMAIL_PRESETS: AdminEmailPreset[] = [
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
