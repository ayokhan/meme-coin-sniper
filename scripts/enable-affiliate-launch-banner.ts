/**
 * One-shot: enable the affiliate launch site announcement (dismissible modal).
 * Run: npx tsx scripts/enable-affiliate-launch-banner.ts
 */
import { setSiteAnnouncementBanner } from "../lib/site-announcement-banner";
import { AFFILIATE_LAUNCH_BANNER } from "../lib/referral-program";

async function main() {
  const banner = await setSiteAnnouncementBanner({ ...AFFILIATE_LAUNCH_BANNER, enabled: true });
  console.log("Affiliate launch announcement enabled:", banner.title);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
