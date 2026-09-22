import {
  PLAY_STORE_GIVEAWAY,
  PLAY_STORE_URL,
  NOVASTARIS_SOCIAL,
} from "@/lib/app-distribution";

/** Owner blast: NovaStaris is live on Google Play + $250 USDC giveaway. */
export const PLAY_STORE_LAUNCH_EMAIL = {
  subject: "NovaStaris is on Google Play — download & enter to win $250 USDC",
  body: [
    "Hi there,",
    "",
    "NovaStaris is now live on the Google Play Store.",
    "",
    "Get the Android app:",
    PLAY_STORE_URL,
    "",
    `Download the app or create a free account on the web for a chance to win ${PLAY_STORE_GIVEAWAY.prizeLabel}.`,
    `Draw by ${PLAY_STORE_GIVEAWAY.drawLabel}. No credit card required to register.`,
    "",
    "Follow us:",
    `• Instagram @${NOVASTARIS_SOCIAL.instagram.handle} — ${NOVASTARIS_SOCIAL.instagram.url}`,
    `• TikTok @${NOVASTARIS_SOCIAL.tiktok.handle} — ${NOVASTARIS_SOCIAL.tiktok.url}`,
    `• X @${NOVASTARIS_SOCIAL.x.handle} — ${NOVASTARIS_SOCIAL.x.url}`,
    "",
    `Promo terms: ${PLAY_STORE_GIVEAWAY.promoTermsUrl}`,
    "",
    "Educational tools only — not financial advice.",
    "",
    "— The NovaStaris team",
  ].join("\n"),
  ctaLabel: "Get it on Google Play",
  ctaUrl: PLAY_STORE_URL,
} as const;
