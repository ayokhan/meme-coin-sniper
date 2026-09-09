/**
 * One-shot: enable VIP Strategy Session promo site announcement.
 * Run: npx tsx scripts/enable-vip-strategy-session-banner.ts
 */
import { setSiteAnnouncementBanner } from "../lib/site-announcement-banner";
import { VIP_STRATEGY_SESSION_BANNER } from "../lib/vip-strategy-session-promo";

async function main() {
  const banner = await setSiteAnnouncementBanner({ ...VIP_STRATEGY_SESSION_BANNER, enabled: true });
  console.log("VIP strategy session announcement enabled:", banner.title);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
