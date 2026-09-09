const APP_ORIGIN = (process.env.NEXT_PUBLIC_APP_URL ?? "https://novastaris.ai").replace(/\/$/, "");
export const VIP_STRATEGY_SESSION_SUBSCRIBE_URL = `${APP_ORIGIN}/subscribe`;

/** Broadcast / announcement — load in Admin → Emails. */
export const VIP_STRATEGY_SESSION_LAUNCH_EMAIL = {
  subject: "VIP through Dec 31: free 30-min strategy session + satisfaction refund",
  body: `Hi there,

Through December 31, every new VIP subscription includes a free 30-minute strategy session with one of our experienced coaches.

How it works
1. Subscribe to VIP at novastaris.ai/subscribe
2. Book your strategy session within 7 days of subscription (we'll email you available times)
3. After your session, if you're not satisfied you can cancel VIP within 3 days for a 100% refund of the subscription fee

See Payment Terms for full details. Educational only — not financial advice.

See VIP plans:
${VIP_STRATEGY_SESSION_SUBSCRIBE_URL}

Questions? Use Chat or Support in the app at novastaris.ai — or reply to this email.

— The NovaStaris team
https://novastaris.ai`,
  ctaLabel: "See VIP plans",
  ctaUrl: VIP_STRATEGY_SESSION_SUBSCRIBE_URL,
};

/**
 * Owner follow-up after paid VIP — send individually with customer email under Recipients.
 * Replace {{FIRST_NAME}} / times as needed.
 */
export const VIP_STRATEGY_SESSION_BOOKING_EMAIL = {
  subject: "Book your free 30-min VIP strategy session",
  body: `Hi {{FIRST_NAME}},

Thank you for going VIP — your subscription includes one free 30-minute strategy session with one of our experienced coaches.

Please reply with 2–3 time windows that work for you (include your timezone). We’ll confirm a slot.

Please book within 7 days of your VIP subscription.

After the session, if you’re not satisfied you may cancel VIP within 3 days for a 100% refund of the subscription fee. See Payment Terms for full details.

Looking forward to working with you.

— Ayo Khan, MBA, PMP
Founder, NovaStaris
https://novastaris.ai`,
  ctaLabel: "Open NovaStaris",
  ctaUrl: APP_ORIGIN,
};
