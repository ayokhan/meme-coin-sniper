import { FEATURE_FLAG_KEYS, getFeatureFlag } from "@/lib/feature-flags";
import { getBlofinPartnerPromoForPublic, blofinPartnerRegisterPath } from "@/lib/blofin-partner-promo";
import { AFFILIATE_TERMS, REFERRAL_COMMISSION_RATE_PCT } from "@/lib/referral-program";

export type NjaKnowledgeTopic = {
  id: string;
  label: string;
  keywords: string[];
  reply: string;
};

const AFFILIATE_KEYWORDS = [
  "affiliate",
  "referral",
  "refer",
  "refer a friend",
  "commission",
  "referral link",
  "referral program",
  "earn 10%",
  "payout",
  "payouts",
];

const BLOFIN_KEYWORDS = [
  "blofin",
  "blo fin",
  "partner",
  "partnership",
  "register on blofin",
  "blofin api",
  "blofin keys",
  "transfer fee",
  "transfer fees",
];

function buildAffiliateReply(): string {
  const bullets = AFFILIATE_TERMS.bullets.map((b) => `• ${b}`).join("\n");
  return `NovaStaris Affiliate Program — earn ${REFERRAL_COMMISSION_RATE_PCT}% when friends subscribe to VIP.

How it works:
• Sign in and open Affiliate program from your account or menu (/affiliate).
• Share your unique referral link.
• When someone subscribes to VIP, you earn ${REFERRAL_COMMISSION_RATE_PCT}% commission after verification.
• ${AFFILIATE_TERMS.payoutNote}

Key terms:
${bullets}

Open Account → Billing → Affiliate, or visit /affiliate for your dashboard. Anything else I can help with?`;
}

function buildBlofinReply(promo: Awaited<ReturnType<typeof getBlofinPartnerPromoForPublic>>): string {
  const registerPath = blofinPartnerRegisterPath();
  const base = `NovaStaris partners with Blofin for futures trading and API-connected bots (Trading Bot, NovaScalper, Prop Firm).

`;
  if (promo.active) {
    return (
      base +
      `${promo.headline}
${promo.promoLabel ? `Member perk: ${promo.promoLabel}.` : ""}
${promo.bodyText}

To register: open Trading Bot or NovaScalper, use the partnership banner, or go to ${registerPath} while signed in. After your Blofin account is ready, save your API keys in NovaStaris under the bot settings.

Need help connecting keys? Ask about technical support.`
    );
  }
  return (
    base +
    `Register a Blofin account, then connect your API keys in NovaStaris under AI Trading Bots → Blofin keys (also NovaScalper and Prop Firm).

The in-app partnership register link may appear when NovaStaris enables the promo. Check Trading Bot or Account → Billing for updates.`
  );
}

export function matchesNjaTopic(text: string, topic: NjaKnowledgeTopic): boolean {
  const lower = text.trim().toLowerCase();
  return topic.keywords.some((k) => lower.includes(k));
}

export function findNjaTopicReply(text: string, topics: NjaKnowledgeTopic[]): string | null {
  for (const topic of topics) {
    if (matchesNjaTopic(text, topic)) return topic.reply;
  }
  return null;
}

export async function getNjaSupportKnowledge(): Promise<{
  affiliateEnabled: boolean;
  partnerPromosEnabled: boolean;
  topics: NjaKnowledgeTopic[];
}> {
  const [affiliateEnabled, partnerPromosEnabled, blofinPromo] = await Promise.all([
    getFeatureFlag(FEATURE_FLAG_KEYS.NJA_AFFILIATE_KNOWLEDGE),
    getFeatureFlag(FEATURE_FLAG_KEYS.NJA_PARTNER_PROMOS),
    getBlofinPartnerPromoForPublic(),
  ]);

  const topics: NjaKnowledgeTopic[] = [];

  if (affiliateEnabled) {
    topics.push({
      id: "affiliate",
      label: "Affiliate program",
      keywords: AFFILIATE_KEYWORDS,
      reply: buildAffiliateReply(),
    });
  }

  if (partnerPromosEnabled) {
    topics.push({
      id: "blofin-partnership",
      label: "Blofin partnership",
      keywords: BLOFIN_KEYWORDS,
      reply: buildBlofinReply(blofinPromo),
    });
  }

  return { affiliateEnabled, partnerPromosEnabled, topics };
}
