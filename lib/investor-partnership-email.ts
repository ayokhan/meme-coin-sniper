/**
 * Investor / strategic partnership outreach — Admin → Emails preset.
 * Send to individually added recipients (not customer newsletter audiences).
 * Rich template adds NovaStaris banner logo + founder signature with logo mark.
 */

export const INVESTOR_PARTNERSHIP_EMAIL = {
  subject: "NovaStaris — partnership & investment introduction",
  ctaLabel: "Visit NovaStaris",
  ctaUrl: "https://novastaris.ai",
  body: `Dear {{FIRST_NAME}},

I hope this note finds you well.

I'm writing from NovaStaris (novastaris.ai) — an AI trading platform that helps traders analyze markets and automate execution across crypto futures, spot, and forex, while keeping funds in their own exchange or broker accounts.

Why I'm reaching out
We're building a serious product with live users, exchange partnerships (including Blofin, Coinbase, and TIOmarkets), and a clear path to scale. I'm looking for aligned partners and investors who understand fintech, AI, and capital markets — people who can add strategic value beyond capital alone.

What NovaStaris offers
• AI-assisted trading workflows for futures, spot, and forex
• Bots and tools that connect to the user's own exchange/broker (we do not custody funds)
• VIP product surface already in market, with partner distribution channels

What I'm seeking
• Strategic investment and/or partnership
• Introductions to operators, funds, or distribution partners who fit our stage
• A short conversation if the thesis resonates

If useful, I'm happy to share a one-pager, product walkthrough, and traction summary under NDA.

Would you be open to a 20-minute call in the next two weeks?

P.S. If this isn't the right desk, I'd be grateful for a redirect to the appropriate partner or investments contact.

— Edit before send: replace {{FIRST_NAME}} with their name (or use “there”). Add each investor email manually under Recipients — do not blast your customer list.`,
} as const;
