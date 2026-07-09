/**
 * Enable Blofin partnership in-app broadcast (Admin → Banners preset).
 * Run: npx tsx scripts/enable-blofin-partnership-banner.ts
 */
import { setSiteAnnouncementBanner } from "../lib/site-announcement-banner";
import { BLOFIN_PARTNERSHIP_LAUNCH_BANNER } from "../lib/blofin-partner-promo";

async function main() {
  const banner = await setSiteAnnouncementBanner({ ...BLOFIN_PARTNERSHIP_LAUNCH_BANNER, enabled: true });
  console.log("Site announcement updated:", banner.title);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
