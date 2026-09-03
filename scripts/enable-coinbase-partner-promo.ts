/**
 * One-shot: enable Coinbase partner promo with referral link in the DB.
 * Run: npx tsx scripts/enable-coinbase-partner-promo.ts
 */
import "dotenv/config";
import { setCoinbasePartnerPromo, DEFAULT_COINBASE_PARTNER_PROMO } from "../lib/coinbase-partner-promo";

async function main() {
  const promo = await setCoinbasePartnerPromo({
    enabled: true,
    registerUrl: DEFAULT_COINBASE_PARTNER_PROMO.registerUrl,
    headline: DEFAULT_COINBASE_PARTNER_PROMO.headline,
    bodyText: DEFAULT_COINBASE_PARTNER_PROMO.bodyText,
    promoLabel: DEFAULT_COINBASE_PARTNER_PROMO.promoLabel,
    ctaLabel: DEFAULT_COINBASE_PARTNER_PROMO.ctaLabel,
    referralCode: DEFAULT_COINBASE_PARTNER_PROMO.referralCode,
    showLogosInBanner: true,
    includeLogosInEmail: true,
    includeLogosInBroadcast: true,
  });
  console.log("Coinbase partner promo updated:", {
    active: promo.active,
    enabled: promo.enabled,
    registerUrl: promo.registerUrl,
    referralCode: promo.referralCode,
    ctaLabel: promo.ctaLabel,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
