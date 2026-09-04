"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import {
  PRODUCT_VISIBILITY_FLAG_ROWS,
  PRODUCT_VISIBILITY_SUBTAB_FLAGS,
} from "@/lib/product-visibility";

type AiAgentQuotasState = {
  memeAgentFreeDailyLimit: number;
  memeAgentFreeWeeklyLimit: number | null;
  memeAgentFreeMonthlyLimit: number | null;
  chartAnalysisFreeDailyLimit: number;
  chartAnalysisFreeWeeklyLimit: number | null;
  chartAnalysisFreeMonthlyLimit: number | null;
};

type AiAgentQuotasDraft = {
  memeAgentFreeDailyLimit: string;
  memeAgentFreeWeeklyLimit: string;
  memeAgentFreeMonthlyLimit: string;
  chartAnalysisFreeDailyLimit: string;
  chartAnalysisFreeWeeklyLimit: string;
  chartAnalysisFreeMonthlyLimit: string;
};

type GoHuntingRefreshAdminState = {
  guestIntervalMinutes: number;
  freeMemberIntervalMinutes: number;
  guestAutoRefreshEnabled: boolean;
  freeAutoRefreshEnabled: boolean;
  freeAutoRefreshMinutes: number;
  vipDailyLimit: number;
  vipAutoRefreshEnabled: boolean;
  vipAutoRefreshMinutes: number;
};

type GoHuntingRefreshDraft = {
  guestIntervalMinutes: string;
  freeMemberIntervalMinutes: string;
  guestAutoRefreshEnabled: boolean;
  freeAutoRefreshEnabled: boolean;
  freeAutoRefreshMinutes: string;
  vipDailyLimit: string;
  vipAutoRefreshEnabled: boolean;
  vipAutoRefreshMinutes: string;
};

const DEFAULT_GO_HUNTING_REFRESH_ADMIN: GoHuntingRefreshAdminState = {
  guestIntervalMinutes: 60,
  freeMemberIntervalMinutes: 60,
  guestAutoRefreshEnabled: false,
  freeAutoRefreshEnabled: false,
  freeAutoRefreshMinutes: 60,
  vipDailyLimit: 10,
  vipAutoRefreshEnabled: false,
  vipAutoRefreshMinutes: 5,
};

function goHuntingRefreshToDraft(c: GoHuntingRefreshAdminState): GoHuntingRefreshDraft {
  return {
    guestIntervalMinutes: String(c.guestIntervalMinutes),
    freeMemberIntervalMinutes: String(c.freeMemberIntervalMinutes),
    guestAutoRefreshEnabled: c.guestAutoRefreshEnabled,
    freeAutoRefreshEnabled: c.freeAutoRefreshEnabled,
    freeAutoRefreshMinutes: String(c.freeAutoRefreshMinutes),
    vipDailyLimit: String(c.vipDailyLimit),
    vipAutoRefreshEnabled: c.vipAutoRefreshEnabled,
    vipAutoRefreshMinutes: String(c.vipAutoRefreshMinutes),
  };
}

const DEFAULT_AI_AGENT_QUOTAS: AiAgentQuotasState = {
  memeAgentFreeDailyLimit: 2,
  memeAgentFreeWeeklyLimit: null,
  memeAgentFreeMonthlyLimit: null,
  chartAnalysisFreeDailyLimit: 2,
  chartAnalysisFreeWeeklyLimit: null,
  chartAnalysisFreeMonthlyLimit: null,
};

function quotasToDraft(q: AiAgentQuotasState): AiAgentQuotasDraft {
  return {
    memeAgentFreeDailyLimit: String(q.memeAgentFreeDailyLimit),
    memeAgentFreeWeeklyLimit: q.memeAgentFreeWeeklyLimit == null ? "" : String(q.memeAgentFreeWeeklyLimit),
    memeAgentFreeMonthlyLimit: q.memeAgentFreeMonthlyLimit == null ? "" : String(q.memeAgentFreeMonthlyLimit),
    chartAnalysisFreeDailyLimit: String(q.chartAnalysisFreeDailyLimit),
    chartAnalysisFreeWeeklyLimit: q.chartAnalysisFreeWeeklyLimit == null ? "" : String(q.chartAnalysisFreeWeeklyLimit),
    chartAnalysisFreeMonthlyLimit: q.chartAnalysisFreeMonthlyLimit == null ? "" : String(q.chartAnalysisFreeMonthlyLimit),
  };
}

function formatQuotaSummary(q: AiAgentQuotasState, feature: "meme" | "chart"): string {
  const parts: string[] = [];
  if (feature === "meme") {
    parts.push(`${q.memeAgentFreeDailyLimit}/day`);
    if (q.memeAgentFreeWeeklyLimit != null) parts.push(`${q.memeAgentFreeWeeklyLimit}/week`);
    if (q.memeAgentFreeMonthlyLimit != null) parts.push(`${q.memeAgentFreeMonthlyLimit}/month`);
  } else {
    parts.push(`${q.chartAnalysisFreeDailyLimit}/day`);
    if (q.chartAnalysisFreeWeeklyLimit != null) parts.push(`${q.chartAnalysisFreeWeeklyLimit}/week`);
    if (q.chartAnalysisFreeMonthlyLimit != null) parts.push(`${q.chartAnalysisFreeMonthlyLimit}/month`);
  }
  return parts.join(" · ");
}

const FLAG_GROUPS: { id: string; title: string; match: (key: string) => boolean }[] = [
  {
    id: "ops",
    title: "Vercel & usage (cost control)",
    match: (k) =>
      k === "vercel_cron_enabled" ||
      k === "email_notifications_cron" ||
      k === "futures_daily_wrap_cron" ||
      k === "digest_to_newsletter_subscribers" ||
      k === "analytics_ping_enabled" ||
      k === "login_location_intel" ||
      k === "live_activity_enabled" ||
      k === "live_support_chat",
  },
  {
    id: "pnl-share",
    title: "PNL share cards (Nova Bot + Nova Forex)",
    match: (k) => k.startsWith("pnl_share_"),
  },
  { id: "ai", title: "AI experiments", match: (k) => k.startsWith("ai_") || k.startsWith("nova_ai_agent") },
  { id: "moralis", title: "API & notifications", match: (k) => k.startsWith("moralis_") || k.startsWith("telegram_") || k === "live_trades_enabled" },
  {
    id: "prop-firm",
    title: "Prop Firm Challenge",
    match: (k) => k === "prop_firm_blofin" || k === "prop_firm_coinbase",
  },
  {
    id: "coinbase-trading",
    title: "Coinbase Futures",
    match: (k) => k.startsWith("coinbase_trading"),
  },
  {
    id: "nova-forex-bots",
    title: "Nova Forex Bots (MT4/MT5)",
    match: (k) =>
      k.startsWith("nova_forex_bot") || k.startsWith("nova_forex_scalp_bot") || k.startsWith("forex_broker_"),
  },
  {
    id: "nova-jobs-agent",
    title: "Nova Jobs Agent",
    match: (k) => k === "page_tab_nova_job_agent" || k === "nova_job_agent_owner_only",
  },
  {
    id: "coach-calls",
    title: "Coach Calls",
    match: (k) => k === "page_tab_coach_calls" || k === "coach_calls_owner_only",
  },
  {
    id: "crypto-buddie",
    title: "Crypto Buddie",
    match: (k) => k === "nova_crypto_buddie" || k === "nova_crypto_buddie_owner_only",
  },
  {
    id: "gmgn-vip-bot",
    title: "GMGN VIP Bot",
    match: (k) => k.startsWith("nova_gmgn_vip_bot"),
  },
  {
    id: "wallet-subs",
    title: "Wallet Tracker agents",
    match: (k) =>
      k === "nova_perp_wallet_analyst" ||
      k === "nova_meme_leaderboard" ||
      k === "nova_deep_meme_agent" ||
      k === "nova_smart_money_alerts" ||
      k === "nova_smart_money_alerts_owner_only",
  },
  {
    id: "narratives-early",
    title: "Narratives — Early Catch",
    match: (k) => k === "nova_early_catch" || k === "nova_early_catch_owner_only",
  },
  {
    id: "account",
    title: "Account & billing",
    match: (k) =>
      k.startsWith("account_") ||
      k.startsWith("subscription_pay_") ||
      k === "two_factor_auth",
  },
  {
    id: "nja",
    title: "Nja (Need Help assistant)",
    match: (k) => k.startsWith("nja_"),
  },
  { id: "other", title: "Other", match: () => true },
];

const FLAG_LABELS: Record<string, { label: string; description: string }> = {
  ai_analysis_rag: {
    label: "AI Analysis RAG (VIP + owner)",
    description:
      "When ON, VIP and owner Solana AI analyses retrieve similar past analyses from each user's private embedding history before Claude runs. Requires OPENAI_API_KEY. Free users unaffected. Default OFF.",
  },
  nova_ai_agent_meme: {
    label: "NovaStaris AI Agent — Meme Coins",
    description:
      "When ON, logged-in users can run Meme Coins Agent (VIP unlimited; free users get global daily/weekly/monthly limits). Default ON.",
  },
  nova_ai_agent_chart: {
    label: "NovaStaris AI Agent — Chart Analysis",
    description:
      "When ON, logged-in users can run Chart Analysis (VIP unlimited; free users get global daily/weekly/monthly limits). Default ON.",
  },
  account_self_delete: {
    label: "Self-service Delete account",
    description:
      "When ON, signed-in users see Delete account on /account (web and Android app). Permanently removes profile, subscriptions, wallets, NovaConnect, and related data. Required for Google Play. Owner accounts are protected and cannot self-delete. Default ON.",
  },
  account_billing_history: {
    label: "Account billing history (invoices)",
    description:
      "When ON, signed-in users see Billing history on Account → Billing with month filter and receipt links. Past VIP payments are backfilled; new card payments are recorded via Stripe webhooks. Default OFF until you enable.",
  },
  subscription_pay_card: {
    label: "VIP payment — credit card (Stripe)",
    description:
      "When ON, /subscribe shows Pay with card and Stripe checkout can start. When OFF, card checkout is hidden and blocked. Existing subscribers can still manage/cancel/update card via billing portal. Default ON.",
  },
  subscription_pay_usdc: {
    label: "VIP payment — USDC (Solana)",
    description:
      "When ON, /subscribe shows Pay with USDC and tx signature verification works. When OFF, USDC payment UI is hidden and verify is blocked. Default ON.",
  },
  nja_affiliate_knowledge: {
    label: "Nja — Affiliate program answers",
    description:
      "When ON, the Need Help assistant (Nja) can answer questions about the NovaStaris Affiliate Program (referral link, 10% commission, payouts). Default ON.",
  },
  nja_partner_promos: {
    label: "Nja — Partner promo answers (Blofin, etc.)",
    description:
      "When ON, Nja can answer questions about active partner promos (e.g. Blofin partnership when enabled in Admin → Banners). Default ON.",
  },
  two_factor_auth: {
    label: "Two-factor authentication (2FA)",
    description:
      "When ON, users can optionally enable Google Authenticator or email codes on Account, and sign-in enforces 2FA when enrolled. When OFF, 2FA is skipped at login and enrollment is hidden — use this if Resend email is misconfigured or you need to disable 2FA site-wide. Default ON.",
  },
  moralis_go_hunting: {
    label: "Go Hunting (Moralis)",
    description: "Use Moralis for New pairs and Scan fallback. When OFF, no Moralis API calls for Go Hunting or Scan.",
  },
  moralis_wallet_tracker: {
    label: "Wallet Tracker (Moralis)",
    description: "Use Moralis for wallet alerts and live trades. When OFF, only Helius/Birdeye are used (saves CPU).",
  },
  live_trades_enabled: {
    label: "Live trades (Wallet Tracker)",
    description: "Fetch and show live trades from tracked wallets. When OFF, no calls to trades API (saves Moralis). Alerts still work.",
  },
  telegram_wallet_alerts: {
    label: "Telegram wallet alerts",
    description: "Send wallet alerts to Telegram when cron runs. When OFF, cron still runs but does not send messages.",
  },
  telegram_wallet_alerts_viral_gt_70: {
    label: "Wallet alerts: viralScore > 70",
    description: "When ON, Wallet Tracker Telegram alerts only send when viralScore is greater than 70 (otherwise > 60).",
  },
  telegram_token_scan_alerts: {
    label: "CT Scan / scan token alerts (Telegram)",
    description: "When OFF, CT Scan / scan endpoints do not send token alerts to Telegram.",
  },

  page_tab_new: {
    label: "Tab: Go Hunting",
    description: "Show/hide the Go Hunting tab in the main GUI.",
  },
  page_tab_trending: {
    label: "Tab: Trending",
    description: "Show/hide the Trending tab in the main GUI.",
  },
  page_tab_surge: {
    label: "Tab: Surge",
    description: "Show/hide the Surge tab in the main GUI.",
  },
  page_tab_transactions: {
    label: "Tab: Transactions",
    description: "Show/hide the Transactions tab in the main GUI.",
  },
  page_tab_ai_analysis: {
    label: "Tab: NovaStaris AI Agent",
    description: "Show/hide the NovaStaris AI Agent tab in the main GUI.",
  },
  page_tab_futures: {
    label: "Tab: Crypto Futures",
    description: "Show/hide the Crypto Futures tab in the main GUI.",
  },
  page_tab_daily_wrap: {
    label: "Tab: Daily Wrap",
    description:
      "Show/hide the Daily Wrap top-level tab. Public — no login required. Default ON.",
  },
  page_tab_trending_perps: {
    label: "Tab: Trending perps",
    description: "Show/hide the Trending perps tab in the main GUI.",
  },
  page_tab_perp_radar: {
    label: "Tab: Perp Radar",
    description: "Show/hide the Perp Radar tab in the main GUI.",
  },
  page_tab_narratives: {
    label: "Tab: Narratives",
    description: "Show/hide the Narratives tab in the main GUI.",
  },
  page_tab_trading_bot: {
    label: "Tab: NovaStaris AI Trading Bot",
    description: "Show/hide the AI Trading Bot tab in the main GUI.",
  },
  page_tab_prop_firm_bot: {
    label: "Tab: Nova Prop Firm Challenge",
    description:
      "Show/hide the Nova Prop Firm Challenge workbook (rules + live setup). VIP on-demand access still required per user.",
  },
  prop_firm_blofin: {
    label: "Prop Firm — Blofin integration",
    description:
      "When ON, VIP users can connect Blofin API keys and auto-sync positions/PnL in Nova Prop Firm Challenge. When OFF, manual tracking only — no Blofin API calls from prop firm (saves CPU). Trading Bot Blofin is unaffected. Default ON.",
  },
  coinbase_trading: {
    label: "Coinbase Futures trading",
    description:
      "When ON, VIP users can connect Coinbase CDP API keys and trade futures via the AI Trading Bot (same features as Blofin: PNL, positions, closed trades). Pair with coinbase_trading_owner_only for rollout. Default OFF.",
  },
  coinbase_trading_owner_only: {
    label: "Coinbase trading — owner only",
    description:
      "When master ON: restrict Coinbase trading to owner session only. Default ON (owner testing). Turn OFF for All VIP.",
  },
  prop_firm_coinbase: {
    label: "Prop Firm — Coinbase integration",
    description:
      "When ON, VIP users can connect Coinbase API keys and auto-sync positions/PnL in Nova Prop Firm Challenge. When OFF, manual tracking only. Default OFF.",
  },
  page_tab_nova_ultimate: {
    label: "Tab: Nova Ultimate",
    description:
      "Show/hide the Nova Ultimate tab (Solana meme tooling via Jupiter). VIP on-demand access still required per user. Independent of AI Trading Bot tab.",
  },
  page_tab_ct: {
    label: "Tab: CT Scan",
    description: "Show/hide the CT Scan tab in the main GUI.",
  },
  page_tab_wallets: {
    label: "Tab: Wallet Tracker",
    description: "Show/hide the Wallet Tracker tab in the main GUI.",
  },
  page_tab_coach_calls: {
    label: "Tab: Coach Calls + Telegram Signals",
    description:
      "Master switch. Tab stays visible to everyone when ON. Guests/free need VIP; VIP users request on-demand access. Pair with coach_calls_owner_only. Prefer Off / Owner only / VIP on-demand in the Coach Calls group.",
  },
  coach_calls_owner_only: {
    label: "Coach Calls — Owner only",
    description:
      "When page_tab_coach_calls is ON: restrict to owner (+ Customers grants + coach publishers) for testing. Turn OFF for VIP on-demand requests.",
  },
  page_tab_nova_forecast: {
    label: "Tab: NovaForecast Agent",
    description: "Show/hide the NovaForecast Agent tab in the main GUI.",
  },
  page_tab_nova_forex: {
    label: "Tab: Nova Forex Agent",
    description: "Show/hide the Nova Forex Agent tab in the main GUI (also requires Nova Forex Agent feature flag ON).",
  },
  page_tab_nova_pulse: {
    label: "Tab: Nova Pulse",
    description:
      "Show/hide the Nova Pulse VIP tab (Futures = Nova Scalp Agent, Forex = Nova Forex Agent). Subtabs still require their own feature flags. Default OFF until you enable it.",
  },
  page_tab_pnl_calculator: {
    label: "Tab: PnL Calculator",
    description:
      "Show/hide the standalone PnL Calculator tab. Also requires Calculate PnL master flag ON. Guests: 2 calculations/day; registered free: 4/day; VIP unlimited by default.",
  },
  page_tab_nova_plus: {
    label: "Tab: Nova+",
    description: "Show/hide the Nova+ tab (VIP-only risk-managed trade analysis) in the main GUI.",
  },
  page_tab_meme_intelligence: {
    label: "Tab: Nova Meme Intelligence",
    description: "Show/hide the Nova Meme Intelligence tab (VIP-only meme TA workspace) in the main GUI.",
  },
  page_tab_nova_investment_agent: {
    label: "Tab: Nova Investment Agent",
    description: "Show/hide the Nova Investment Agent tab (VIP-only) in the main GUI.",
  },
  page_tab_bsc: {
    label: "Tab: BSC",
    description: "Show/hide the BSC tab in the main GUI.",
  },
  page_tab_robinhood: {
    label: "Tab: Robinhood Chain",
    description: "Show/hide the Robinhood Chain meme desk tab in the main GUI.",
  },
  page_tab_hyperevm: {
    label: "Tab: HyperEVM",
    description: "Show/hide the HyperEVM meme desk tab in the main GUI.",
  },
  page_tab_watchlist: {
    label: "Tab: Watchlist",
    description: "Show/hide the Watchlist tab in the main GUI.",
  },
  page_tab_nova_connect: {
    label: "Tab: Community (NovaConnect)",
    description: "Show/hide the Community tab (NovaConnect social feed and chat) in the main dashboard nav.",
  },
  page_tab_chris_clayton: {
    label: "Tab: Online Boss Strategy",
    description: "Show/hide the Online Boss Strategy tab (owner-only) in the main GUI.",
  },
  page_tab_trading_university: {
    label: "Tab: NovaStaris Trading University",
    description:
      "Show/hide the NovaStaris Trading University tab (free course + final exam + certificate). Guests see a preview; full course requires sign-in. Static content — no AI API cost. Default ON.",
  },
  page_tab_nova_store: {
    label: "Tab: Nova Store",
    description:
      "Show/hide the Nova Store tab (merch: tees, mugs, etc.). Visible to everyone when ON — guests can browse; Stripe card checkout requires sign-in. Free shipping from Canada. Default OFF until you enable it.",
  },
  page_tab_demo_sessions: {
    label: "Demo session registration",
    description:
      "When ON, published demo sessions accept public registrations at /demo/[slug] (share on Instagram, Telegram, WhatsApp). Manage sessions under Admin → Demo sessions. Default OFF.",
  },
  page_tab_wins: {
    label: "Wins (/wins shared PNL landing)",
    description:
      "When ON, /wins is live (PNL share destination + Account → Wins). Signed-in users see a welcome view; guests see Create account / Sign in. When OFF, the page shows closed and Wins links are hidden in the app. Default ON.",
  },
  page_tab_case_studies: {
    label: "Case studies (/case-studies)",
    description:
      "When ON, /case-studies is live and Case studies links show in the header, Account menu, About, Subscribe, and Start here. When OFF, the page shows closed and those links are hidden. Default ON. Toggle in Admin → Product visibility.",
  },
  page_tab_realtor_os: {
    label: "Tab: Realtor OS (owner only)",
    description:
      "Owner-only prototype desk for a realtor AI ops build (test email / phone / calendar). Hidden from all non-owners. Configure credentials in Admin → Realtor OS. Default ON.",
  },
  enter_landing_enabled: {
    label: "Enter / desk landing (guests)",
    description:
      "When ON, logged-out visitors see the desk landing on / (and /enter). When OFF, guests get the dashboard on bare / and /enter redirects home. Edit cards & copy in Admin → Landing. Default ON.",
  },
  page_tab_nova_job_agent: {
    label: "Nova Jobs Agent (master)",
    description:
      "Master switch for Nova Jobs Agent. Master ON + Owner-only ON = owner testing (+ admin-granted customers). Master ON + Owner-only OFF = all VIP users. Master OFF = disabled for everyone. Default ON.",
  },
  nova_job_agent_owner_only: {
    label: "Nova Jobs Agent — owner only",
    description:
      "Restricts Nova Jobs Agent to the owner (and admin on-demand grants) even when the master flag is ON. Turn OFF to roll it out to all VIP users. Has no effect while the master flag is OFF.",
  },
  trading_university_donations: {
    label: "Trading University donations",
    description:
      "After a graduate passes the final exam, show the voluntary donation card (one-time or monthly, card via Stripe). When OFF, the prompt is hidden and donation checkout is disabled. Default ON. Preview: Admin → Trading University → Donation.",
  },
  owner_first_buy_alerts: {
    label: "First buy alerts (owner only)",
    description: "Notify in-app and Telegram the first time a tracked wallet buys a coin. No repeat alerts for same wallet+token.",
  },
  telegram_leverage_alerts: {
    label: "Telegram Top Leverage Traders alerts",
    description: "Send Telegram when an alert-enabled leverage wallet changes positions (cron). Toggle per wallet in Nova Admin → Leverage Wallet Tracker.",
  },
  nova_connect: {
    label: "NovaConnect (social portal)",
    description: "Enable the NovaConnect tab (social feed + community rules). When OFF, the NovaConnect tab is hidden for all users.",
  },
  nova_scalper_cron: {
    label: "NovaScalper overnight automation",
    description:
      "When ON, the server’s daily maintenance job also advances NovaScalper for every user who has it enabled (one batch per day on typical hosting). When OFF, that pass is skipped—users still get ticks when they use Check price or leave the tab open with auto tick. Advanced: on Pro hosting you can add more frequent scheduled calls to /api/cron/nova-scalper if needed.",
  },
  nova_polymarket_tracker: {
    label: "Nova Polymarket Tracker",
    description:
      "When ON, VIP users with Nova Polymarket (on demand) see the Nova Polymarket Tracker subtab and APIs work. When OFF, the tracker is hidden and list/activity routes return disabled. Admin wallet list: Nova Admin → Polymarket Tracker.",
  },
  nova_polymarket_copy_bot: {
    label: "Nova Polymarket Copy Trading Bot",
    description:
      "When ON, eligible VIP users see the Copy trading bot subtab under Nova Polymarket (analyze any proxy wallet, wire into Copilot). Requires Nova Polymarket Tracker access. Default OFF until you enable it.",
  },
  nova_polymarket_leaderboard: {
    label: "Nova Polymarket Leaderboard",
    description:
      "When ON, eligible VIP users see the Leaderboard subtab under Nova Polymarket (trader rankings + biggest wins from Polymarket’s public data API). Requires Nova Polymarket Tracker access. Default OFF until you enable it.",
  },
  nova_polymarket_five_mins: {
    label: "Nova 5 mins (Nova Polymarket)",
    description:
      "When ON, eligible VIP users see the Nova 5 mins subtab under Nova Polymarket (short-horizon Up/Down-style AI context from spot candles + optional browser alerts on signal flips). Requires Nova Polymarket Tracker access. Default OFF until you enable it.",
  },
  nova_polymarket_elite: {
    label: "Polymarket Elite",
    description:
      "When ON, eligible VIP users see the Polymarket Elite subtab under Nova Polymarket: top leaderboard traders and consensus signals when multiple elites take the same side on a market. Requires Nova Polymarket Tracker access. Default OFF until you enable it.",
  },
  nova_eagle: {
    label: "Nova Eagle (Crypto Futures)",
    description:
      "When ON, VIP users see the Nova Eagle subtab under Crypto Futures: large positions from Top Leverage Traders wallets, wallet copy for tracker, and skew heuristics (optional AI summary). Default OFF until you enable it.",
  },
  nova_crypto_buddie: {
    label: "Crypto Buddie (Crypto Futures)",
    description:
      "Master switch for the Crypto Buddie subtab. Use Off / Owner only / All VIP below. Default OFF until you enable it.",
  },
  nova_crypto_buddie_owner_only: {
    label: "Crypto Buddie — owner only",
    description:
      "When ON (and Crypto Buddie master is ON), only you see the tab and API. Turn OFF for all VIP.",
  },
  nova_scalp_agent: {
    label: "Nova Scalp Agent (Nova Pulse → Futures)",
    description:
      "When ON, VIP users see Nova Scalp Agent under Nova Pulse → Futures: leveraged entry/exit plans, expected PnL, stop-loss, and Quick Wins scanner. Requires Tab: Nova Pulse ON. Default OFF until you enable it.",
  },
  nova_pulse_pnl_calculator: {
    label: "PnL Calculator (master)",
    description:
      "When ON, users can use the standalone PnL Calculator tab: crypto + forex ticket math (price / % / pips), BabyPips-style lot sizing, profit/loss breakdown, forex risk-on/off meter, and send to Scalper / NovaQ. Pair with Tab: PnL Calculator. Guest default 2 calculations/day; registered free 4/day; VIP unlimited (configurable in Admin → Product visibility). Default OFF until you enable it.",
  },
  nova_q_fib: {
    label: "NovaQ Fib (NovaForecast)",
    description:
      "When ON, VIP users see the NovaQ Fib subtab under NovaForecast Agent: Fibonacci retracement levels from pivot swings (38.2%–88.6% pockets), separate from classic NovaQ. Supports XAU/XAG via Blofin. Default OFF until you enable it.",
  },
  nova_extra: {
    label: "Nova Extra (NovaForecast)",
    description:
      "When ON, VIP users see the Nova Extra subtab under NovaForecast Agent: UTC hour and time-range seasonality (when price tended to rise or fall) for BTC, XAU, forex symbols, etc. Helps time long vs short entries. Default OFF until you enable it.",
  },
  nova_pattern_detector: {
    label: "Nova Playbook (NovaForecast)",
    description:
      "When ON, VIP users see the Nova Playbook subtab under NovaForecast Agent: day-of-week stats, 48h cycle retrace/bounce rates, and weekly rhythm patterns for XAU, BTC, etc. Default OFF until you enable it.",
  },
  nova_forex_agent: {
    label: "Nova Forex Agent",
    description:
      "When ON, VIP users can use Nova Forex Agent (Market Watch forecast, NovaQ Forex, Smart, Radar). Uses Yahoo Finance reference OHLC for symbols like XAUUSD, EURUSD, NAS100. Default OFF until you enable it.",
  },
  nova_forex_fib: {
    label: "Nova Forex Fib",
    description:
      "When ON, VIP users see NovaForex Fib subtab under Nova Forex Agent. Requires Nova Forex Agent ON. Default OFF.",
  },
  nova_forex_scalp_agent: {
    label: "Nova Forex Agent (Nova Pulse → Forex)",
    description:
      "When ON, VIP users see Nova Forex Agent under Nova Pulse → Forex (short-horizon scalp plans for gold, FX, indices). Requires Tab: Nova Pulse ON. Independent of the Nova Forex Agent structure desk. Default OFF.",
  },
  nova_forex_bot: {
    label: "Nova Forex Bot (master)",
    description:
      "MA-crossover auto-trading bot on the user's own MT4/MT5 account (Vantage or TIOmarkets, via MetaAPI). Master ON + Owner-only OFF = all VIP users get access. Master ON + Owner-only ON = only the owner account can use it. Master OFF = disabled for everyone, including the owner. Requires METAAPI_TOKEN for live trading; users can still save broker credentials without it. Default OFF.",
  },
  nova_forex_bot_owner_only: {
    label: "Nova Forex Bot — owner only",
    description:
      "Restricts Nova Forex Bot to the owner account even when the master flag above is ON. Turn OFF to roll it out to all VIP users. Has no effect while the master flag is OFF.",
  },
  nova_forex_scalp_bot: {
    label: "Nova Forex Scalper Bot (master)",
    description:
      "Repeat entry→exit scalping bot on the user's own MT4/MT5 account (Vantage or TIOmarkets, via MetaAPI), with a 'Scalp this trade' hand-off from Nova Forex Scalp Agent. Master ON + Owner-only OFF = all VIP users get access. Master ON + Owner-only ON = only the owner account can use it. Master OFF = disabled for everyone, including the owner. Default OFF.",
  },
  nova_forex_scalp_bot_owner_only: {
    label: "Nova Forex Scalper Bot — owner only",
    description:
      "Restricts Nova Forex Scalper Bot to the owner account even when the master flag above is ON. Turn OFF to roll it out to all VIP users. Has no effect while the master flag is OFF.",
  },
  nova_forex_scalp_bot_cron: {
    label: "Nova Forex Scalper Bot — overnight automation",
    description:
      "When ON, the server's daily maintenance job also advances Nova Forex Scalper for every user who has it enabled (one batch pass, like NovaScalper overnight automation). When OFF, users still get ticks from Check price / auto tick while their tab is open. Default OFF.",
  },
  forex_broker_vantage: {
    label: "Forex broker — Vantage Markets",
    description:
      "When ON, users can connect a Vantage Markets MT4/MT5 account and pick it for Nova Forex Bot / Scalper. When OFF, the Vantage tab is hidden. Default ON.",
  },
  forex_broker_tiomarkets: {
    label: "Forex broker — TIOmarkets",
    description:
      "When ON, users can connect a TIOmarkets MT4/MT5 account and pick it for Nova Forex Bot / Scalper. When OFF, the TIOmarkets tab is hidden. Default ON.",
  },
  forex_broker_assexmarkets: {
    label: "Forex broker — Assexmarkets",
    description:
      "When ON, users can connect an Assexmarkets MT4/MT5 account and pick it for Nova Forex Bot / Scalper. When OFF, the Assexmarkets tab is hidden. Default OFF.",
  },
  nova_liquidation_map: {
    label: "Liquidation Map (Crypto Futures)",
    description:
      "When ON, VIP users see the Liquidation Map subtab under Crypto Futures (symbol search for BTC/ETH/SOL/XAU-style contracts, liquidity zones, stop/liquidation clusters, and AI trade area guidance). Default OFF until you enable it.",
  },
  nova_futures_narratives: {
    label: "Nova Futures Narratives",
    description:
      "When ON, VIP users see the standalone Nova Futures Narratives tab (headline + CFTC institutional narrative read). Default OFF until you enable it.",
  },
  nova_meme_intelligence: {
    label: "Nova Meme Intelligence",
    description:
      "When ON, VIP users see the Nova Meme Intelligence tab with meme-focused technical analysis tools. Default OFF until you enable it.",
  },
  nova_q_memes: {
    label: "NovaQ - Memes",
    description:
      "When ON, VIP users can use NovaQ - Memes for support/resistance, market structure, trendline, liquidity reads, and dead/downside warnings.",
  },
  nova_smart_memes: {
    label: "Nova Smart Analysis for Memes",
    description:
      "When ON, VIP users can run Nova Smart Analysis for Memes for entry/exit ideas, direction bias, trendline confidence, and risk notes.",
  },
  nova_top_meme_coins: {
    label: "Top Meme coins",
    description:
      "When ON, VIP users can access Top Meme coins to discover more stable, liquid meme coins with filters against honeypots and weak setups.",
  },
  nova_meme_price_factor: {
    label: "Meme Price Factor",
    description:
      "When ON, VIP users can access Meme Price Factor under Nova Meme Intelligence to analyze high/low market-cap bands and touch counts by timeframe for Solana/BSC contracts.",
  },
  nova_meme_runner: {
    label: "Meme Runner (Nova Meme Intelligence)",
    description:
      "When ON, VIP users see Meme Runner under Nova Meme Intelligence — multi-chain trenches (SOL, BSC, ETH) with launchpad filters. Configure in Admin → Meme Runner.",
  },
  nova_gmgn_vip_bot: {
    label: "GMGN VIP Bot — master",
    description:
      "Master switch for GMGN meme trading bot tab (SOL, BSC, Robinhood). Pair with owner-only flag. Default OFF.",
  },
  nova_gmgn_vip_bot_owner_only: {
    label: "GMGN VIP Bot — owner only",
    description:
      "When master is ON and this is ON, only the owner sees GMGN VIP Bot (test mode). Turn OFF for All VIP. Default ON.",
  },
  nova_gmgn_vip_bot_cron: {
    label: "GMGN VIP Bot — auto-scan cron",
    description:
      "When ON, server cron scans GMGN trending for users with bot enabled in auto/semi-auto mode. Default OFF.",
  },
  page_tab_gmgn_vip_bot: {
    label: "Tab: GMGN VIP Bot",
    description: "Show/hide the GMGN VIP Bot top-level tab. Also managed in Admin → Product visibility.",
  },
  nova_perp_wallet_analyst: {
    label: "Nova Perp Wallet Analyst Agent (Wallet Tracker)",
    description:
      "When ON, any VIP user (including coach users) and the owner see this Wallet Tracker subtab to analyze a pasted perp wallet, review open positions and win/loss profile, and add wallets to personal/global lists.",
  },
  page_tab_meme_coins_traders: {
    label: "Meme coins — Meme Coins Traders",
    description:
      "When ON, the Meme Coins Traders sub-tab is visible under Wallet Tracker → Meme coins (per-user wallet tracking + 3-buyer alerts). Turn OFF to hide without affecting futures/perps subtabs.",
  },
  page_tab_leverage_traders: {
    label: "Futures & perps — Top Leverage Traders",
    description:
      "When ON, the Top Leverage Traders sub-tab is visible under Wallet Tracker → Futures & perps. Turn OFF to hide leverage rankings while keeping meme or perp-analyst subtabs.",
  },
  nova_meme_leaderboard: {
    label: "Meme Coin Advantage Bundle (Wallet Tracker)",
    description:
      "When ON, VIP users see the Meme Coin Advantage Bundle subtab under Wallet Tracker — combining Wallet Tracker + Wallet Analyzer + Leaderboard. Includes free-API meme PnL rankings (Helius free tier + Dexscreener no-key), per-wallet copy-trade verdict, user-managed personal wallets, and owner promote-to-global. Owner can refresh snapshots; users can change period.",
  },
  nova_deep_meme_agent: {
    label: "Deep Meme Agent (Wallet Tracker)",
    description:
      "When ON, VIP users see the Deep Meme Agent subtab under Wallet Tracker. Paste a Solana, BSC, or Ethereum contract to get a full report: token overview (Dexscreener), security flags + top holders (GoPlus free API), honeypot/rug detection, dev/creator wallet, and per-holder classification (Dev, Whale, LP, Sniper/Bot, Pro, Fresh) with one-click Track or Analyze actions that hand off to the Meme Coin Advantage Bundle.",
  },
  nova_smart_money_alerts: {
    label: "Smart Money Alerts / FOMO Tracker (Wallet Tracker)",
    description:
      "Master switch. When ON, VIP users can use Smart Money Alerts under Wallet Tracker (sized buys ≥$2k/$10k, held >5m, still holding, sold). Pair with owner-only flag. Default OFF.",
  },
  nova_smart_money_alerts_owner_only: {
    label: "Smart Money Alerts — owner only",
    description:
      "When master is ON and this is ON, only the owner sees Smart Money Alerts (test mode). Turn OFF for All VIP. Default ON.",
  },
  nova_early_catch: {
    label: "Early Catch (Narratives)",
    description:
      "Master switch. When ON, VIP users see Early Catch under Narratives — fresh (<~3d) micro-caps with narrative heat + early flow under ~$20k mcap. Pair with owner-only flag. Default OFF.",
  },
  nova_early_catch_owner_only: {
    label: "Early Catch — owner only",
    description:
      "When master is ON and this is ON, only the owner sees Early Catch (test mode). Turn OFF for All VIP. Default ON.",
  },
  vercel_cron_enabled: {
    label: "Vercel scheduled cron (master)",
    description:
      "When ON, Vercel runs /api/cron once daily (00:00 UTC): Birdeye scan, CT/Twitter scan, wallet Telegram alerts, leverage alerts, pinned token re-analyze, trading bot, perp listing/alerts, Blofin breakout, NovaScalper batch (if enabled), meme leaderboard refresh (if enabled). Does NOT include Daily Futures Wrap or VIP emails anymore — those use dedicated light crons. Turn OFF to skip the heavy chain and save CPU. Manual Scan buttons still work.",
  },
  futures_daily_wrap_cron: {
    label: "Daily Futures Wrap cron (lightweight)",
    description:
      "When ON (default), Vercel runs /api/cron/perp-digest daily at 00:05 UTC: one Hyperliquid fetch, store Daily Wrap, Telegram + optional Daily Futures Brief emails. Independent of the heavy master cron — keep this ON while master is OFF. When OFF, no auto wrap/emails (in-app Daily Wrap tab still visible but empty until you trigger manually).",
  },
  digest_to_newsletter_subscribers: {
    label: "Send digest to newsletter subscribers",
    description:
      "When ON, the Daily Futures Brief teaser is emailed to users who opted in at registration. When OFF, digest email goes only to DIGEST_EMAIL_TO (plus Telegram). Requires Daily Futures Wrap cron ON. In-app Daily Wrap still updates when the wrap cron runs.",
  },
  email_notifications_cron: {
    label: "Email notifications cron (dedicated)",
    description:
      "When ON (default), Vercel runs /api/cron/emails daily at 00:15 UTC for auto emails only (VIP expiry + VIP trial reminders). Independent of the master cron — keep this ON even if you turn master cron OFF. When OFF, no automatic VIP emails fire (Admin → Emails presets still work for manual sends).",
  },
  vip_expiry_emails: {
    label: "VIP expiry emails (auto pre + post)",
    description:
      "When ON (default), the email notifications cron sends at most one “VIP ends soon” and one “VIP has ended” email per paid subscription (Stripe card or USDC only). Owner/admin complimentary grants are never emailed. When OFF, those automatic emails are skipped (Admin → Emails presets still work for manual sends). Requires Email notifications cron ON.",
  },
  vip_trial_reminder_emails: {
    label: "VIP trial reminder emails (auto)",
    description:
      "When ON (default), the email notifications cron sends the trial-ending reminder (~hours before charge, from Admin → VIP trial settings). When OFF, trial reminders are skipped. Requires Email notifications cron ON. Manual preset: Admin → Emails → VIP trial ending.",
  },
  welcome_auto_email: {
    label: "Welcome email on signup (auto)",
    description:
      "When ON (default), new email/password and first-time Google signups receive the Welcome / Start here email once. When OFF, no auto welcome (you can still send the preset from Admin → Emails). Log of recent auto welcomes is on Admin → Emails.",
  },
  analytics_ping_enabled: {
    label: "Analytics page pings",
    description:
      "When ON, visitors record page views to /api/analytics on navigation (powers Admin → Insights and live activity data). When OFF, no analytics DB writes from client pings. Does not stop AI usage metrics or subscription data.",
  },
  login_location_intel: {
    label: "Login location intel (multi-location flags)",
    description:
      "When ON, successful sign-ins record approximate city/country/device for Admin → Customers multi-location detection (small DB write per login + a query when you open Customers). When OFF, no login events are written and Customers skips that query — use this to save a little DB/CPU if you are not reviewing sharing. Default ON.",
  },
  live_activity_enabled: {
    label: "Live activity panel (Admin → Metrics)",
    description:
      "When ON, the owner Live activity section polls every 30s while Admin → Metrics is open. When OFF, that panel is disabled (stops polling and heavy DB reads). Turn OFF when you are not watching who is online.",
  },
  live_support_chat: {
    label: "Live support chat (Need Help + admin inbox alerts)",
    description:
      "When ON, customers see the Need Help widget and owner live-transfer polling / agent presence heartbeats run. When OFF (default), the widget is hidden and those polls stop — turn ON only when you are staffing live chat. Saves Fluid Active CPU.",
  },
  pnl_share_show_usd: {
    label: "PNL share — Show USD / Realized USDT",
    description:
      "When ON, Nova Bot and Nova Forex share-card options include “Show USD / Realized USDT”. When OFF, that checkbox is hidden for everyone. Default ON.",
  },
  pnl_share_show_invested: {
    label: "PNL share — Show Invested",
    description:
      "When ON, Nova Bot and Nova Forex share-card options include “Show Invested”. When OFF, that checkbox is hidden for everyone. Default ON.",
  },
  pnl_share_show_held_for: {
    label: "PNL share — Show Held for",
    description:
      "When ON, Nova Bot and Nova Forex share-card options include “Show Held for”. When OFF, that checkbox is hidden for everyone. Default ON.",
  },
  pnl_share_show_leverage: {
    label: "PNL share — Show leverage",
    description:
      "When ON, Nova Bot and Nova Forex share-card options include “Show leverage”. When OFF, that checkbox is hidden for everyone. Default ON.",
  },
  pnl_share_card_message: {
    label: "PNL share — Card message",
    description:
      "When ON, Nova Bot and Nova Forex show the optional “Card message” text field on share cards (e.g. ZaZa Smashed it). When OFF (default), the field is hidden for everyone.",
  },
  pnl_share_show_referral: {
    label: "PNL share — Referral code + QR",
    description:
      "When ON, share cards can include the user’s personal NovaStaris invite code and QR (Affiliate). Users can still uncheck “Include my invite” before sharing. When OFF, referral branding is hidden for everyone. Default ON.",
  },
};

export default function AdminFeatureFlagsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightFlag = (searchParams.get("flag") ?? "").trim();
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [toggling, setToggling] = useState<string | null>(null);
  const [aiAgentQuotas, setAiAgentQuotas] = useState<AiAgentQuotasState>(DEFAULT_AI_AGENT_QUOTAS);
  const [aiAgentQuotasDraft, setAiAgentQuotasDraft] = useState<AiAgentQuotasDraft>(quotasToDraft(DEFAULT_AI_AGENT_QUOTAS));
  const [aiAgentQuotasSaving, setAiAgentQuotasSaving] = useState(false);
  const [goHuntingRefresh, setGoHuntingRefresh] = useState<GoHuntingRefreshAdminState>(DEFAULT_GO_HUNTING_REFRESH_ADMIN);
  const [goHuntingRefreshDraft, setGoHuntingRefreshDraft] = useState<GoHuntingRefreshDraft>(
    goHuntingRefreshToDraft(DEFAULT_GO_HUNTING_REFRESH_ADMIN)
  );
  const [goHuntingRefreshSaving, setGoHuntingRefreshSaving] = useState(false);
  const [goHuntingRefreshResetting, setGoHuntingRefreshResetting] = useState(false);
  const [goHuntingRefreshResetEmail, setGoHuntingRefreshResetEmail] = useState("");

  useEffect(() => {
    if (!highlightFlag.startsWith("page_tab_") || highlightFlag === "page_tab_nova_job_agent" || highlightFlag === "page_tab_coach_calls") return;
    const row =
      PRODUCT_VISIBILITY_FLAG_ROWS.find((r) => r.flagKey === highlightFlag) ??
      PRODUCT_VISIBILITY_SUBTAB_FLAGS.find((r) => r.flagKey === highlightFlag);
    router.replace(row ? `/admin/tab-visibility#vis-${row.tabId}` : "/admin/tab-visibility");
  }, [highlightFlag, router]);

  useEffect(() => {
    if (!highlightFlag || loading) return;
    const el = document.getElementById(`flag-${highlightFlag}`);
    if (!el) return;
    const details = el.closest("details");
    if (details) details.open = true;
    window.setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
  }, [highlightFlag, loading, flags]);

  const load = () =>
    Promise.all([
      fetch("/api/admin/feature-flags").then((r) => r.json()),
      fetch("/api/admin/ai-agent-quotas").then((r) => r.json()),
      fetch("/api/admin/go-hunting-refresh").then((r) => r.json()),
    ])
      .then(([flagsData, quotasData, goHuntingData]) => {
        if (flagsData.success) setFlags(flagsData.flags ?? {});
        else setError(flagsData.error ?? "Failed to load");
        if (quotasData.success && quotasData.quotas) {
          const q = quotasData.quotas as AiAgentQuotasState;
          setAiAgentQuotas(q);
          setAiAgentQuotasDraft(quotasToDraft(q));
        }
        if (goHuntingData.success && goHuntingData.config) {
          const g = goHuntingData.config as GoHuntingRefreshAdminState;
          setGoHuntingRefresh(g);
          setGoHuntingRefreshDraft(goHuntingRefreshToDraft(g));
        }
      })
      .catch(() => setError("Failed to load"))
      .finally(() => {
        setLoading(false);
      });

  useEffect(() => {
    if (status !== "authenticated") return;
    load();
  }, [status]);

  const patchAiAgentQuotas = async () => {
    const memeDaily = Number(aiAgentQuotasDraft.memeAgentFreeDailyLimit);
    const chartDaily = Number(aiAgentQuotasDraft.chartAnalysisFreeDailyLimit);
    if (!Number.isFinite(memeDaily) || !Number.isFinite(chartDaily)) {
      setError("Enter valid daily limits.");
      return;
    }
    const parseOptional = (raw: string): number | null => {
      const t = raw.trim();
      if (!t) return null;
      const n = Number(t);
      if (!Number.isFinite(n)) return null;
      return n;
    };
    const memeWeekly = parseOptional(aiAgentQuotasDraft.memeAgentFreeWeeklyLimit);
    const memeMonthly = parseOptional(aiAgentQuotasDraft.memeAgentFreeMonthlyLimit);
    const chartWeekly = parseOptional(aiAgentQuotasDraft.chartAnalysisFreeWeeklyLimit);
    const chartMonthly = parseOptional(aiAgentQuotasDraft.chartAnalysisFreeMonthlyLimit);
    if (
      (aiAgentQuotasDraft.memeAgentFreeWeeklyLimit.trim() && memeWeekly === null) ||
      (aiAgentQuotasDraft.memeAgentFreeMonthlyLimit.trim() && memeMonthly === null) ||
      (aiAgentQuotasDraft.chartAnalysisFreeWeeklyLimit.trim() && chartWeekly === null) ||
      (aiAgentQuotasDraft.chartAnalysisFreeMonthlyLimit.trim() && chartMonthly === null)
    ) {
      setError("Enter valid weekly/monthly limits or leave blank to disable.");
      return;
    }
    setAiAgentQuotasSaving(true);
    setError("");
    setSuccessMessage("");
    try {
      const res = await fetch("/api/admin/ai-agent-quotas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memeAgentFreeDailyLimit: memeDaily,
          memeAgentFreeWeeklyLimit: memeWeekly,
          memeAgentFreeMonthlyLimit: memeMonthly,
          chartAnalysisFreeDailyLimit: chartDaily,
          chartAnalysisFreeWeeklyLimit: chartWeekly,
          chartAnalysisFreeMonthlyLimit: chartMonthly,
        }),
      });
      const data = await res.json();
      if (data.success && data.quotas) {
        const q = data.quotas as AiAgentQuotasState;
        setAiAgentQuotas(q);
        setAiAgentQuotasDraft(quotasToDraft(q));
        setSuccessMessage("AI Agent limits updated.");
        setTimeout(() => setSuccessMessage(""), 4000);
      } else setError(data.error ?? "Update failed");
    } catch {
      setError("Update failed");
    } finally {
      setAiAgentQuotasSaving(false);
    }
  };

  const patchGoHuntingRefresh = async () => {
    const guest = Number(goHuntingRefreshDraft.guestIntervalMinutes);
    const free = Number(goHuntingRefreshDraft.freeMemberIntervalMinutes);
    const freeAuto = Number(goHuntingRefreshDraft.freeAutoRefreshMinutes);
    const vipDaily = Number(goHuntingRefreshDraft.vipDailyLimit);
    const vipAuto = Number(goHuntingRefreshDraft.vipAutoRefreshMinutes);
    if (
      !Number.isFinite(guest) ||
      !Number.isFinite(free) ||
      !Number.isFinite(freeAuto) ||
      !Number.isFinite(vipDaily) ||
      !Number.isFinite(vipAuto)
    ) {
      setError("Enter valid values for Go Hunting refresh.");
      return;
    }
    setGoHuntingRefreshSaving(true);
    setError("");
    setSuccessMessage("");
    try {
      const res = await fetch("/api/admin/go-hunting-refresh", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestIntervalMinutes: guest,
          freeMemberIntervalMinutes: free,
          guestAutoRefreshEnabled: goHuntingRefreshDraft.guestAutoRefreshEnabled,
          freeAutoRefreshEnabled: goHuntingRefreshDraft.freeAutoRefreshEnabled,
          freeAutoRefreshMinutes: freeAuto,
          vipDailyLimit: vipDaily,
          vipAutoRefreshEnabled: goHuntingRefreshDraft.vipAutoRefreshEnabled,
          vipAutoRefreshMinutes: vipAuto,
        }),
      });
      const data = await res.json();
      if (data.success && data.config) {
        const g = data.config as GoHuntingRefreshAdminState;
        setGoHuntingRefresh(g);
        setGoHuntingRefreshDraft(goHuntingRefreshToDraft(g));
        setSuccessMessage("Market refresh limits updated.");
        setTimeout(() => setSuccessMessage(""), 4000);
      } else setError(data.error ?? "Update failed");
    } catch {
      setError("Update failed");
    } finally {
      setGoHuntingRefreshSaving(false);
    }
  };

  const resetGoHuntingRefresh = async (scope: "all" | "user") => {
    if (scope === "all" && !window.confirm("Reset market refresh limits for ALL users (guests, free, VIP)?")) return;
    if (scope === "user" && !goHuntingRefreshResetEmail.trim()) {
      setError("Enter a user email to reset individually.");
      return;
    }
    setGoHuntingRefreshResetting(true);
    setError("");
    setSuccessMessage("");
    try {
      const res = await fetch("/api/admin/go-hunting-refresh/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          scope === "all"
            ? { scope: "all" }
            : { scope: "user", email: goHuntingRefreshResetEmail.trim() }
        ),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMessage(data.message ?? "Refresh limits reset.");
        if (scope === "user") setGoHuntingRefreshResetEmail("");
        setTimeout(() => setSuccessMessage(""), 5000);
      } else setError(data.error ?? "Reset failed");
    } catch {
      setError("Reset failed");
    } finally {
      setGoHuntingRefreshResetting(false);
    }
  };

  const handleToggle = async (key: string) => {
    const next = !flags[key];
    setToggling(key);
    setError("");
    setSuccessMessage("");
    try {
      const res = await fetch("/api/admin/feature-flags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, enabled: next }),
      });
      const data = await res.json();
      if (data.success) {
        setFlags(data.flags ?? {});
        setSuccessMessage(next ? "Turned on." : "Turned off.");
        setTimeout(() => setSuccessMessage(""), 4000);
      } else setError(data.error ?? "Update failed");
    } catch {
      setError("Update failed");
    } finally {
      setToggling(null);
    }
  };

  /** Off | Owner only (test) | All VIP — for Nova Forex bots. VIP-only features; never free users. */
  type ForexAudience = "off" | "owner" | "vip";
  const forexAudienceFromFlags = (masterKey: string, ownerOnlyKey: string): ForexAudience => {
    if (!flags[masterKey]) return "off";
    if (flags[ownerOnlyKey]) return "owner";
    return "vip";
  };
  const setForexAudience = async (masterKey: string, ownerOnlyKey: string, audience: ForexAudience) => {
    setToggling(masterKey);
    setError("");
    setSuccessMessage("");
    const updates =
      audience === "off"
        ? [
            { key: masterKey, enabled: false },
            { key: ownerOnlyKey, enabled: true },
          ]
        : audience === "owner"
          ? [
              { key: masterKey, enabled: true },
              { key: ownerOnlyKey, enabled: true },
            ]
          : [
              { key: masterKey, enabled: true },
              { key: ownerOnlyKey, enabled: false },
            ];
    try {
      const res = await fetch("/api/admin/feature-flags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      const data = await res.json();
      if (data.success) {
        setFlags(data.flags ?? {});
        setSuccessMessage(
          audience === "off"
            ? "Turned off for everyone."
            : audience === "owner"
              ? "Owner-only testing ON (VIP users cannot see it yet)."
              : "Enabled for all VIP users."
        );
        setTimeout(() => setSuccessMessage(""), 5000);
      } else setError(data.error ?? "Update failed");
    } catch {
      setError("Update failed");
    } finally {
      setToggling(null);
    }
  };

  const isOwner = (session?.user as { isOwner?: boolean })?.isOwner ?? false;

  if (status === "loading" || !session) {
    return (
      <div className="flex items-center justify-center py-16">
        <Card className="w-full max-w-4xl">
          <CardContent className="py-8 text-center text-muted-foreground">
            {status === "loading" ? "Loading…" : "Sign in to manage feature flags."}
            {!session && (
              <p className="mt-2">
                <Link href="/signin" className="underline">Sign in</Link>
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="flex items-center justify-center py-16">
        <Card className="w-full max-w-4xl">
          <CardContent className="py-8 text-center text-muted-foreground">
            Owner only. Only owner emails (OWNER_EMAIL) can turn notifications and API usage on or off.
            <p className="mt-2">
              <Link href="/" className="underline">Back to app</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const flagEntries = Object.entries(FLAG_LABELS);
  const flagGroupId = (key: string) => {
    for (const g of FLAG_GROUPS) {
      if (g.id === "other") continue;
      if (g.match(key)) return g.id;
    }
    return "other";
  };
  const hideFromFlagsList = (key: string) =>
    (key.startsWith("page_tab_") && key !== "page_tab_nova_job_agent" && key !== "page_tab_coach_calls") ||
    key === "coach_calls_owner_only" ||
    key === "nova_crypto_buddie_owner_only" ||
    key === "nova_smart_money_alerts" ||
    key === "nova_smart_money_alerts_owner_only" ||
    key === "nova_early_catch" ||
    key === "nova_early_catch_owner_only" ||
    key === "nova_gmgn_vip_bot" ||
    key === "nova_gmgn_vip_bot_owner_only" ||
    key === "nova_gmgn_vip_bot_cron" ||
    key === "page_tab_gmgn_vip_bot";
  const groupedFlags = FLAG_GROUPS.map((g) => ({
    ...g,
    entries: flagEntries.filter(([key]) => !hideFromFlagsList(key) && flagGroupId(key) === g.id),
  })).filter(
    (g) =>
      g.entries.length > 0 ||
      g.id === "nova-jobs-agent" ||
      g.id === "coach-calls" ||
      g.id === "crypto-buddie" ||
      g.id === "gmgn-vip-bot" ||
      g.id === "narratives-early" ||
      g.id === "wallet-subs"
  );

  return (
    <div className="max-w-3xl">
        <AdminPageHeader
          title="Feature flags"
          description="Kill-switches for APIs, bots, and experiments. Dashboard tab On/Off, owner-only locks, and NEW badges live under Product visibility."
        />

        <Card className="mb-6 border-cyan-200/80 dark:border-cyan-900/50 bg-cyan-50/40 dark:bg-cyan-950/20">
          <CardContent className="py-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Looking for tabs or NEW badges?</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Show/Hide, owner-only, and green NEW pills are on one page now.
              </p>
            </div>
            <Button size="sm" asChild>
              <Link href="/admin/tab-visibility">Open Product visibility</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-zinc-200 dark:border-zinc-800">
          <CardContent className="space-y-4 pt-6">
            {successMessage && (
              <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 text-sm px-3 py-2">
                {successMessage}
              </div>
            )}
            {error && (
              <div className="rounded-md bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-sm px-3 py-2">
                {error}
              </div>
            )}
            {loading ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : (
              <div className="space-y-6">
                <div className="rounded-xl border border-cyan-200/80 dark:border-cyan-800/60 bg-cyan-50/30 dark:bg-cyan-950/20 p-4 space-y-3">
                  <div>
                    <p className="font-semibold text-zinc-900 dark:text-zinc-100">NovaStaris AI Agent — free-tier limits</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Daily limits always apply. Weekly and monthly caps are optional (leave blank to disable). All windows stack. VIP is unlimited. Per-user overrides (daily / weekly / monthly): Admin → Customers → Manage.
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="text-sm w-full min-w-[520px]">
                      <thead>
                        <tr className="text-left text-xs text-muted-foreground">
                          <th className="pb-2 pr-4 font-medium">Feature</th>
                          <th className="pb-2 pr-3 font-medium">Daily</th>
                          <th className="pb-2 pr-3 font-medium">Weekly</th>
                          <th className="pb-2 font-medium">Monthly</th>
                        </tr>
                      </thead>
                      <tbody className="align-top">
                        <tr>
                          <td className="py-1.5 pr-4 font-medium text-zinc-800 dark:text-zinc-200">Meme Coins Agent</td>
                          <td className="py-1.5 pr-3">
                            <input
                              type="number"
                              min={0}
                              max={1000}
                              value={aiAgentQuotasDraft.memeAgentFreeDailyLimit}
                              onChange={(e) => setAiAgentQuotasDraft((d) => ({ ...d, memeAgentFreeDailyLimit: e.target.value }))}
                              className="w-20 rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
                            />
                          </td>
                          <td className="py-1.5 pr-3">
                            <input
                              type="number"
                              min={0}
                              max={1000}
                              placeholder="—"
                              value={aiAgentQuotasDraft.memeAgentFreeWeeklyLimit}
                              onChange={(e) => setAiAgentQuotasDraft((d) => ({ ...d, memeAgentFreeWeeklyLimit: e.target.value }))}
                              className="w-20 rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
                            />
                          </td>
                          <td className="py-1.5">
                            <input
                              type="number"
                              min={0}
                              max={1000}
                              placeholder="—"
                              value={aiAgentQuotasDraft.memeAgentFreeMonthlyLimit}
                              onChange={(e) => setAiAgentQuotasDraft((d) => ({ ...d, memeAgentFreeMonthlyLimit: e.target.value }))}
                              className="w-20 rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
                            />
                          </td>
                        </tr>
                        <tr>
                          <td className="py-1.5 pr-4 font-medium text-zinc-800 dark:text-zinc-200">Chart Analysis</td>
                          <td className="py-1.5 pr-3">
                            <input
                              type="number"
                              min={0}
                              max={1000}
                              value={aiAgentQuotasDraft.chartAnalysisFreeDailyLimit}
                              onChange={(e) => setAiAgentQuotasDraft((d) => ({ ...d, chartAnalysisFreeDailyLimit: e.target.value }))}
                              className="w-20 rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
                            />
                          </td>
                          <td className="py-1.5 pr-3">
                            <input
                              type="number"
                              min={0}
                              max={1000}
                              placeholder="—"
                              value={aiAgentQuotasDraft.chartAnalysisFreeWeeklyLimit}
                              onChange={(e) => setAiAgentQuotasDraft((d) => ({ ...d, chartAnalysisFreeWeeklyLimit: e.target.value }))}
                              className="w-20 rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
                            />
                          </td>
                          <td className="py-1.5">
                            <input
                              type="number"
                              min={0}
                              max={1000}
                              placeholder="—"
                              value={aiAgentQuotasDraft.chartAnalysisFreeMonthlyLimit}
                              onChange={(e) => setAiAgentQuotasDraft((d) => ({ ...d, chartAnalysisFreeMonthlyLimit: e.target.value }))}
                              className="w-20 rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
                            />
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button size="sm" onClick={patchAiAgentQuotas} disabled={aiAgentQuotasSaving}>
                      {aiAgentQuotasSaving ? "Saving…" : "Save limits"}
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Current — Meme: {formatQuotaSummary(aiAgentQuotas, "meme")} · Chart: {formatQuotaSummary(aiAgentQuotas, "chart")}
                  </p>
                </div>
                <div className="rounded-xl border border-amber-200/80 dark:border-amber-800/60 bg-amber-50/30 dark:bg-amber-950/20 p-4 space-y-3">
                  <div>
                    <p className="font-semibold text-zinc-900 dark:text-zinc-100">Market data refresh limits</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Shared across <strong>Go Hunting (Sol + BSC)</strong>, <strong>Trending</strong>, and{" "}
                      <strong>Surge</strong>. Opening tabs or switching views does <strong>not</strong> count — only
                      the Refresh button, Scan, or enabled auto-refresh. Owner is always unlimited.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <label className="space-y-1">
                      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Guest manual refresh (minutes)</span>
                      <input
                        type="number"
                        min={0}
                        max={1440}
                        value={goHuntingRefreshDraft.guestIntervalMinutes}
                        onChange={(e) => setGoHuntingRefreshDraft((d) => ({ ...d, guestIntervalMinutes: e.target.value }))}
                        className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Free member manual refresh (minutes)</span>
                      <input
                        type="number"
                        min={0}
                        max={1440}
                        value={goHuntingRefreshDraft.freeMemberIntervalMinutes}
                        onChange={(e) => setGoHuntingRefreshDraft((d) => ({ ...d, freeMemberIntervalMinutes: e.target.value }))}
                        className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
                      />
                    </label>
                    <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
                      <span className="text-sm text-zinc-700 dark:text-zinc-300">Guest auto-refresh</span>
                      <Button
                        type="button"
                        size="sm"
                        variant={goHuntingRefreshDraft.guestAutoRefreshEnabled ? "default" : "outline"}
                        onClick={() => setGoHuntingRefreshDraft((d) => ({ ...d, guestAutoRefreshEnabled: true }))}
                      >
                        On
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={!goHuntingRefreshDraft.guestAutoRefreshEnabled ? "default" : "outline"}
                        onClick={() => setGoHuntingRefreshDraft((d) => ({ ...d, guestAutoRefreshEnabled: false }))}
                      >
                        Off
                      </Button>
                    </div>
                    <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
                      <span className="text-sm text-zinc-700 dark:text-zinc-300">Free-member auto-refresh</span>
                      <Button
                        type="button"
                        size="sm"
                        variant={goHuntingRefreshDraft.freeAutoRefreshEnabled ? "default" : "outline"}
                        onClick={() => setGoHuntingRefreshDraft((d) => ({ ...d, freeAutoRefreshEnabled: true }))}
                      >
                        On
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={!goHuntingRefreshDraft.freeAutoRefreshEnabled ? "default" : "outline"}
                        onClick={() => setGoHuntingRefreshDraft((d) => ({ ...d, freeAutoRefreshEnabled: false }))}
                      >
                        Off
                      </Button>
                    </div>
                    <label className="space-y-1 sm:col-span-2">
                      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Free auto-refresh interval (minutes)</span>
                      <input
                        type="number"
                        min={1}
                        max={1440}
                        value={goHuntingRefreshDraft.freeAutoRefreshMinutes}
                        onChange={(e) => setGoHuntingRefreshDraft((d) => ({ ...d, freeAutoRefreshMinutes: e.target.value }))}
                        className="w-full max-w-xs rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">VIP daily shared limit (0 = unlimited)</span>
                      <input
                        type="number"
                        min={0}
                        max={10000}
                        value={goHuntingRefreshDraft.vipDailyLimit}
                        onChange={(e) => setGoHuntingRefreshDraft((d) => ({ ...d, vipDailyLimit: e.target.value }))}
                        className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">VIP auto-refresh interval (minutes)</span>
                      <input
                        type="number"
                        min={1}
                        max={1440}
                        value={goHuntingRefreshDraft.vipAutoRefreshMinutes}
                        onChange={(e) => setGoHuntingRefreshDraft((d) => ({ ...d, vipAutoRefreshMinutes: e.target.value }))}
                        className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
                      />
                    </label>
                    <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
                      <span className="text-sm text-zinc-700 dark:text-zinc-300">VIP auto-refresh (Go Hunting / Trending / Surge)</span>
                      <Button
                        type="button"
                        size="sm"
                        variant={goHuntingRefreshDraft.vipAutoRefreshEnabled ? "default" : "outline"}
                        onClick={() => setGoHuntingRefreshDraft((d) => ({ ...d, vipAutoRefreshEnabled: true }))}
                      >
                        On
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={!goHuntingRefreshDraft.vipAutoRefreshEnabled ? "default" : "outline"}
                        onClick={() => setGoHuntingRefreshDraft((d) => ({ ...d, vipAutoRefreshEnabled: false }))}
                      >
                        Off
                      </Button>
                      <span className="text-xs text-muted-foreground">Counts toward daily limit; pauses when tab is hidden</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button size="sm" onClick={patchGoHuntingRefresh} disabled={goHuntingRefreshSaving}>
                      {goHuntingRefreshSaving ? "Saving…" : "Save market refresh limits"}
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Current — Guest: {goHuntingRefresh.guestIntervalMinutes}m manual
                    {goHuntingRefresh.guestAutoRefreshEnabled ? " · auto on" : " · auto off"} · Free:{" "}
                    {goHuntingRefresh.freeMemberIntervalMinutes}m manual
                    {goHuntingRefresh.freeAutoRefreshEnabled
                      ? ` · auto every ${goHuntingRefresh.freeAutoRefreshMinutes}m`
                      : " · auto off"}{" "}
                    · VIP: {goHuntingRefresh.vipDailyLimit === 0 ? "unlimited/day" : `${goHuntingRefresh.vipDailyLimit}/day shared`}
                    {goHuntingRefresh.vipAutoRefreshEnabled
                      ? ` · auto every ${goHuntingRefresh.vipAutoRefreshMinutes}m`
                      : " · auto off"}
                  </p>
                  <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white/60 dark:bg-zinc-900/40 p-3 space-y-2">
                    <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Reset refresh counters</p>
                    <p className="text-[11px] text-muted-foreground">
                      Clears cooldown / daily VIP counts so users can refresh again immediately. Owner is always unlimited and unaffected.
                    </p>
                    <div className="flex flex-wrap items-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={goHuntingRefreshResetting}
                        onClick={() => void resetGoHuntingRefresh("all")}
                      >
                        {goHuntingRefreshResetting ? "…" : "Reset all users"}
                      </Button>
                      <input
                        type="email"
                        placeholder="user@email.com"
                        value={goHuntingRefreshResetEmail}
                        onChange={(e) => setGoHuntingRefreshResetEmail(e.target.value)}
                        className="min-w-[200px] flex-1 rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={goHuntingRefreshResetting || !goHuntingRefreshResetEmail.trim()}
                        onClick={() => void resetGoHuntingRefresh("user")}
                      >
                        Reset this user
                      </Button>
                    </div>
                  </div>
                </div>
                {groupedFlags.map((group) => (
                  <details key={group.id} open className="rounded-xl border border-zinc-200 dark:border-zinc-700">
                    <summary className="cursor-pointer px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-100 list-none flex items-center justify-between">
                      {group.title}
                      <span className="text-xs font-normal text-muted-foreground">{group.entries.length} flags</span>
                    </summary>
                    {group.id === "nova-jobs-agent" ? (
                      <div className="space-y-4 px-4 pb-4 border-t border-zinc-200 dark:border-zinc-700 pt-3">
                        <p className="text-xs text-muted-foreground">
                          Nova Jobs Agent will be <strong className="text-zinc-800 dark:text-zinc-200">VIP only</strong> when
                          rolled out. Use <strong className="text-zinc-800 dark:text-zinc-200">Owner only</strong> while
                          testing, then <strong className="text-zinc-800 dark:text-zinc-200">All VIP</strong> when ready.
                          You can still grant individual customers via Admin → Customers.
                        </p>
                        {(() => {
                          const audience = forexAudienceFromFlags(
                            "page_tab_nova_job_agent",
                            "nova_job_agent_owner_only"
                          );
                          const busy = toggling === "page_tab_nova_job_agent";
                          return (
                            <div className="rounded-lg bg-zinc-50/80 dark:bg-zinc-900/50 p-3 space-y-3">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium text-zinc-900 dark:text-zinc-100">Nova Jobs Agent</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    Resume upload, JD-tuned resume + cover letters, multi-board search, application tracker.
                                  </p>
                                </div>
                                <span
                                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                    audience === "off"
                                      ? "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400"
                                      : audience === "owner"
                                        ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                                        : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                  }`}
                                >
                                  {audience === "off" ? "OFF" : audience === "owner" ? "OWNER ONLY" : "ALL VIP"}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {(
                                  [
                                    { id: "off" as const, label: "Off" },
                                    { id: "owner" as const, label: "Owner only (test)" },
                                    { id: "vip" as const, label: "All VIP" },
                                  ] as const
                                ).map((opt) => (
                                  <Button
                                    key={opt.id}
                                    size="sm"
                                    variant={audience === opt.id ? "default" : "outline"}
                                    disabled={busy}
                                    onClick={() =>
                                      void setForexAudience(
                                        "page_tab_nova_job_agent",
                                        "nova_job_agent_owner_only",
                                        opt.id
                                      )
                                    }
                                  >
                                    {busy && audience !== opt.id ? "…" : opt.label}
                                  </Button>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    ) : group.id === "coach-calls" ? (
                      <div className="space-y-4 px-4 pb-4 border-t border-zinc-200 dark:border-zinc-700 pt-3">
                        <p className="text-xs text-muted-foreground">
                          The Coach Calls tab stays <strong className="text-zinc-800 dark:text-zinc-200">visible to everyone</strong>{" "}
                          when enabled. Guests and free users see a VIP upgrade lock. VIP members must{" "}
                          <strong className="text-zinc-800 dark:text-zinc-200">request access</strong>; you get an email
                          and an in-admin alert, then grant via the banner or Admin → Customers. Use{" "}
                          <strong className="text-zinc-800 dark:text-zinc-200">Owner only</strong> while testing.
                        </p>
                        {(() => {
                          const audience = forexAudienceFromFlags(
                            "page_tab_coach_calls",
                            "coach_calls_owner_only"
                          );
                          const busy = toggling === "page_tab_coach_calls";
                          return (
                            <div className="rounded-lg bg-zinc-50/80 dark:bg-zinc-900/50 p-3 space-y-3">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium text-zinc-900 dark:text-zinc-100">Coach Calls + Telegram Signals</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    Exclusive CA / call alerts in-app and via Telegram. VIP on-demand after request.
                                  </p>
                                </div>
                                <span
                                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                    audience === "off"
                                      ? "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400"
                                      : audience === "owner"
                                        ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                                        : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                  }`}
                                >
                                  {audience === "off" ? "OFF" : audience === "owner" ? "OWNER ONLY" : "VIP ON-DEMAND"}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {(
                                  [
                                    { id: "off" as const, label: "Off" },
                                    { id: "owner" as const, label: "Owner only (test)" },
                                    { id: "vip" as const, label: "VIP on-demand" },
                                  ] as const
                                ).map((opt) => (
                                  <Button
                                    key={opt.id}
                                    size="sm"
                                    variant={audience === opt.id ? "default" : "outline"}
                                    disabled={busy}
                                    onClick={() =>
                                      void setForexAudience(
                                        "page_tab_coach_calls",
                                        "coach_calls_owner_only",
                                        opt.id
                                      )
                                    }
                                  >
                                    {busy && audience !== opt.id ? "…" : opt.label}
                                  </Button>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    ) : group.id === "crypto-buddie" ? (
                      <div className="space-y-4 px-4 pb-4 border-t border-zinc-200 dark:border-zinc-700 pt-3">
                        <p className="text-xs text-muted-foreground">
                          Crypto Buddie is <strong className="text-zinc-800 dark:text-zinc-200">VIP only</strong>. Use{" "}
                          <strong className="text-zinc-800 dark:text-zinc-200">Owner only</strong> while you test, then{" "}
                          <strong className="text-zinc-800 dark:text-zinc-200">All VIP</strong> when ready. You can also lock the
                          tab from Admin → Product visibility.
                        </p>
                        {(() => {
                          const audience = forexAudienceFromFlags(
                            "nova_crypto_buddie",
                            "nova_crypto_buddie_owner_only"
                          );
                          const busy = toggling === "nova_crypto_buddie";
                          return (
                            <div className="rounded-lg bg-zinc-50/80 dark:bg-zinc-900/50 p-3 space-y-3">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium text-zinc-900 dark:text-zinc-100">Crypto Buddie</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    Ranked short-horizon perp reads plus optional Sol/BSC AI monitor under Crypto Futures.
                                  </p>
                                </div>
                                <span
                                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                    audience === "off"
                                      ? "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400"
                                      : audience === "owner"
                                        ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                                        : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                  }`}
                                >
                                  {audience === "off" ? "OFF" : audience === "owner" ? "OWNER ONLY" : "ALL VIP"}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {(
                                  [
                                    { id: "off" as const, label: "Off" },
                                    { id: "owner" as const, label: "Owner only (test)" },
                                    { id: "vip" as const, label: "All VIP" },
                                  ] as const
                                ).map((opt) => (
                                  <Button
                                    key={opt.id}
                                    size="sm"
                                    variant={audience === opt.id ? "default" : "outline"}
                                    disabled={busy}
                                    onClick={() =>
                                      void setForexAudience(
                                        "nova_crypto_buddie",
                                        "nova_crypto_buddie_owner_only",
                                        opt.id
                                      )
                                    }
                                  >
                                    {busy && audience !== opt.id ? "…" : opt.label}
                                  </Button>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    ) : group.id === "gmgn-vip-bot" ? (
                      <div className="space-y-4 px-4 pb-4 border-t border-zinc-200 dark:border-zinc-700 pt-3">
                        <p className="text-xs text-muted-foreground">
                          GMGN VIP Bot is <strong className="text-zinc-800 dark:text-zinc-200">VIP only</strong>. Trades SOL, BSC,
                          and Robinhood via GMGN. Use <strong className="text-zinc-800 dark:text-zinc-200">Owner only</strong> while
                          testing, then <strong className="text-zinc-800 dark:text-zinc-200">All VIP</strong>. Also show the tab in
                          Admin → Product visibility.
                        </p>
                        {(() => {
                          const audience = forexAudienceFromFlags("nova_gmgn_vip_bot", "nova_gmgn_vip_bot_owner_only");
                          const busy = toggling === "nova_gmgn_vip_bot";
                          return (
                            <div className="rounded-lg bg-zinc-50/80 dark:bg-zinc-900/50 p-3 space-y-3">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium text-zinc-900 dark:text-zinc-100">GMGN VIP Bot</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    Semi-auto (approve each trade) or full auto. Users paste GMGN API key + private key; owner can use
                                    server env GMGN_API_KEY.
                                  </p>
                                </div>
                                <span
                                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                    audience === "off"
                                      ? "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400"
                                      : audience === "owner"
                                        ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                                        : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                  }`}
                                >
                                  {audience === "off" ? "OFF" : audience === "owner" ? "OWNER ONLY" : "ALL VIP"}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {(
                                  [
                                    { id: "off" as const, label: "Off" },
                                    { id: "owner" as const, label: "Owner only (test)" },
                                    { id: "vip" as const, label: "All VIP" },
                                  ] as const
                                ).map((opt) => (
                                  <Button
                                    key={opt.id}
                                    size="sm"
                                    variant={audience === opt.id ? "default" : "outline"}
                                    disabled={busy}
                                    onClick={() =>
                                      void setForexAudience("nova_gmgn_vip_bot", "nova_gmgn_vip_bot_owner_only", opt.id)
                                    }
                                  >
                                    {busy && audience !== opt.id ? "…" : opt.label}
                                  </Button>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                        {(() => {
                          const cronKey = "nova_gmgn_vip_bot_cron";
                          const enabled = flags[cronKey] ?? false;
                          const busy = toggling === cronKey;
                          return (
                            <div className="rounded-lg bg-zinc-50/80 dark:bg-zinc-900/50 p-3">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium text-zinc-900 dark:text-zinc-100">GMGN VIP Bot — auto-scan cron</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    When ON, scheduled cron scans GMGN trending for enabled users (manual Scan still works when OFF).
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                      enabled
                                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                        : "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400"
                                    }`}
                                  >
                                    {enabled ? "ON" : "OFF"}
                                  </span>
                                  <Button size="sm" variant={enabled ? "outline" : "default"} disabled={busy} onClick={() => handleToggle(cronKey)}>
                                    {busy ? "…" : enabled ? "Turn off" : "Turn on"}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    ) : group.id === "narratives-early" ? (
                      <div className="space-y-4 px-4 pb-4 border-t border-zinc-200 dark:border-zinc-700 pt-3">
                        <p className="text-xs text-muted-foreground">
                          Early Catch is <strong className="text-zinc-800 dark:text-zinc-200">VIP only</strong> under Narratives.
                          Daily scan limits: Admin → Product visibility. Default VIP = 1/day.
                        </p>
                        {(() => {
                          const audience = forexAudienceFromFlags("nova_early_catch", "nova_early_catch_owner_only");
                          const busy = toggling === "nova_early_catch";
                          return (
                            <div className="rounded-lg bg-zinc-50/80 dark:bg-zinc-900/50 p-3 space-y-3">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium text-zinc-900 dark:text-zinc-100">Early Catch</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    Strong narratives still under ~$20k market cap.
                                  </p>
                                </div>
                                <span
                                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                    audience === "off"
                                      ? "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400"
                                      : audience === "owner"
                                        ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                                        : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                  }`}
                                >
                                  {audience === "off" ? "OFF" : audience === "owner" ? "OWNER ONLY" : "ALL VIP"}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {(
                                  [
                                    { id: "off" as const, label: "Off" },
                                    { id: "owner" as const, label: "Owner only (test)" },
                                    { id: "vip" as const, label: "All VIP" },
                                  ] as const
                                ).map((opt) => (
                                  <Button
                                    key={opt.id}
                                    size="sm"
                                    variant={audience === opt.id ? "default" : "outline"}
                                    disabled={busy}
                                    onClick={() =>
                                      void setForexAudience("nova_early_catch", "nova_early_catch_owner_only", opt.id)
                                    }
                                  >
                                    {busy && audience !== opt.id ? "…" : opt.label}
                                  </Button>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    ) : group.id === "nova-forex-bots" ? (
                      <div className="space-y-4 px-4 pb-4 border-t border-zinc-200 dark:border-zinc-700 pt-3">
                        <p className="text-xs text-muted-foreground">
                          Forex bots are <strong className="text-zinc-800 dark:text-zinc-200">VIP only</strong>. Use{" "}
                          <strong className="text-zinc-800 dark:text-zinc-200">Owner only</strong> while you test, then switch to{" "}
                          <strong className="text-zinc-800 dark:text-zinc-200">All VIP</strong> when ready. Free users never see these.
                        </p>
                        {(
                          [
                            {
                              title: "Nova Forex Bot",
                              master: "nova_forex_bot",
                              ownerOnly: "nova_forex_bot_owner_only",
                              hint: "MA-crossover auto-trading on the user’s Vantage Markets or TIOmarkets MT4/MT5 account (MetaAPI).",
                            },
                            {
                              title: "Nova Forex Scalper Bot",
                              master: "nova_forex_scalp_bot",
                              ownerOnly: "nova_forex_scalp_bot_owner_only",
                              hint: "Entry→exit scalp bot + “Scalp this trade” hand-off from Nova Forex Scalp Agent.",
                            },
                          ] as const
                        ).map((bot) => {
                          const audience = forexAudienceFromFlags(bot.master, bot.ownerOnly);
                          const busy = toggling === bot.master;
                          const badge =
                            audience === "off"
                              ? { label: "OFF", className: "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400" }
                              : audience === "owner"
                                ? { label: "OWNER ONLY", className: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200" }
                                : { label: "ALL VIP", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" };
                          return (
                            <div key={bot.master} className="rounded-lg bg-zinc-50/80 dark:bg-zinc-900/50 p-3 space-y-3">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium text-zinc-900 dark:text-zinc-100">{bot.title}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">{bot.hint}</p>
                                </div>
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.className}`}>
                                  {badge.label}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {(
                                  [
                                    { id: "off" as const, label: "Off" },
                                    { id: "owner" as const, label: "Owner only (test)" },
                                    { id: "vip" as const, label: "All VIP" },
                                  ] as const
                                ).map((opt) => (
                                  <Button
                                    key={opt.id}
                                    size="sm"
                                    variant={audience === opt.id ? "default" : "outline"}
                                    disabled={busy}
                                    onClick={() => void setForexAudience(bot.master, bot.ownerOnly, opt.id)}
                                  >
                                    {busy && audience !== opt.id ? "…" : opt.label}
                                  </Button>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                        {(() => {
                          const cronKey = "nova_forex_scalp_bot_cron";
                          const enabled = flags[cronKey] ?? false;
                          const busy = toggling === cronKey;
                          return (
                            <div className="rounded-lg bg-zinc-50/80 dark:bg-zinc-900/50 p-3">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium text-zinc-900 dark:text-zinc-100">
                                    Nova Forex Scalper — overnight automation
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    When ON, the server cron advances enabled Forex Scalper configs in batch (like NovaScalper overnight). When OFF, ticks only run while the user’s tab is open / manual Check.
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                      enabled
                                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                        : "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400"
                                    }`}
                                  >
                                    {enabled ? "ON" : "OFF"}
                                  </span>
                                  <Button
                                    size="sm"
                                    variant={enabled ? "outline" : "default"}
                                    onClick={() => handleToggle(cronKey)}
                                    disabled={busy}
                                  >
                                    {busy ? "…" : enabled ? "Turn off" : "Turn on"}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    ) : group.id === "wallet-subs" ? (
                      <div className="space-y-4 px-4 pb-4 border-t border-zinc-200 dark:border-zinc-700 pt-3">
                        <ul className="space-y-3">
                          {group.entries.map(([key, { label, description }]) => {
                            const enabled = flags[key] ?? true;
                            const busy = toggling === key;
                            return (
                              <li key={key} className="rounded-lg p-3 bg-zinc-50/80 dark:bg-zinc-900/50">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                    <p className="font-medium text-zinc-900 dark:text-zinc-100">{label}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                        enabled
                                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                          : "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400"
                                      }`}
                                    >
                                      {enabled ? "ON" : "OFF"}
                                    </span>
                                    <Button size="sm" variant={enabled ? "outline" : "default"} onClick={() => handleToggle(key)} disabled={busy}>
                                      {busy ? "…" : enabled ? "Turn off" : "Turn on"}
                                    </Button>
                                  </div>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                        <p className="text-xs text-muted-foreground">
                          Smart Money Alerts is <strong className="text-zinc-800 dark:text-zinc-200">VIP only</strong>. Manage wallets at{" "}
                          <a href="/admin/smart-money" className="text-cyan-600 hover:underline">
                            Admin → Smart Money
                          </a>
                          . Daily refresh limits: Product visibility.
                        </p>
                        {(() => {
                          const audience = forexAudienceFromFlags(
                            "nova_smart_money_alerts",
                            "nova_smart_money_alerts_owner_only"
                          );
                          const busy = toggling === "nova_smart_money_alerts";
                          return (
                            <div className="rounded-lg bg-zinc-50/80 dark:bg-zinc-900/50 p-3 space-y-3">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium text-zinc-900 dark:text-zinc-100">Smart Money Alerts (FOMO Tracker)</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    Sized buys, hold, still holding, sold — in-app only.
                                  </p>
                                </div>
                                <span
                                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                    audience === "off"
                                      ? "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400"
                                      : audience === "owner"
                                        ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                                        : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                  }`}
                                >
                                  {audience === "off" ? "OFF" : audience === "owner" ? "OWNER ONLY" : "ALL VIP"}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {(
                                  [
                                    { id: "off" as const, label: "Off" },
                                    { id: "owner" as const, label: "Owner only (test)" },
                                    { id: "vip" as const, label: "All VIP" },
                                  ] as const
                                ).map((opt) => (
                                  <Button
                                    key={opt.id}
                                    size="sm"
                                    variant={audience === opt.id ? "default" : "outline"}
                                    disabled={busy}
                                    onClick={() =>
                                      void setForexAudience(
                                        "nova_smart_money_alerts",
                                        "nova_smart_money_alerts_owner_only",
                                        opt.id
                                      )
                                    }
                                  >
                                    {busy && audience !== opt.id ? "…" : opt.label}
                                  </Button>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    ) : (
                    <ul className="space-y-3 px-4 pb-4 border-t border-zinc-200 dark:border-zinc-700 pt-3">
                      {group.entries.map(([key, { label, description }]) => {
                  const enabled = flags[key] ?? true;
                  const busy = toggling === key;
                  const highlighted = highlightFlag === key;
                  return (
                          <li
                            key={key}
                            id={`flag-${key}`}
                            className={`rounded-lg p-3 scroll-mt-24 ${
                              highlighted
                                ? "bg-amber-50 dark:bg-amber-950/40 ring-2 ring-amber-400/60 dark:ring-amber-500/50"
                                : "bg-zinc-50/80 dark:bg-zinc-900/50"
                            }`}
                          >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                                <p className="font-medium text-zinc-900 dark:text-zinc-100">{label}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                        </div>
                        <div className="flex items-center gap-2">
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${enabled ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400"}`}>
                            {enabled ? "ON" : "OFF"}
                          </span>
                          <Button
                            size="sm"
                            variant={enabled ? "outline" : "default"}
                            onClick={() => handleToggle(key)}
                            disabled={busy}
                          >
                            {busy ? "…" : enabled ? "Turn off" : "Turn on"}
                          </Button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
                    )}
                  </details>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6 border-zinc-200 dark:border-zinc-800">
          <CardHeader>
            <CardTitle className="text-base">Product visibility</CardTitle>
            <p className="text-sm text-muted-foreground">
              Dashboard tab Show/Hide, owner-only locks, and green NEW pills are managed on one page.
            </p>
          </CardHeader>
          <CardContent>
            <Link
              href="/admin/tab-visibility"
              className="inline-flex items-center gap-2 text-sm font-medium text-cyan-600 dark:text-cyan-400 hover:underline"
            >
              Open Product visibility →
            </Link>
          </CardContent>
        </Card>

        <Card className="mt-6 border-zinc-200 dark:border-zinc-800">
          <CardHeader>
            <CardTitle className="text-base">Site banners</CardTitle>
            <p className="text-sm text-muted-foreground">
              Promo giveaway banner and Meme Coins Agent banner are managed on a dedicated page — turn on/off, edit title and copy, preview live.
            </p>
          </CardHeader>
          <CardContent>
            <Link
              href="/admin/banners"
              className="inline-flex items-center gap-2 text-sm font-medium text-cyan-600 dark:text-cyan-400 hover:underline"
            >
              Open Banners admin →
            </Link>
          </CardContent>
        </Card>

        <Card className="mt-6 border-zinc-200 dark:border-zinc-800 border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Moralis API usage</CardTitle>
            <p className="text-sm text-muted-foreground">
              Daily usage and limits are not shown in-app yet. Check your usage in the{" "}
              <a href="https://admin.moralis.io" target="_blank" rel="noopener noreferrer" className="underline text-cyan-600 dark:text-cyan-400 hover:no-underline">
                Moralis dashboard
              </a>
              . In-app usage display can be added when Moralis exposes a usage or quota API.
            </p>
          </CardHeader>
        </Card>

    </div>
  );
}
