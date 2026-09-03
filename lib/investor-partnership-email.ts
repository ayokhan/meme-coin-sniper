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

Where we are
The product is live: VIP desk, AI bots, Nova Pulse, and partner rails with Blofin, Coinbase, TIOmarkets, and Vantage. We've prioritized building a serious platform over paid acquisition — so paid VIP is still early / pre-scale. The next chapter is distribution.

Why I'm reaching out
I'm looking for aligned partners and investors who understand fintech and go-to-market — people who can help turn a live product into subscribers through capital, intros, or distribution, not just a logo on a deck.

What NovaStaris offers
• AI-assisted workflows for futures, spot, and forex
• Bots that connect to the user's own exchange/broker (we do not custody funds)
• Live partner channels and marketing assets ready to push

What I'm seeking
• Strategic investment and/or partnership focused on growth
• Intros to operators, funds, or distribution partners who fit a pre-scale stage
• A short conversation if the thesis resonates

Near-term focus (next 90 days)
Measurable subscriber acquisition via partners, affiliates, and social — not vague "we'll be the next FOMO" claims. Happy to walk through the product and a concrete distribution plan under NDA.

Would you be open to a 20-minute call in the next two weeks?

P.S. If this isn't the right desk, I'd be grateful for a redirect to the appropriate partner or investments contact.

— Edit before send: replace {{FIRST_NAME}} with their name (or use “there”). Add each investor email manually under Recipients — do not blast your customer list.`,
} as const;
