const APP_ORIGIN = (process.env.NEXT_PUBLIC_APP_URL ?? "https://novastaris.ai").replace(/\/$/, "");
export const SESSION_SWEEP_URL = `${APP_ORIGIN}/?tab=session-sweep`;
export const SESSION_SWEEP_SUBSCRIBE_URL = `${APP_ORIGIN}/subscribe`;
export const SESSION_SWEEP_EMAIL_CHART_URL = `${APP_ORIGIN}/marketing/novastaris-session-sweep-email-chart.png`;

/** Sent to VIP members (the tab is VIP-gated by the Nova Session Sweep flag). */
export const SESSION_SWEEP_LAUNCH_EMAIL = {
  subject: "New for VIP: Session Sweep — spot the sweep, wait for the break",
  body: `Hi there,

Session Sweep is live in your VIP dashboard as its own tab.

It tracks the Asia, London and New York session ranges and watches for one specific sequence:

1. Sweep — price spikes past a session high or low (where stops sit), then snaps back inside.
2. CHoCH — the first close against the old trend. The character changes.
3. BOS — structure breaks. That close is the entry; stop and a 3R target are mapped for you.

What's inside
• Gold, silver, major forex pairs and crypto perps (BTC, ETH, SOL and more)
• Live status per level: untouched, raiding, swept, broken
• A zoomable chart with the session boxes and every setup drawn on it
• A backtest with spread and fees included, so you see the honest numbers

Not every sweep reverses — that's why it waits for CHoCH and BOS before anything counts.

Open the Session Sweep tab (marked NEW), or use the link below.

Educational only — not financial advice.

— The NovaStaris team
https://novastaris.ai/?tab=session-sweep`,
  ctaLabel: "Open Session Sweep",
  ctaUrl: SESSION_SWEEP_URL,
};

/** Sent to free users: same lesson, clearly framed as a VIP tool. */
export const SESSION_SWEEP_UPSELL_EMAIL = {
  subject: "The liquidity sweep, explained — and the new VIP tool that tracks it",
  body: `Hi there,

Most session highs and lows get taken out before the real move. That spike is a liquidity sweep: price runs the stops sitting just past the level, then reverses.

Here's the sequence pros wait for:

1. Sweep — price spikes past a session high or low, then snaps back inside.
2. CHoCH — the first close against the old trend.
3. BOS — structure breaks. Only now is there a trade, with a defined stop and target.

We built Session Sweep to track this live across the Asia, London and New York sessions on gold, silver, forex and crypto perps — with every setup drawn on the chart and a backtest that includes spread and fees.

Session Sweep is a VIP tool. Upgrade to unlock it alongside the rest of the VIP desks.

Educational only — not financial advice.

— The NovaStaris team
https://novastaris.ai/subscribe`,
  ctaLabel: "Unlock with VIP",
  ctaUrl: SESSION_SWEEP_SUBSCRIBE_URL,
};

/** False when the body is the stock preset copy (render the designed layout instead). */
export function shouldUseCustomSessionSweepIntro(body: string): boolean {
  const norm = (s: string) => s.replace(/\s+/g, " ").trim();
  const t = norm(body);
  if (!t) return false;
  return t !== norm(SESSION_SWEEP_LAUNCH_EMAIL.body) && t !== norm(SESSION_SWEEP_UPSELL_EMAIL.body);
}
