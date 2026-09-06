/**
 * Influencer / creator complimentary VIP outreach — Admin → Emails preset.
 * Send to individually added recipients (not customer newsletter audiences).
 * Rich template: NovaStaris banner + founder signature.
 */

export const INFLUENCER_COMP_VIP_EMAIL = {
  subject: "{{HANDLE}} — complimentary NovaStaris VIP (creator partnership)",
  ctaLabel: "Claim your complimentary VIP",
  ctaUrl: "https://novastaris.ai",
  body: `Hi {{FIRST_NAME}},

I've been following your work on {{PLATFORM}} ({{HANDLE}}) — your takes on meme flow and crypto markets stand out.

I'm Ayo, founder of NovaStaris (novastaris.ai) — an AI trading desk for meme hunting, wallet tracking, crypto futures, and forex. Traders keep funds on their own exchange/broker; we don't custody.

Complimentary VIP for you
I'd like to gift you full VIP access for {{VIP_DAYS}} days — no card, no catch — so you can use the same tools our paid members use:

• Go Hunting / Trending / Surge + AI meme analysis
• Wallet Tracker, Find Wallet, Smart Money-style alerts
• Crypto Futures desks (NovaForecast, Pulse, and more)
• Nova Forex when you want FX / metals coverage

Claim / activate:
{{CLAIM_URL}}

Or reply to this email with the address you want VIP on, and I'll enable it manually within a day.

Why I'm reaching out
We're building distribution with creators who already speak to traders. If NovaStaris fits your audience, I'd love to explore a light partnership later — sponsored walkthrough, affiliate, or brand endorsement — only if the product earns it after you've used it. No pressure and no content ask up front.

If VIP isn't useful right now, no worries — a short “not for me” is appreciated so I don't follow up.

Would you be open to trying the desk this week?

— Edit before send: replace {{FIRST_NAME}}, {{HANDLE}}, {{PLATFORM}}, {{VIP_DAYS}}, and {{CLAIM_URL}}. Add each creator email under Recipients — do not blast your customer list.`,
} as const;
