/**
 * Generic founder-signed email — Admin → Emails.
 * Blank canvas for any outreach; rich HTML adds NovaStaris banner + Ayo Khan signature.
 */

export const FOUNDER_SIGNED_EMAIL = {
  subject: "",
  ctaLabel: "Visit NovaStaris",
  ctaUrl: "https://novastaris.ai",
  body: `Hi {{FIRST_NAME}},

[Write your message here.]

Looking forward to hearing from you.

— Tip: Keep Rich email on. Your name (Ayo Khan, MBA, PMP) and NovaStaris logo are added automatically at the bottom. CTA button is optional — clear Button text to hide it.`,
} as const;
