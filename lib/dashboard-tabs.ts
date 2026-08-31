/** Shared dashboard tab ids and display labels (web + mobile). */

export type DashboardTabId =
  | "new"
  | "trending"
  | "surge"
  | "ct"
  | "wallets"
  | "transactions"
  | "ai-analysis"
  | "daily-wrap"
  | "futures"
  | "trending-perps"
  | "perp-radar"
  | "narratives"
  | "trading-bot"
  | "polymarket-bot"
  | "prop-firm-bot"
  | "nova-forex-bot"
  | "nova-ultimate"
  | "coach-calls"
  | "nova-forecast"
  | "nova-pulse"
  | "pnl-calculator"
  | "nova-forex"
  | "nova-plus"
  | "nova-investment"
  | "bsc"
  | "robinhood"
  | "hyperevm"
  | "watchlist"
  | "nova-futures-narratives"
  | "nova-eagle"
  | "crypto-buddie"
  | "meme-intelligence"
  | "nova-connect"
  | "chris-clayton"
  | "trading-university"
  | "nova-store"
  | "realtor-os";

export const DASHBOARD_TAB_ORDER: DashboardTabId[] = [
  "new",
  "trending",
  "surge",
  "transactions",
  "ai-analysis",
  "daily-wrap",
  "futures",
  "trending-perps",
  "perp-radar",
  "narratives",
  "trading-bot",
  "polymarket-bot",
  "prop-firm-bot",
  "nova-forex-bot",
  "nova-ultimate",
  "ct",
  "wallets",
  "coach-calls",
  "nova-forecast",
  "nova-pulse",
  "pnl-calculator",
  "nova-forex",
  "nova-plus",
  "nova-investment",
  "bsc",
  "robinhood",
  "hyperevm",
  "watchlist",
  "nova-futures-narratives",
  "nova-eagle",
  "crypto-buddie",
  "meme-intelligence",
  "nova-connect",
  "chris-clayton",
  "trading-university",
  "nova-store",
  "realtor-os",
];

export const TAB_SHORT_LABELS: Record<DashboardTabId, string> = {
  new: "Hunting",
  trending: "Trending",
  surge: "Surge",
  ct: "CT Scan",
  wallets: "Wallets",
  transactions: "Txns",
  "ai-analysis": "AI Agent",
  "daily-wrap": "Daily Wrap",
  futures: "Futures",
  "trending-perps": "Perps",
  "perp-radar": "Radar",
  narratives: "Narratives",
  "trading-bot": "Bots",
  "polymarket-bot": "Polymarket",
  "prop-firm-bot": "Prop Firm",
  "nova-forex-bot": "FX Bots",
  "nova-ultimate": "Ultimate",
  "coach-calls": "Coach",
  "nova-forecast": "Forecast",
  "nova-pulse": "Pulse",
  "pnl-calculator": "PnL Calc",
  "nova-forex": "Forex",
  "nova-plus": "Nova+",
  "nova-investment": "Invest",
  bsc: "BSC",
  robinhood: "Robinhood",
  hyperevm: "HyperEVM",
  watchlist: "Watchlist",
  "nova-futures-narratives": "Fut Narr.",
  "nova-eagle": "Eagle",
  "crypto-buddie": "Buddie",
  "meme-intelligence": "Meme Intel",
  "nova-connect": "Community",
  "chris-clayton": "Boss",
  "trading-university": "University",
  "nova-store": "Store",
  "realtor-os": "Realtor",
};
