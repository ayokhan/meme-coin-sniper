/**
 * Owner-only feature flags. When a flag is OFF, the corresponding API/feature is disabled
 * (e.g. no Moralis calls for Go Hunting, no Moralis for Wallet Tracker, no Telegram alerts).
 * Stored in DB; only editable by owner in Admin → Feature Flags.
 */
import { prisma } from '@/lib/db';

export const FEATURE_FLAG_KEYS = {
  /** Moralis for Go Hunting (new-pairs + scan fallback). When OFF, no getPumpFunNewTokens calls. */
  MORALIS_GO_HUNTING: 'moralis_go_hunting',
  /** Moralis for Wallet Tracker (alerts + trades). When OFF, wallet APIs use Helius/Birdeye only. */
  MORALIS_WALLET_TRACKER: 'moralis_wallet_tracker',
  /** Send wallet alerts to Telegram (cron notify). When OFF, cron does not send to Telegram. */
  TELEGRAM_WALLET_ALERTS: 'telegram_wallet_alerts',
  /** For wallet-tracker Telegram alerts: require viralScore > 70 (when ON). Default is > 60. */
  TELEGRAM_WALLET_ALERTS_VIRAL_GT_70: 'telegram_wallet_alerts_viral_gt_70',
  /** CT Scan / scan token alerts: send Telegram when scans find new tokens. */
  TELEGRAM_TOKEN_SCAN_ALERTS: 'telegram_token_scan_alerts',

  /** Top-level GUI tab visibility controls (owner-managed; user tier/access rules remain unchanged). */
  PAGE_TAB_NEW: 'page_tab_new',
  PAGE_TAB_TRENDING: 'page_tab_trending',
  PAGE_TAB_SURGE: 'page_tab_surge',
  PAGE_TAB_TRANSACTIONS: 'page_tab_transactions',
  PAGE_TAB_AI_ANALYSIS: 'page_tab_ai_analysis',
  PAGE_TAB_FUTURES: 'page_tab_futures',
  PAGE_TAB_TRENDING_PERPS: 'page_tab_trending_perps',
  PAGE_TAB_PERP_RADAR: 'page_tab_perp_radar',
  PAGE_TAB_NARRATIVES: 'page_tab_narratives',
  PAGE_TAB_TRADING_BOT: 'page_tab_trading_bot',
  /** VIP on-demand: Nova Prop Firm Challenge tab (challenge guardrails + Blofin sync). Independent of AI Trading Bot tab. Default ON. */
  PAGE_TAB_PROP_FIRM_BOT: 'page_tab_prop_firm_bot',
  /** Blofin auto-sync + API keys in Nova Prop Firm Challenge. When OFF, manual tracking only (no Blofin calls from prop firm). Default ON. */
  PROP_FIRM_BLOFIN: 'prop_firm_blofin',
  /** VIP on-demand: Nova Ultimate tab (Solana meme tooling via Jupiter). Independent of AI Trading Bot tab. Default ON. */
  PAGE_TAB_NOVA_ULTIMATE: 'page_tab_nova_ultimate',
  PAGE_TAB_CT: 'page_tab_ct',
  PAGE_TAB_WALLETS: 'page_tab_wallets',
  PAGE_TAB_COACH_CALLS: 'page_tab_coach_calls',
  PAGE_TAB_NOVA_FORECAST: 'page_tab_nova_forecast',
  /** VIP: Nova Forex Agent top-level tab (forex/CFD Market Watch). Default OFF until admin enables. */
  PAGE_TAB_NOVA_FOREX: 'page_tab_nova_forex',
  PAGE_TAB_NOVA_PLUS: 'page_tab_nova_plus',
  PAGE_TAB_MEME_INTELLIGENCE: 'page_tab_meme_intelligence',
  PAGE_TAB_NOVA_INVESTMENT_AGENT: 'page_tab_nova_investment_agent',
  PAGE_TAB_BSC: 'page_tab_bsc',
  PAGE_TAB_WATCHLIST: 'page_tab_watchlist',
  PAGE_TAB_NOVA_CONNECT: 'page_tab_nova_connect',
  PAGE_TAB_CHRIS_CLAYTON: 'page_tab_chris_clayton',
  /** Sub-tab visibility: Meme Coins Traders under Wallet Tracker. Default ON. Owner can hide while keeping the Wallet Tracker tab. */
  PAGE_TAB_MEME_COINS_TRADERS: 'page_tab_meme_coins_traders',
  /** Sub-tab visibility: Top Leverage Traders under Wallet Tracker (futures & perps group). Default ON. */
  PAGE_TAB_LEVERAGE_TRADERS: 'page_tab_leverage_traders',

  /** Show/fetch live trades from tracked wallets. When OFF, no calls to /api/wallet-tracker/trades (saves Moralis). Alerts still work. */
  LIVE_TRADES_ENABLED: 'live_trades_enabled',
  /** Owner-only: notify (in-app + Telegram) the first time a tracked wallet buys a coin. No repeat alerts for same wallet+token. */
  OWNER_FIRST_BUY_ALERTS: 'owner_first_buy_alerts',
  /** Send Top Leverage Traders new-trade alerts to Telegram when an alert-enabled wallet changes positions. */
  TELEGRAM_LEVERAGE_ALERTS: 'telegram_leverage_alerts',
  /** Send perp digest to users who opted in to newsletter. When OFF, digest goes only to Telegram and DIGEST_EMAIL_TO. */
  DIGEST_TO_NEWSLETTER_SUBSCRIBERS: 'digest_to_newsletter_subscribers',
  /** NovaConnect social portal (Nova Connect tab, community rules, and links). When OFF, Nova Connect tab is hidden. */
  NOVA_CONNECT: 'nova_connect',
  /** Server batch job /api/cron/nova-scalper: run NovaScalper ticks for enabled users. Default OFF; Admin → Feature flags → NovaScalper overnight automation. */
  NOVA_SCALPER_CRON: 'nova_scalper_cron',
  /** VIP (Polymarket on-demand): Nova Polymarket Tracker subtab + APIs + admin wallet list. When OFF, tracker is hidden and routes return disabled. */
  NOVA_POLYMARKET_TRACKER: 'nova_polymarket_tracker',
  /** VIP: Polymarket Copy Trading Bot subtab + analyze APIs. Requires tracker access. Default OFF until admin enables. */
  NOVA_POLYMARKET_COPY_BOT: 'nova_polymarket_copy_bot',
  /** VIP: Nova Polymarket Leaderboard subtab + proxy API. Requires tracker access. Default OFF until admin enables. */
  NOVA_POLYMARKET_LEADERBOARD: 'nova_polymarket_leaderboard',
  /** VIP: Nova 5 mins short-window direction assistant under Nova Polymarket. Requires tracker access. Default OFF until admin enables. */
  NOVA_POLYMARKET_FIVE_MINS: 'nova_polymarket_five_mins',
  /** VIP: Polymarket Elite — top leaderboard traders + consensus signals when elites align on same market side. Requires tracker access. Default OFF until admin enables. */
  NOVA_POLYMARKET_ELITE: 'nova_polymarket_elite',
  /** VIP: Nova Eagle subtab under Crypto Futures (tracked large perp positions + heuristics). Default OFF until admin enables. */
  NOVA_EAGLE: 'nova_eagle',
  /** VIP: Crypto Buddie subtab under Crypto Futures (scalp-style ranking + optional Sol/BSC AI monitor). Default OFF until admin enables. */
  NOVA_CRYPTO_BUDDIE: 'nova_crypto_buddie',
  /** VIP: Liquidation Map subtab under Crypto Futures (symbol search + liquidity map analysis). Default OFF until admin enables. */
  NOVA_LIQUIDATION_MAP: 'nova_liquidation_map',
  /** VIP: Nova Futures Narratives tab (headline + institutional narrative read). Default OFF until admin enables. */
  NOVA_FUTURES_NARRATIVES: 'nova_futures_narratives',
  /** VIP: Nova Meme Intelligence top-level tab. Default OFF until admin enables. */
  NOVA_MEME_INTELLIGENCE: 'nova_meme_intelligence',
  /** VIP: NovaQ - Memes subtab under Nova Meme Intelligence. Default OFF until admin enables. */
  NOVA_Q_MEMES: 'nova_q_memes',
  /** VIP: Nova Smart Analysis for Memes subtab under Nova Meme Intelligence. Default OFF until admin enables. */
  NOVA_SMART_MEMES: 'nova_smart_memes',
  /** VIP: Top Meme coins subtab under Nova Meme Intelligence. Default OFF until admin enables. */
  NOVA_TOP_MEME_COINS: 'nova_top_meme_coins',
  /** VIP: Meme Price Factor subtab under Nova Meme Intelligence. Default OFF until admin enables. */
  NOVA_MEME_PRICE_FACTOR: 'nova_meme_price_factor',
  /** VIP: Meme Runner — multi-chain trenches scanner (SOL, BSC, ETH). Default OFF until admin enables. */
  NOVA_MEME_RUNNER: 'nova_meme_runner',
  /** UVIP: Nova Perp Wallet Analyst Agent subtab under Wallet Tracker. Default OFF until admin enables. */
  NOVA_PERP_WALLET_ANALYST: 'nova_perp_wallet_analyst',
  /** VIP: Meme Leaderboard subtab under Wallet Tracker (free-API meme trader rankings). Default OFF until admin enables. */
  NOVA_MEME_LEADERBOARD: 'nova_meme_leaderboard',
  /** VIP: Deep Meme Agent subtab under Wallet Tracker (token security + top-holder analyzer using GoPlus + Dexscreener + Helius). Default ON. */
  NOVA_DEEP_MEME_AGENT: 'nova_deep_meme_agent',
  /** VIP: Nova Scalp Agent subtab under NovaForecast Agent (leveraged scalp entry/exit + Quick Wins scanner). Default OFF until admin enables. */
  NOVA_SCALP_AGENT: 'nova_scalp_agent',
  /** VIP: NovaQ Fib subtab under NovaForecast Agent (Fibonacci retracement from pivot swings; classic NovaQ unchanged). Default OFF until admin enables. */
  NOVA_Q_FIB: 'nova_q_fib',
  /** VIP: Nova Extra subtab under NovaForecast Agent (intraday UTC hour/range long-short seasonality). Default OFF until admin enables. */
  NOVA_EXTRA: 'nova_extra',
  /** VIP: Nova Pattern Detector under NovaForecast Agent (swing high/low zones, range cycles, multi-TF). Default OFF until admin enables. */
  NOVA_PATTERN_DETECTOR: 'nova_pattern_detector',
  /** VIP: Nova Forex Agent tab + core subtabs (forecast, NovaQ, smart, radar). Default OFF until admin enables. */
  NOVA_FOREX_AGENT: 'nova_forex_agent',
  /** VIP: Nova Forex Fib subtab. Default OFF until admin enables. */
  NOVA_FOREX_FIB: 'nova_forex_fib',
  /** VIP: Nova Forex Scalp Agent subtab. Default OFF until admin enables. */
  NOVA_FOREX_SCALP_AGENT: 'nova_forex_scalp_agent',
  /** VIP + owner: per-user RAG over past Solana token analyses (requires OPENAI_API_KEY). Default OFF. */
  AI_ANALYSIS_RAG: 'ai_analysis_rag',
  /** Meme Coins Agent under NovaStaris AI Agent tab. When OFF, analysis API returns unavailable. Default ON. */
  NOVA_AI_AGENT_MEME: 'nova_ai_agent_meme',
  /** Chart Analysis under NovaStaris AI Agent tab. When OFF, futures chart API returns unavailable. Default ON. */
  NOVA_AI_AGENT_CHART: 'nova_ai_agent_chart',
  /** Self-service Delete account on /account (web + Capacitor). Required for Google Play; owner can disable in Admin. Default ON. */
  ACCOUNT_SELF_DELETE: 'account_self_delete',
  /** Billing history (invoices) on /account for signed-in users. DB only. Default OFF until admin enables. */
  ACCOUNT_BILLING_HISTORY: 'account_billing_history',
  /** Nja (Need Help) can answer NovaStaris Affiliate Program questions. Default ON. */
  NJA_AFFILIATE_KNOWLEDGE: 'nja_affiliate_knowledge',
  /** Nja can answer active partner promos (e.g. Blofin when enabled). Default ON. */
  NJA_PARTNER_PROMOS: 'nja_partner_promos',
  /** Optional two-factor authentication (Google Authenticator + email codes). When OFF, 2FA is not enforced at sign-in and users cannot enroll. Default ON. */
  TWO_FACTOR_AUTH: 'two_factor_auth',

  /** Show/hide NovaStaris Trading University tab (static course + final exam). Default ON. */
  PAGE_TAB_TRADING_UNIVERSITY: 'page_tab_trading_university',
  /** Post-pass voluntary donation prompt (Stripe card checkout). Default ON. */
  TRADING_UNIVERSITY_DONATIONS: 'trading_university_donations',

  /** Master switch: Vercel scheduled /api/cron (daily scan, wallet notify, trading bot, perp jobs). When OFF, cron returns immediately — saves CPU. Default ON. */
  VERCEL_CRON_ENABLED: 'vercel_cron_enabled',
  /** Client page-view pings to /api/analytics (Insights + live activity data). When OFF, no analytics writes. Default ON. */
  ANALYTICS_PING_ENABLED: 'analytics_ping_enabled',
  /** Owner Admin → Metrics live activity panel (30s polling + DB reads). When OFF, panel shows disabled. Default ON. */
  LIVE_ACTIVITY_ENABLED: 'live_activity_enabled',
  /**
   * Need Help widget + owner live-transfer polling + agent presence heartbeats.
   * When OFF: widget hidden, /api/admin/chat/live-transfers stops, presence heartbeats skip.
   * Default OFF (turn on only when staffing live chat).
   */
  LIVE_SUPPORT_CHAT: 'live_support_chat',
} as const;

export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[keyof typeof FEATURE_FLAG_KEYS];

const DEFAULT_ENABLED = true;
const DEFAULT_DISABLED_KEYS: Set<string> = new Set([
  FEATURE_FLAG_KEYS.DIGEST_TO_NEWSLETTER_SUBSCRIBERS,
  FEATURE_FLAG_KEYS.NOVA_SCALPER_CRON,
  FEATURE_FLAG_KEYS.NOVA_POLYMARKET_COPY_BOT,
  FEATURE_FLAG_KEYS.NOVA_POLYMARKET_LEADERBOARD,
  FEATURE_FLAG_KEYS.NOVA_POLYMARKET_FIVE_MINS,
  FEATURE_FLAG_KEYS.NOVA_POLYMARKET_ELITE,
  FEATURE_FLAG_KEYS.NOVA_EAGLE,
  FEATURE_FLAG_KEYS.NOVA_CRYPTO_BUDDIE,
  FEATURE_FLAG_KEYS.NOVA_LIQUIDATION_MAP,
  FEATURE_FLAG_KEYS.NOVA_FUTURES_NARRATIVES,
  FEATURE_FLAG_KEYS.NOVA_MEME_INTELLIGENCE,
  FEATURE_FLAG_KEYS.NOVA_Q_MEMES,
  FEATURE_FLAG_KEYS.NOVA_SMART_MEMES,
  FEATURE_FLAG_KEYS.NOVA_TOP_MEME_COINS,
  FEATURE_FLAG_KEYS.NOVA_MEME_PRICE_FACTOR,
  FEATURE_FLAG_KEYS.NOVA_MEME_RUNNER,
  FEATURE_FLAG_KEYS.NOVA_SCALP_AGENT,
  FEATURE_FLAG_KEYS.NOVA_Q_FIB,
  FEATURE_FLAG_KEYS.NOVA_EXTRA,
  FEATURE_FLAG_KEYS.NOVA_PATTERN_DETECTOR,
  FEATURE_FLAG_KEYS.PAGE_TAB_NOVA_FOREX,
  FEATURE_FLAG_KEYS.NOVA_FOREX_AGENT,
  FEATURE_FLAG_KEYS.NOVA_FOREX_FIB,
  FEATURE_FLAG_KEYS.NOVA_FOREX_SCALP_AGENT,
  FEATURE_FLAG_KEYS.AI_ANALYSIS_RAG,
  FEATURE_FLAG_KEYS.LIVE_SUPPORT_CHAT,
  FEATURE_FLAG_KEYS.ACCOUNT_BILLING_HISTORY,
]);

type PrismaWithFeatureFlag = typeof prisma & {
  featureFlag?: {
    findUnique: (args: { where: { key: string } }) => Promise<{ enabled: boolean } | null>;
    findMany: () => Promise<Array<{ key: string; enabled: boolean }>>;
    upsert: (args: {
      where: { key: string };
      create: { key: string; enabled: boolean };
      update: { enabled: boolean };
    }) => Promise<unknown>;
  };
};

/** Get whether a feature flag is enabled. Defaults to true if key not in DB (except DIGEST_TO_NEWSLETTER_SUBSCRIBERS which defaults to false). */
export async function getFeatureFlag(key: string): Promise<boolean> {
  try {
    const db = prisma as unknown as PrismaWithFeatureFlag;
    if (!db.featureFlag) return DEFAULT_DISABLED_KEYS.has(key) ? false : DEFAULT_ENABLED;
    const row = await db.featureFlag.findUnique({ where: { key } });
    const defaultVal = DEFAULT_DISABLED_KEYS.has(key) ? false : DEFAULT_ENABLED;
    return row?.enabled ?? defaultVal;
  } catch {
    return DEFAULT_DISABLED_KEYS.has(key) ? false : DEFAULT_ENABLED;
  }
}

/** Get all known flags with their current state (for admin UI). */
export async function getAllFeatureFlags(): Promise<Record<string, boolean>> {
  const keys = Object.values(FEATURE_FLAG_KEYS);
  const out: Record<string, boolean> = {};
  try {
    const db = prisma as unknown as PrismaWithFeatureFlag;
    if (!db.featureFlag) {
      keys.forEach((k) => (out[k] = !DEFAULT_DISABLED_KEYS.has(k)));
      return out;
    }
    const rows = await db.featureFlag.findMany();
    const byKey = new Map(rows.map((r) => [r.key, r.enabled]));
    keys.forEach((k) => (out[k] = byKey.get(k) ?? !DEFAULT_DISABLED_KEYS.has(k)));
    return out;
  } catch {
    keys.forEach((k) => (out[k] = !DEFAULT_DISABLED_KEYS.has(k)));
    return out;
  }
}

/** Set a feature flag (admin only; caller must enforce owner check). */
export async function setFeatureFlag(key: string, enabled: boolean): Promise<void> {
  const db = prisma as unknown as PrismaWithFeatureFlag;
  if (!db.featureFlag) return;
  await db.featureFlag.upsert({
    where: { key },
    create: { key, enabled },
    update: { enabled },
  });
}
