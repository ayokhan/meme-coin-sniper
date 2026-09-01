/**
 * Maps dashboard tabs ↔ page_tab_* flags for Admin → Product visibility.
 */

export type ProductVisibilityFlagRow = {
  tabId: string;
  flagKey: string;
  label: string;
};

/** Main GUI tabs controlled by page_tab_* feature flags. */
export const PRODUCT_VISIBILITY_FLAG_ROWS: ProductVisibilityFlagRow[] = [
  { tabId: "new", flagKey: "page_tab_new", label: "Go Hunting" },
  { tabId: "trending", flagKey: "page_tab_trending", label: "Trending" },
  { tabId: "surge", flagKey: "page_tab_surge", label: "Surge" },
  { tabId: "transactions", flagKey: "page_tab_transactions", label: "Transactions" },
  { tabId: "ai-analysis", flagKey: "page_tab_ai_analysis", label: "NovaStaris AI Agent" },
  { tabId: "futures", flagKey: "page_tab_futures", label: "Crypto Futures" },
  { tabId: "daily-wrap", flagKey: "page_tab_daily_wrap", label: "Daily Wrap" },
  { tabId: "trending-perps", flagKey: "page_tab_trending_perps", label: "Trending perps" },
  { tabId: "perp-radar", flagKey: "page_tab_perp_radar", label: "Perp Radar" },
  { tabId: "narratives", flagKey: "page_tab_narratives", label: "Narratives" },
  { tabId: "trading-bot", flagKey: "page_tab_trading_bot", label: "AI Trading Bots" },
  { tabId: "prop-firm-bot", flagKey: "page_tab_prop_firm_bot", label: "Prop Firm Challenge" },
  { tabId: "nova-ultimate", flagKey: "page_tab_nova_ultimate", label: "Nova Ultimate" },
  { tabId: "gmgn-vip-bot", flagKey: "page_tab_gmgn_vip_bot", label: "GMGN VIP Bot" },
  { tabId: "ct", flagKey: "page_tab_ct", label: "CT Scan" },
  { tabId: "wallets", flagKey: "page_tab_wallets", label: "Wallet Tracker" },
  { tabId: "coach-calls", flagKey: "page_tab_coach_calls", label: "Coach Calls" },
  { tabId: "nova-forecast", flagKey: "page_tab_nova_forecast", label: "NovaForecast Agent" },
  { tabId: "nova-pulse", flagKey: "page_tab_nova_pulse", label: "Nova Pulse" },
  { tabId: "pnl-calculator", flagKey: "page_tab_pnl_calculator", label: "PnL Calculator" },
  { tabId: "nova-forex", flagKey: "page_tab_nova_forex", label: "Nova Forex Agent" },
  { tabId: "nova-plus", flagKey: "page_tab_nova_plus", label: "Nova+" },
  { tabId: "meme-intelligence", flagKey: "page_tab_meme_intelligence", label: "Meme Intelligence" },
  { tabId: "nova-investment", flagKey: "page_tab_nova_investment_agent", label: "Investment Agent" },
  { tabId: "bsc", flagKey: "page_tab_bsc", label: "BSC" },
  { tabId: "robinhood", flagKey: "page_tab_robinhood", label: "Robinhood Chain" },
  { tabId: "hyperevm", flagKey: "page_tab_hyperevm", label: "HyperEVM" },
  { tabId: "watchlist", flagKey: "page_tab_watchlist", label: "Watchlist" },
  { tabId: "nova-connect", flagKey: "page_tab_nova_connect", label: "NovaConnect" },
  { tabId: "chris-clayton", flagKey: "page_tab_chris_clayton", label: "Online Boss Strategy" },
  { tabId: "trading-university", flagKey: "page_tab_trading_university", label: "Trading University" },
  { tabId: "nova-job-agent", flagKey: "page_tab_nova_job_agent", label: "Jobs Agent" },
  { tabId: "nova-store", flagKey: "page_tab_nova_store", label: "Nova Store" },
  { tabId: "demo-sessions", flagKey: "page_tab_demo_sessions", label: "Demo sessions (public)" },
  { tabId: "wins", flagKey: "page_tab_wins", label: "Wins landing" },
  { tabId: "case-studies", flagKey: "page_tab_case_studies", label: "Case studies" },
  { tabId: "realtor-os", flagKey: "page_tab_realtor_os", label: "Realtor OS (owner)" },
];

/** Wallet Tracker subtabs (not top-level). */
export const PRODUCT_VISIBILITY_SUBTAB_FLAGS: ProductVisibilityFlagRow[] = [
  { tabId: "meme-coins-traders", flagKey: "page_tab_meme_coins_traders", label: "Wallet → Meme Coins Traders" },
  { tabId: "leverage-traders", flagKey: "page_tab_leverage_traders", label: "Wallet → Top Leverage Traders" },
];

export const PAGE_TAB_FLAG_KEY_SET = new Set([
  ...PRODUCT_VISIBILITY_FLAG_ROWS.map((r) => r.flagKey),
  ...PRODUCT_VISIBILITY_SUBTAB_FLAGS.map((r) => r.flagKey),
]);

export function isPageTabFeatureFlag(key: string): boolean {
  return key.startsWith("page_tab_") || PAGE_TAB_FLAG_KEY_SET.has(key);
}
