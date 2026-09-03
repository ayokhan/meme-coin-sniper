const APP_ORIGIN = (process.env.NEXT_PUBLIC_APP_URL ?? "https://novastaris.ai").replace(/\/$/, "");
export const ROBINHOOD_TAB_URL = `${APP_ORIGIN}/?tab=robinhood`;
export const HYPEREVM_TAB_URL = `${APP_ORIGIN}/?tab=hyperevm`;

export const ROBINHOOD_HYPEREVM_LAUNCH_EMAIL = {
  subject: "New on NovaStaris: Robinhood Chain & HyperEVM meme hunting",
  body: `Hi there,

We've added two new chains to NovaStaris — Robinhood Chain and HyperEVM — so you can hunt early meme momentum where your community already trades.

What's included
• Go Hunting on Robinhood Chain — new pairs, final stretch, migrated
• Go Hunting on HyperEVM — same desk, Hyperliquid ecosystem
• Narrative Scanner — pick your chain and scan themes forming now
• AI Agent — paste any contract; we detect Robinhood & HyperEVM automatically

Open Robinhood or HyperEVM in the top tabs, or use the links below.

Educational only — not financial advice.

Questions? Use Chat or Support in the app at novastaris.ai — or reply to this email.

— The NovaStaris team
${ROBINHOOD_TAB_URL}`,
  ctaLabel: "Open Robinhood Chain",
  ctaUrl: ROBINHOOD_TAB_URL,
};

export function shouldUseCustomRobinhoodHyperevmIntro(body: string): boolean {
  const t = body.trim();
  if (!t) return false;
  if (t.includes("What's included") && t.includes("Robinhood")) return false;
  return true;
}
