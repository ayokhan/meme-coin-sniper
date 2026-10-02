const APP_ORIGIN = (process.env.NEXT_PUBLIC_APP_URL ?? "https://novastaris.ai").replace(/\/$/, "");
const SUBSCRIBE_PRO_URL = `${APP_ORIGIN}/subscribe?plan=pro`;
const PAYMENT_TERMS_URL = `${APP_ORIGIN}/payment-terms`;

export type NovaProLaunchEmailInput = {
  monthlyUsdc?: number;
  cardFee?: number;
  sharedDailyLimit?: number;
  pulseDailyLimit?: number;
  foundingSeats?: number;
  refundMaxRuns?: number;
};

export function buildNovaProLaunchEmail(input: NovaProLaunchEmailInput = {}) {
  const usdc = input.monthlyUsdc ?? 50;
  const fee = input.cardFee ?? 8;
  const card = usdc + fee;
  const ai = input.sharedDailyLimit ?? 7;
  const pulse = input.pulseDailyLimit ?? 5;
  const seats = input.foundingSeats ?? 100;
  const refundRuns = input.refundMaxRuns ?? 2;
  return {
    subject: `Introducing Nova Pro — VIP-level AI desks from $${usdc}/month (first ${seats} lock the price)`,
    body: `Hi {{FIRST_NAME}},

Nova Pro is here: the same AI desks our VIP members use every day, at a price built for focused traders.

What you get with Nova Pro
• Every VIP AI desk: NovaStaris AI Agent, NovaForecast, Nova Forex Agent, NovaQ, Nova+, Wallet Tracker, Meme Intelligence, Crypto Narratives, Nova Eagle and more
• ${ai} AI runs per day, shared across all desks
• ${pulse} Nova Pulse runs per day
• Upgrade to VIP anytime: your unused Pro days are credited

Pricing
• $${card}/month by card — or $${usdc} with USDC (save $${fee})
• 6 months: 1 month free
• 12 months: 2 months free

Limited edition: Founding Pro
The first ${seats} subscribers become Founding members — a Founding badge on your account and today's price locked for as long as you keep renewing. When the seats are gone, they're gone.

Nova Pro vs VIP
Nova Pro is for traders who want the AI analysis without the automation. VIP still includes unlimited runs on every desk, all bots (NovaScalper, Forex Bots, GMGN VIP Bot, Prop Firm, Nova Ultimate, Polymarket) and Coach Calls.

Fair refund policy
Changed your mind? Request a refund within 24 hours if you've used ${refundRuns} runs or fewer (card fee not refundable). Full details:
${PAYMENT_TERMS_URL}

Claim your Founding seat:
${SUBSCRIBE_PRO_URL}

Questions? Use Chat or Support in the app at novastaris.ai — or reply to this email.

— The NovaStaris team
https://novastaris.ai

Educational tools only — not financial advice.`,
    ctaLabel: "Claim a Founding Pro seat",
    ctaUrl: SUBSCRIBE_PRO_URL,
  };
}

export const NOVA_PRO_LAUNCH_EMAIL = buildNovaProLaunchEmail();

/** In-app site announcement (Admin → Banners / Admin → Nova Pro launch kit). */
export function buildNovaProLaunchBanner(input: NovaProLaunchEmailInput = {}) {
  const usdc = input.monthlyUsdc ?? 50;
  const fee = input.cardFee ?? 8;
  const ai = input.sharedDailyLimit ?? 7;
  const pulse = input.pulseDailyLimit ?? 5;
  const seats = input.foundingSeats ?? 100;
  return {
    enabled: true,
    title: `New: Nova Pro — VIP AI desks from $${usdc}/month`,
    body: `Every VIP AI desk with ${ai} AI runs + ${pulse} Nova Pulse runs per day. $${usdc + fee}/month by card or $${usdc} with USDC (save $${fee}).${
      seats > 0 ? `\n\nLimited edition: the first ${seats} subscribers become Founding members and lock today's price.` : ""
    }\n\nEducational only — not financial advice.`,
    ctaLabel: "See Nova Pro",
    ctaHref: "/subscribe?plan=pro",
    showPartnerLogos: false,
    partnerBrand: "blofin" as const,
  };
}
