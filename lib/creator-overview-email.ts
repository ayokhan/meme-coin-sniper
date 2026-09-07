/**
 * Creator / celebrity overview after Instagram interest — Admin → Emails.
 * Use founder-signed rich layout (NovaStaris banner + Ayo Khan signature).
 * Send to individually added recipients only.
 */

export const CREATOR_OVERVIEW_EMAIL = {
  subject: "NovaStaris overview — for {{FIRST_NAME}}",
  ctaLabel: "Explore NovaStaris",
  ctaUrl: "https://novastaris.ai",
  body: `Hi {{FIRST_NAME}},

Thank you again for replying on Instagram — glad to share a short overview of NovaStaris.

What NovaStaris is
NovaStaris (novastaris.ai) is an AI trading platform that helps people trade smarter across:

• Meme coins — discovery, trending, surge, and AI analysis
• Wallet tracking — follow smart money and find trader wallets
• Crypto futures — forecasts, pulse desks, and trading bots
• Forex & metals — market watch and bot tools

Important: users keep their funds on their own exchange or broker. NovaStaris does not hold customer money — we provide the intelligence and tools.

Who it’s for
Traders who want an all-in-one desk, and creators who want a modern fintech product their audience can actually use.

What I’m proposing
I’d love for you to see whether NovaStaris is a fit to promote or advertise to your audience. That can be as simple as:

1. A short written overview (this email)
2. Optional — a 15–20 minute walkthrough when your schedule allows
3. If you like the product — complimentary VIP access so you (or your team) can explore the platform
4. If we partner — a unique referral / affiliate link (standard program: 10% of VIP subscriptions from your referrals), plus any paid content terms we’d agree separately

No rush on the walkthrough. If email is easier, reply with any questions and I’ll answer here.

Next step
Reply with the email address you’d like me to use for VIP (if you want access), or tell me if you’d prefer a short call/demo later. Happy to work around your schedule.

Looking forward to your thoughts.

— Edit before send: replace {{FIRST_NAME}}. Add her email under Recipients. Rich send adds Ayo Khan, MBA, PMP + logo automatically.`,
} as const;
