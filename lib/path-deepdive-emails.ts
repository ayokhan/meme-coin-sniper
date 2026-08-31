/** Day 3–4 path deep-dive emails (Admin → Emails). One real action each. */

const APP = "https://novastaris.ai";

export const PATH_DEEPDIVE_MEME_EMAIL = {
  subject: "Your next step on NovaStaris: meme coin hunter",
  body: `Hi there,

Ready for one real action on NovaStaris?

Today: meme coin hunter
1. Open Go Hunting — scan new Robinhood, HyperEVM, Solana, or BSC pairs
2. Open AI Agent — paste a contract and run analysis

Do those two tabs once. That’s enough for today.

Need the map again? ${APP}/start-here

Stuck? Use Chat or Support in the app at novastaris.ai — this inbox is not monitored.

— The NovaStaris team
${APP}`,
  ctaLabel: "Open Go Hunting",
  ctaUrl: `${APP}/?tab=new`,
} as const;

export const PATH_DEEPDIVE_FUTURES_EMAIL = {
  subject: "Your next step on NovaStaris: crypto futures",
  body: `Hi there,

Ready for one real action on NovaStaris?

Today: crypto futures
1. Open Crypto Futures
2. Upload a chart (any timeframe) and run AI Chart Analysis — support/resistance, entry zone, TP / SL

One chart is enough for today.

VIP desks (NovaForecast, NovaRadar) unlock with VIP when you’re ready.

Need the map again? ${APP}/start-here

Stuck? Use Chat or Support in the app at novastaris.ai — this inbox is not monitored.

— The NovaStaris team
${APP}`,
  ctaLabel: "Open Crypto Futures",
  ctaUrl: `${APP}/?tab=futures`,
} as const;

export const PATH_DEEPDIVE_FOREX_EMAIL = {
  subject: "Your next step on NovaStaris: forex & metals",
  body: `Hi there,

Ready for one real action on NovaStaris?

Today: forex & metals
1. Open Nova Forex Agent — your Market Watch for gold, FX, and indices
2. Refresh the board, then run NovaQ on XAUUSD (or EURUSD)

One symbol, one NovaQ read — that’s the win for today.

Want automated execution later? Focus → Bots → Nova Forex Bots (MT4/MT5 + partner rebate).

Need the map again? ${APP}/start-here

Stuck? Use Chat or Support in the app at novastaris.ai — this inbox is not monitored.

— The NovaStaris team
${APP}`,
  ctaLabel: "Open Nova Forex",
  ctaUrl: `${APP}/?tab=nova-forex`,
} as const;

export const PATH_DEEPDIVE_WALLETS_EMAIL = {
  subject: "Your next step on NovaStaris: wallet tracking",
  body: `Hi there,

Ready for one real action on NovaStaris?

Today: wallet tracking
1. Open Wallet Tracker
2. Review Top Leverage Traders — or add a wallet you care about

One look at smart money flow is enough for today.

CT Scan and Coach Calls sit next to this path when you want more signal.

Need the map again? ${APP}/start-here

Stuck? Use Chat or Support in the app at novastaris.ai — this inbox is not monitored.

— The NovaStaris team
${APP}`,
  ctaLabel: "Open Wallet Tracker",
  ctaUrl: `${APP}/?tab=wallets`,
} as const;

export const PATH_DEEPDIVE_POLYMARKET_EMAIL = {
  subject: "Your next step on NovaStaris: prediction markets",
  body: `Hi there,

Ready for one real action on NovaStaris?

Today: prediction markets
1. Open Nova Polymarket
2. Explore wallet intelligence / radar on one market you care about

One pass is enough for today.

Need the map again? ${APP}/start-here

Stuck? Use Chat or Support in the app at novastaris.ai — this inbox is not monitored.

— The NovaStaris team
${APP}`,
  ctaLabel: "Open Polymarket",
  ctaUrl: `${APP}/?tab=polymarket-bot`,
} as const;
