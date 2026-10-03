/**
 * Public distribution URLs — Google Play + social (site, emails, postcards).
 */
export const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=ai.novastaris.app";

/**
 * versionCode of the newest Android build fully rolled out on Google Play. Older app installs see an
 * "update available" banner. Bump only after the Play rollout is published, or users get sent to an update
 * that isn't there yet.
 */
export const LATEST_ANDROID_VERSION_CODE = 6;

/** Official Google Play badge (hosted by Google). */
export const PLAY_STORE_BADGE_IMG =
  "https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png";

export const NOVASTARIS_SOCIAL = {
  instagram: {
    handle: "Novastaris",
    url: "https://www.instagram.com/novastaris/",
  },
  tiktok: {
    handle: "novastaris.ai",
    url: "https://www.tiktok.com/@novastaris.ai",
  },
  x: {
    handle: "Novastaris",
    url: "https://x.com/Novastaris",
  },
} as const;

export const PLAY_STORE_GIVEAWAY = {
  prizeLabel: "250 USDC",
  drawLabel: "October 31",
  registerUrl: "https://novastaris.ai/register",
  promoTermsUrl: "https://novastaris.ai/promo-terms",
} as const;

/** Short store listing blurb (Play Console — no AAB needed to update). */
export const PLAY_STORE_SHORT_DESCRIPTION =
  "Your AI trading intelligence for crypto memes, forex, futures & prediction markets";
