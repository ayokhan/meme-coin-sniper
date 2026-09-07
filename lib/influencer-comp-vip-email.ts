/**
 * Influencer / creator complimentary VIP outreach — Admin → Emails preset.
 * Send to individually added recipients (not customer newsletter audiences).
 * Rich template: NovaStaris banner + founder signature (Ayo Khan, MBA, PMP + logo).
 */

export const INFLUENCER_COMP_VIP_EMAIL = {
  subject: "{{HANDLE}} — complimentary NovaStaris VIP (creator partnership)",
  ctaLabel: "Create your free account",
  ctaUrl: "https://novastaris.ai/register",
  body: `Hi {{FIRST_NAME}},

I've been following your work on {{PLATFORM}} ({{HANDLE}}) — your takes on meme flow and crypto markets stand out.

I'm Ayo Khan, founder of NovaStaris (novastaris.ai) — an AI trading desk for meme hunting, wallet tracking, crypto futures, and forex. Traders keep funds on their own exchange or broker; we don't custody assets.

Complimentary VIP for you
I'd like to gift you full VIP access for {{VIP_DAYS}} days — no card, no catch — so you can use the same tools our paid members use:

• Go Hunting / Trending / Surge + AI meme analysis
• Wallet Tracker, Find Wallet, and Smart Money-style alerts
• Crypto Futures desks (NovaForecast, Pulse, and more)
• Nova Forex when you want FX / metals coverage

How to activate (2 steps)
1. Create a free account with your email (Google sign-in works too):
https://novastaris.ai/register

2. Reply to this email with that same address — I'll upgrade you to complimentary VIP within a day.

Why I'm reaching out
We're building with creators who already speak to traders. If NovaStaris fits your audience after you've tried it, I'd love to explore a light partnership later — walkthrough, affiliate, or brand endorsement. No pressure and no content ask up front.

If this isn't useful right now, a short “not for me” is appreciated so I don't follow up.

Would you be open to trying the desk this week?

— Edit before send: replace {{FIRST_NAME}}, {{HANDLE}}, {{PLATFORM}}, and {{VIP_DAYS}}. Add each creator under Recipients — do not blast your customer list. Rich send includes your name + NovaStaris logo signature automatically.`,
} as const;
