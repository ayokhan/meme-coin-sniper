/** Brand campaign: why top traders start on NovaStaris (Admin → Emails). */

const APP = "https://novastaris.ai";

export const WHY_TRADERS_EMAIL = {
  subject: "Why the top traders start on NovaStaris",
  body: `Hi there,

The best traders don't wait for a signal — they trade where it starts.

On NovaStaris you can:
• Hunt new Robinhood, HyperEVM, Solana, and BSC pairs as they appear
• Follow wallets that already moved
• Run AI on a contract — buy zone, take profit & stop loss
• Read crypto futures and forex from one desk
• Learn the playbook free in Trading University

Choose your desk:
${APP}/enter

Questions? Use Chat or Support in the app at novastaris.ai — this inbox is not monitored.

— The NovaStaris team
${APP}`,
  ctaLabel: "Choose your desk",
  ctaUrl: `${APP}/enter`,
} as const;
