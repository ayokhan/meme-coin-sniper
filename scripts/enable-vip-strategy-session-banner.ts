/**
 * One-shot: enable VIP Strategy Session promo site announcement (uses admin end date).
 * Run: npx tsx scripts/enable-vip-strategy-session-banner.ts
 */
import { setSiteAnnouncementBanner } from "../lib/site-announcement-banner";
import {
  buildVipStrategySessionBanner,
  getVipStrategySessionPromoConfig,
} from "../lib/vip-strategy-session-promo";

async function main() {
  const config = await getVipStrategySessionPromoConfig();
  const banner = await setSiteAnnouncementBanner({
    ...buildVipStrategySessionBanner(config.endsOnDate),
    enabled: true,
  });
  console.log("VIP strategy session announcement enabled:", banner.title, "ends", config.endsOnDate);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
