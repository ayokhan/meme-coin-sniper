"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import type { TabNewBadgeAdminRow } from "@/lib/tab-new-badges";

function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocalValue(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  const ms = Date.parse(v);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

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
};

type GoHuntingRefreshDraft = {
  guestIntervalMinutes: string;
  freeMemberIntervalMinutes: string;
  guestAutoRefreshEnabled: boolean;
  freeAutoRefreshEnabled: boolean;
  freeAutoRefreshMinutes: string;
};

const DEFAULT_GO_HUNTING_REFRESH_ADMIN: GoHuntingRefreshAdminState = {
  guestIntervalMinutes: 60,
  freeMemberIntervalMinutes: 60,
  guestAutoRefreshEnabled: false,
  freeAutoRefreshEnabled: false,
  freeAutoRefreshMinutes: 60,
};

function goHuntingRefreshToDraft(c: GoHuntingRefreshAdminState): GoHuntingRefreshDraft {
  return {
    guestIntervalMinutes: String(c.guestIntervalMinutes),
    freeMemberIntervalMinutes: String(c.freeMemberIntervalMinutes),
    guestAutoRefreshEnabled: c.guestAutoRefreshEnabled,
    freeAutoRefreshEnabled: c.freeAutoRefreshEnabled,
    freeAutoRefreshMinutes: String(c.freeAutoRefreshMinutes),
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
    match: (k) => k === "vercel_cron_enabled" || k === "analytics_ping_enabled" || k === "live_activity_enabled",
  },
  { id: "ai", title: "AI experiments", match: (k) => k.startsWith("ai_") || k.startsWith("nova_ai_agent") },
  { id: "moralis", title: "API & notifications", match: (k) => k.startsWith("moralis_") || k.startsWith("telegram_") || k === "live_trades_enabled" },
  {
    id: "wallet-subs",
    title: "Wallet Tracker subtabs",
    match: (k) =>
      k === "page_tab_meme_coins_traders" ||
      k === "page_tab_leverage_traders" ||
      k === "nova_perp_wallet_analyst" ||
      k === "nova_meme_leaderboard" ||
      k === "nova_deep_meme_agent",
  },
  { id: "tabs", title: "Dashboard tabs", match: (k) => k.startsWith("page_tab_") },
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
    description: "Show/hide the Coach Calls + Telegram Signals tab in the main GUI.",
  },
  page_tab_nova_forecast: {
    label: "Tab: NovaForecast Agent",
    description: "Show/hide the NovaForecast Agent tab in the main GUI.",
  },
  page_tab_nova_forex: {
    label: "Tab: Nova Forex Agent",
    description: "Show/hide the Nova Forex Agent tab in the main GUI (also requires Nova Forex Agent feature flag ON).",
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
  owner_first_buy_alerts: {
    label: "First buy alerts (owner only)",
    description: "Notify in-app and Telegram the first time a tracked wallet buys a coin. No repeat alerts for same wallet+token.",
  },
  telegram_leverage_alerts: {
    label: "Telegram Top Leverage Traders alerts",
    description: "Send Telegram when an alert-enabled leverage wallet changes positions (cron). Toggle per wallet in Nova Admin → Leverage Wallet Tracker.",
  },
  digest_to_newsletter_subscribers: {
    label: "Send digest to newsletter subscribers",
    description: "When ON, the perp digest is also emailed to users who opted in at registration. When OFF, digest goes only to Telegram and DIGEST_EMAIL_TO.",
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
      "When ON, VIP users see the Crypto Buddie subtab: ranked perps for short-horizon style reads plus optional Sol/BSC AI monitor polling. Default OFF until you enable it.",
  },
  nova_scalp_agent: {
    label: "Nova Scalp Agent (NovaForecast)",
    description:
      "When ON, VIP users see the Nova Scalp Agent subtab under NovaForecast Agent: leveraged entry/exit plans, expected PnL, stop-loss, and Quick Wins scanner. Default OFF until you enable it.",
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
    label: "Nova Forex Scalp Agent",
    description:
      "When ON, VIP users see Nova Forex Scalp subtab. Requires Nova Forex Agent ON. Default OFF.",
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
  vercel_cron_enabled: {
    label: "Vercel scheduled cron (master)",
    description:
      "When ON, Vercel runs /api/cron once daily (midnight UTC): Birdeye scan, CT/Twitter scan, wallet Telegram alerts, leverage alerts, pinned token re-analyze, trading bot, perp listing/digest/alerts, Blofin breakout, NovaScalper batch (if enabled), meme leaderboard refresh (if enabled). Turn OFF to skip the entire cron chain and save CPU. Manual Scan buttons still work.",
  },
  analytics_ping_enabled: {
    label: "Analytics page pings",
    description:
      "When ON, visitors record page views to /api/analytics on navigation (powers Admin → Insights and live activity data). When OFF, no analytics DB writes from client pings. Does not stop AI usage metrics or subscription data.",
  },
  live_activity_enabled: {
    label: "Live activity panel (Admin → Metrics)",
    description:
      "When ON, the owner Live activity section polls every 30s while Admin → Metrics is open. When OFF, that panel is disabled (stops polling and heavy DB reads). Turn OFF when you are not watching who is online.",
  },
};

export default function AdminFeatureFlagsPage() {
  const { data: session, status } = useSession();
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [toggling, setToggling] = useState<string | null>(null);
  const [tabNewRows, setTabNewRows] = useState<TabNewBadgeAdminRow[]>([]);
  const [tabNewLoading, setTabNewLoading] = useState(true);
  const [tabNewSaving, setTabNewSaving] = useState<string | null>(null);
  const [tabNewDraftDates, setTabNewDraftDates] = useState<Record<string, string>>({});
  const [aiAgentQuotas, setAiAgentQuotas] = useState<AiAgentQuotasState>(DEFAULT_AI_AGENT_QUOTAS);
  const [aiAgentQuotasDraft, setAiAgentQuotasDraft] = useState<AiAgentQuotasDraft>(quotasToDraft(DEFAULT_AI_AGENT_QUOTAS));
  const [aiAgentQuotasSaving, setAiAgentQuotasSaving] = useState(false);
  const [goHuntingRefresh, setGoHuntingRefresh] = useState<GoHuntingRefreshAdminState>(DEFAULT_GO_HUNTING_REFRESH_ADMIN);
  const [goHuntingRefreshDraft, setGoHuntingRefreshDraft] = useState<GoHuntingRefreshDraft>(
    goHuntingRefreshToDraft(DEFAULT_GO_HUNTING_REFRESH_ADMIN)
  );
  const [goHuntingRefreshSaving, setGoHuntingRefreshSaving] = useState(false);

  const load = () =>
    Promise.all([
      fetch("/api/admin/feature-flags").then((r) => r.json()),
      fetch("/api/admin/tab-new-badges").then((r) => r.json()),
      fetch("/api/admin/ai-agent-quotas").then((r) => r.json()),
      fetch("/api/admin/go-hunting-refresh").then((r) => r.json()),
    ])
      .then(([flagsData, badgesData, quotasData, goHuntingData]) => {
        if (flagsData.success) setFlags(flagsData.flags ?? {});
        else setError(flagsData.error ?? "Failed to load");
        if (badgesData.success) {
          const rows = (badgesData.rows ?? []) as TabNewBadgeAdminRow[];
          setTabNewRows(rows);
          const drafts: Record<string, string> = {};
          for (const row of rows) {
            drafts[row.tabId] = toDatetimeLocalValue(row.expiresAt);
          }
          setTabNewDraftDates(drafts);
        }
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
        setTabNewLoading(false);
      });

  useEffect(() => {
    if (status !== "authenticated") return;
    load();
  }, [status]);

  const patchTabNew = async (body: { tabId: string; expiresAt?: string | null; resetToDefault?: boolean }) => {
    setTabNewSaving(body.tabId);
    setError("");
    setSuccessMessage("");
    try {
      const res = await fetch("/api/admin/tab-new-badges", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        const rows = (data.rows ?? []) as TabNewBadgeAdminRow[];
        setTabNewRows(rows);
        const drafts: Record<string, string> = {};
        for (const row of rows) {
          drafts[row.tabId] = toDatetimeLocalValue(row.expiresAt);
        }
        setTabNewDraftDates(drafts);
        setSuccessMessage("Tab NEW badge updated.");
        setTimeout(() => setSuccessMessage(""), 4000);
      } else setError(data.error ?? "Update failed");
    } catch {
      setError("Update failed");
    } finally {
      setTabNewSaving(null);
    }
  };

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
    if (!Number.isFinite(guest) || !Number.isFinite(free) || !Number.isFinite(freeAuto)) {
      setError("Enter valid minute values for Go Hunting refresh.");
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
        }),
      });
      const data = await res.json();
      if (data.success && data.config) {
        const g = data.config as GoHuntingRefreshAdminState;
        setGoHuntingRefresh(g);
        setGoHuntingRefreshDraft(goHuntingRefreshToDraft(g));
        setSuccessMessage("Go Hunting refresh limits updated.");
        setTimeout(() => setSuccessMessage(""), 4000);
      } else setError(data.error ?? "Update failed");
    } catch {
      setError("Update failed");
    } finally {
      setGoHuntingRefreshSaving(false);
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
  const groupedFlags = FLAG_GROUPS.map((g) => ({
    ...g,
    entries: flagEntries.filter(([key]) => flagGroupId(key) === g.id),
  })).filter((g) => g.entries.length > 0);

  return (
    <div className="max-w-3xl">
        <AdminPageHeader
          title="Feature flags"
          description="Turn features on or off during testing. When OFF, related API calls or notifications are skipped."
        />

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
                    <p className="font-semibold text-zinc-900 dark:text-zinc-100">Go Hunting refresh limits</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Limits manual Refresh and Scan new pairs for guests and free (non-VIP) users. VIP and owner are unlimited.
                      Set <strong>0</strong> minutes to disable the cooldown for that tier. Auto-refresh for Go Hunting is off by default for guests/free (saves Vercel CPU).
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
                    <label className="flex items-center gap-2 sm:col-span-2">
                      <input
                        type="checkbox"
                        checked={goHuntingRefreshDraft.guestAutoRefreshEnabled}
                        onChange={(e) => setGoHuntingRefreshDraft((d) => ({ ...d, guestAutoRefreshEnabled: e.target.checked }))}
                      />
                      <span className="text-sm">Allow guest auto-refresh on Go Hunting (uses guest interval above)</span>
                    </label>
                    <label className="flex items-center gap-2 sm:col-span-2">
                      <input
                        type="checkbox"
                        checked={goHuntingRefreshDraft.freeAutoRefreshEnabled}
                        onChange={(e) => setGoHuntingRefreshDraft((d) => ({ ...d, freeAutoRefreshEnabled: e.target.checked }))}
                      />
                      <span className="text-sm">Allow free-member auto-refresh on Go Hunting</span>
                    </label>
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
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button size="sm" onClick={patchGoHuntingRefresh} disabled={goHuntingRefreshSaving}>
                      {goHuntingRefreshSaving ? "Saving…" : "Save Go Hunting limits"}
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Current — Guest: {goHuntingRefresh.guestIntervalMinutes}m manual
                    {goHuntingRefresh.guestAutoRefreshEnabled ? " · auto on" : " · auto off"} · Free: {goHuntingRefresh.freeMemberIntervalMinutes}m manual
                    {goHuntingRefresh.freeAutoRefreshEnabled
                      ? ` · auto every ${goHuntingRefresh.freeAutoRefreshMinutes}m`
                      : " · auto off"}
                  </p>
                </div>
                {groupedFlags.map((group) => (
                  <details key={group.id} open={group.id !== "tabs"} className="rounded-xl border border-zinc-200 dark:border-zinc-700">
                    <summary className="cursor-pointer px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-100 list-none flex items-center justify-between">
                      {group.title}
                      <span className="text-xs font-normal text-muted-foreground">{group.entries.length} flags</span>
                    </summary>
                    <ul className="space-y-3 px-4 pb-4 border-t border-zinc-200 dark:border-zinc-700 pt-3">
                      {group.entries.map(([key, { label, description }]) => {
                        const enabled = flags[key] ?? true;
                        const busy = toggling === key;
                        return (
                          <li key={key} className="rounded-lg bg-zinc-50/80 dark:bg-zinc-900/50 p-3">
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
                  </details>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6 border-zinc-200 dark:border-zinc-800">
          <CardHeader>
            <CardTitle className="text-base">Tab NEW badges</CardTitle>
            <p className="text-sm text-muted-foreground">
              Control the green <strong className="text-zinc-800 dark:text-zinc-200">NEW</strong> pill on main navigation tabs.
              Set an expiry date (your local time) or turn off. Tabs without a saved row use code defaults until you change them.
              Users see updates on refresh (no deploy needed).
            </p>
          </CardHeader>
          <CardContent>
            {tabNewLoading ? (
              <p className="text-muted-foreground text-sm">Loading tab badges…</p>
            ) : (
              <ul className="space-y-3 max-h-[min(70vh,520px)] overflow-y-auto pr-1">
                {tabNewRows.map((row) => {
                  const busy = tabNewSaving === row.tabId;
                  const draft = tabNewDraftDates[row.tabId] ?? "";
                  return (
                    <li
                      key={row.tabId}
                      className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-medium text-sm text-zinc-900 dark:text-zinc-100">{row.label}</p>
                          <p className="text-[11px] text-muted-foreground font-mono">{row.tabId}</p>
                        </div>
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                            row.active
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                              : "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20"
                          }`}
                        >
                          {row.active ? "NEW visible" : "NEW off"}
                          {row.usesDefault && row.active ? " (default)" : ""}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-end gap-2">
                        <label className="text-xs text-muted-foreground flex flex-col gap-1 min-w-[200px] flex-1">
                          Show until (local)
                          <input
                            type="datetime-local"
                            value={draft}
                            onChange={(e) =>
                              setTabNewDraftDates((prev) => ({ ...prev, [row.tabId]: e.target.value }))
                            }
                            className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800"
                          />
                        </label>
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() => {
                            const iso = fromDatetimeLocalValue(draft);
                            if (!iso) {
                              setError("Pick a valid date and time, or use Turn off.");
                              return;
                            }
                            void patchTabNew({ tabId: row.tabId, expiresAt: iso });
                          }}
                        >
                          {busy ? "…" : "Save"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => void patchTabNew({ tabId: row.tabId, expiresAt: null })}
                        >
                          Turn off
                        </Button>
                        {!row.usesDefault && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => void patchTabNew({ tabId: row.tabId, resetToDefault: true })}
                          >
                            Reset default
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
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
