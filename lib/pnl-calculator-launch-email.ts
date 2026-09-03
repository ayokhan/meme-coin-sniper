const APP_ORIGIN = (process.env.NEXT_PUBLIC_APP_URL ?? "https://novastaris.ai").replace(/\/$/, "");
export const PNL_CALCULATOR_URL = `${APP_ORIGIN}/?tab=pnl-calculator`;

export const PNL_CALCULATOR_LAUNCH_EMAIL = {
  subject: "New on NovaStaris: PnL Calculator for crypto futures & forex",
  body: `Hi there,

We've added a standalone PnL Calculator to NovaStaris — professional sizing for crypto futures and forex in one desk.

What's included
• Position size from your account risk and stop distance
• Take-profit and stop-loss in price, %, or pips
• Reward-to-risk and account gain/loss percentages
• Live pivot levels (Floor, Woodie, Camarilla, DeMark, Fibonacci) — tap to apply to your plan
• Forex sessions include risk-on/risk-off context

Open PnL Calculator in the top tabs, or use the link below.

Educational only — not financial advice.

Questions? Use Chat or Support in the app at novastaris.ai — or reply to this email.

— The NovaStaris team
https://novastaris.ai/?tab=pnl-calculator`,
  ctaLabel: "Open PnL Calculator",
  ctaUrl: PNL_CALCULATOR_URL,
};

/** Site announcement preset (Admin → Banners). Only one announcement is live at a time. */
export const PNL_CALCULATOR_LAUNCH_BANNER = {
  enabled: true,
  title: "New: PnL Calculator for crypto futures & forex",
  body: "Size your trade before you send it — position size, TP/SL in price, % or pips, risk/reward, and live pivot levels in one professional desk.\n\nEducational only — not financial advice.",
  ctaLabel: "Open PnL Calculator",
  ctaHref: "/?tab=pnl-calculator",
  showPartnerLogos: false,
  partnerBrand: "blofin" as const,
};

export function shouldUseCustomPnlCalculatorIntro(body: string): boolean {
  const t = body.trim();
  if (!t) return false;
  if (t.includes("What's included") && t.includes("pnl-calculator")) return false;
  return true;
}
