const APP_ORIGIN = (process.env.NEXT_PUBLIC_APP_URL ?? "https://novastaris.ai").replace(/\/$/, "");
export const GMGN_VIP_BOT_TAB_URL = `${APP_ORIGIN}/?tab=gmgn-vip-bot`;
export const GMGN_VIP_BOT_RULES_URL = `${APP_ORIGIN}/gmgn-vip-bot-rules`;

const BOT_NAME = "GMGN Trenching Bot";

export const GMGN_VIP_BOT_LAUNCH_EMAIL = {
  subject: "VIP only: GMGN Trenching Bot — semi-auto trending trades on Solana, BSC & Robinhood",
  body: `Hi there,

We've launched the ${BOT_NAME} on NovaStaris — it scans GMGN 1-hour trending on Solana, BSC, and Robinhood, then surfaces signals you can approve (semi-auto) or let run automatically when you're ready.

Setup checklist
• Open the ${BOT_NAME} tab and read the trading rules
• Add your GMGN-bound wallet address (on-chain — not your login email)
• Paste GMGN API key + private key (stored encrypted), or use owner-managed credentials
• Start in semi-auto — approve each signal before going full auto

Default filters: min liquidity $15k, +5% 1h momentum — all configurable per account.

Educational only — meme trading is extremely high risk. Not financial advice.

— The NovaStaris team
${GMGN_VIP_BOT_TAB_URL}`,
  ctaLabel: `Open ${BOT_NAME}`,
  ctaUrl: GMGN_VIP_BOT_TAB_URL,
};

export function shouldUseCustomGmgnVipBotIntro(body: string): boolean {
  const t = body.trim();
  if (!t) return false;
  if (t.includes("Setup checklist") && t.includes(BOT_NAME)) return false;
  return true;
}
