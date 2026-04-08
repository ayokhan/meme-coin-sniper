"use client";

import { useCallback, useEffect, useState, useRef, useMemo, type Dispatch, type SetStateAction } from "react";
import { useTheme } from "next-themes";
import { useSession, signOut, getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Zap, Copy, Send, Star, Flame, ChevronDown, Menu, X } from "lucide-react";
import FuturesWorkflow from "@/components/FuturesWorkflow";
import NarrativesPanel from "@/components/NarrativesPanel";
import CoachCallsPanel from "@/components/CoachCallsPanel";
import OnlineBossDemandFibPlaybook from "@/components/OnlineBossDemandFibPlaybook";
import TradingBotPanel from "@/components/TradingBotPanel";
import PropFirmBotPanel from "@/components/PropFirmBotPanel";
import NovaInvestmentAgentPanel from "@/components/NovaInvestmentAgentPanel";

type Token = {
  id: string;
  symbol: string;
  name: string;
  contractAddress: string;
  viralScore: number;
  liquidity: number | null;
  priceUSD: number | null;
  pairAddress: string | null;
  twitter: string | null;
  telegram: string | null;
  website: string | null;
  launchedAt: string;
  kolCount?: number;
  volume24h?: number | null;
  volume1h?: number | null;
  volume6h?: number | null;
  volume5m?: number | null;
  volume15m?: number | null;
  volume30m?: number | null;
  txnsBuys24h?: number | null;
  txnsSells24h?: number | null;
};

type WalletAlert = {
  contractAddress: string;
  symbol: string;
  name: string;
  buyerCount: number;
  buyers: Array<{ address: string; label?: string }>;
  liquidity?: number | null;
  priceUSD?: number | null;
  latestBuyAt?: number | null;
};

const AUTO_REFRESH_SECONDS = 60;
const LEVERAGE_TRADER_FAVORITES_LS_KEY = "novastaris-leverage-trader-favorites";

type TabId =
  | "new"
  | "trending"
  | "surge"
  | "ct"
  | "wallets"
  | "transactions"
  | "ai-analysis"
  | "futures"
  | "trending-perps"
  | "perp-radar"
  | "narratives"
  | "trading-bot"
  | "polymarket-bot"
  | "prop-firm-bot"
  | "coach-calls"
  | "nova-forecast"
  | "nova-plus"
  | "nova-investment"
  | "bsc"
  | "watchlist"
  | "nova-connect"
  | "chris-clayton";
const PAID_TABS: TabId[] = ["surge", "transactions", "ai-analysis", "futures", "trending-perps", "perp-radar", "narratives", "ct", "wallets", "coach-calls", "nova-forecast", "nova-plus", "nova-connect"];
/** Pro: surge, transactions, ai-analysis, futures. VIP only: ct, wallets, coach-calls, nova-forecast. BSC + Watchlist are free for all. */
const VIP_ONLY_TABS: TabId[] = ["ct", "wallets", "coach-calls", "nova-forecast", "nova-plus", "nova-investment", "prop-firm-bot"];
const TAB_ID_TO_PAGE_FLAG_KEY: Record<TabId, string> = {
  new: "page_tab_new",
  trending: "page_tab_trending",
  surge: "page_tab_surge",
  transactions: "page_tab_transactions",
  "ai-analysis": "page_tab_ai_analysis",
  futures: "page_tab_futures",
  "trending-perps": "page_tab_trending_perps",
  "perp-radar": "page_tab_perp_radar",
  narratives: "page_tab_narratives",
  "trading-bot": "page_tab_trading_bot",
  "polymarket-bot": "page_tab_trading_bot",
  "prop-firm-bot": "page_tab_trading_bot",
  ct: "page_tab_ct",
  wallets: "page_tab_wallets",
  "coach-calls": "page_tab_coach_calls",
  "nova-forecast": "page_tab_nova_forecast",
  "nova-plus": "page_tab_nova_plus",
  "nova-investment": "page_tab_nova_investment_agent",
  bsc: "page_tab_bsc",
  watchlist: "page_tab_watchlist",
  "nova-connect": "page_tab_nova_connect",
  "chris-clayton": "page_tab_chris_clayton",
};
const TAB_VISIBILITY_ORDER: TabId[] = [
  "new",
  "trending",
  "surge",
  "transactions",
  "ai-analysis",
  "futures",
  "trending-perps",
  "perp-radar",
  "narratives",
  "trading-bot",
  "polymarket-bot",
  "prop-firm-bot",
  "ct",
  "wallets",
  "coach-calls",
  "nova-forecast",
  "nova-plus",
  "nova-investment",
  "bsc",
  "watchlist",
  "nova-connect",
  "chris-clayton",
];
const WATCHLIST_STORAGE_KEY = "novastaris_watchlist";
type WatchlistItem = { contractAddress: string; chain?: "solana" | "bsc"; symbol?: string; name?: string };

function NovaConnectFeedAuthorAvatar({
  messageId,
  displayName,
  avatarUrl,
  failedIds,
  setFailedIds,
  setLightbox,
}: {
  messageId: string;
  displayName: string;
  avatarUrl?: string | null;
  failedIds: Set<string>;
  setFailedIds: Dispatch<SetStateAction<Set<string>>>;
  setLightbox: (v: { src: string; name: string } | null) => void;
}) {
  const ring = "ring-2 ring-zinc-300 dark:ring-zinc-600";
  if (avatarUrl && !failedIds.has(messageId)) {
    const src = avatarUrl.includes("blob.vercel-storage.com")
      ? `/api/avatar?url=${encodeURIComponent(avatarUrl)}`
      : avatarUrl;
    return (
      <button
        type="button"
        title="View full size"
        aria-label={`View ${displayName}'s profile picture`}
        className="shrink-0 rounded-full cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 hover:opacity-95 transition-opacity"
        onClick={() => setLightbox({ src, name: displayName })}
      >
        <img
          src={src}
          alt=""
          className={`h-9 w-9 rounded-full object-cover ${ring}`}
          onError={() => setFailedIds((prev) => new Set(prev).add(messageId))}
        />
      </button>
    );
  }
  return (
    <span
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 ${ring}`}
    >
      {(displayName || "?").charAt(0).toUpperCase()}
    </span>
  );
}

export default function Dashboard() {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const { data: session, status } = useSession();
  const sessionPaid = (session?.user as { isPaid?: boolean } | undefined)?.isPaid ?? false;
  const sessionTier = (session?.user as { tier?: "pro" | "vip" | null } | undefined)?.tier ?? null;
  const [subscriptionPaid, setSubscriptionPaid] = useState<boolean | null>(null);
  const [subscriptionTier, setSubscriptionTier] = useState<"pro" | "vip" | null>(null);
  const isOwner = (session?.user as { isOwner?: boolean } | undefined)?.isOwner ?? false;
  const isPaid = isOwner || (subscriptionPaid !== null ? subscriptionPaid : sessionPaid);
  const tier = isOwner ? "vip" : (subscriptionTier !== null ? subscriptionTier : sessionTier);
  const isVip = tier === "vip";
  const novaConnectAllowedByAdmin = (session?.user as { novaConnectAllowedByAdmin?: boolean } | undefined)?.novaConnectAllowedByAdmin ?? false;
  const canUseNovaConnectPaidFeatures = isPaid || isOwner || novaConnectAllowedByAdmin;
  const ctExpiresAtRaw = (session?.user as { ctScanOnDemandExpiresAt?: Date | string | null } | undefined)?.ctScanOnDemandExpiresAt ?? null;
  const memeExpiresAtRaw =
    (session?.user as { memeCoinsTraderOnDemandExpiresAt?: Date | string | null } | undefined)?.memeCoinsTraderOnDemandExpiresAt ?? null;
  const ctExpiresAt = ctExpiresAtRaw ? new Date(ctExpiresAtRaw).getTime() : null;
  const memeExpiresAt = memeExpiresAtRaw ? new Date(memeExpiresAtRaw).getTime() : null;

  const canAccessCtScan = isOwner || (isVip && (((session?.user as { ctScanOnDemand?: boolean } | undefined)?.ctScanOnDemand) ?? false) && (!ctExpiresAt || ctExpiresAt > Date.now()));
  const canAccessMemeCoinsTrader = isOwner || (isVip && (((session?.user as { memeCoinsTraderOnDemand?: boolean } | undefined)?.memeCoinsTraderOnDemand) ?? false) && (!memeExpiresAt || memeExpiresAt > Date.now()));
  const [ctAccessState, setCtAccessState] = useState<boolean | null>(null);
  const [memeCoinsTraderAccessState, setMemeCoinsTraderAccessState] = useState<boolean | null>(null);
  const canAccessCtScanEffective = ctAccessState ?? canAccessCtScan;
  const canAccessMemeCoinsTraderEffective = memeCoinsTraderAccessState ?? canAccessMemeCoinsTrader;
  const [mounted, setMounted] = useState(false);
  const [presencePingOk, setPresencePingOk] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("new");
  const [pageTabFlags, setPageTabFlags] = useState<Record<string, boolean> | null>(null);
  const [pageTabFlagsLoaded, setPageTabFlagsLoaded] = useState(false);

  // Client-side: hide/show main GUI tabs based on owner feature flags.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/feature-flags-public")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d?.success) return;
        setPageTabFlags(d.flags ?? {});
      })
      .catch(() => {})
      .finally(() => {
        if (cancelled) return;
        setPageTabFlagsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Admin toggles (Trading Bot on-demand, etc.) are read from DB on each session fetch; refresh client session when user returns to the tab. */
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const pull = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => void getSession(), 200);
    };
    const onVis = () => {
      if (document.visibilityState === "visible") pull();
    };
    window.addEventListener("focus", pull);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      if (t) clearTimeout(t);
      window.removeEventListener("focus", pull);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const isTabPageEnabled = (tab: TabId) => {
    const key = TAB_ID_TO_PAGE_FLAG_KEY[tab];
    // Default to enabled until flags arrive.
    return pageTabFlags?.[key] ?? true;
  };

  const isTabVisibleInGui = (tab: TabId) => {
    if (tab === "nova-connect") return novaConnectEnabled && isTabPageEnabled(tab);
    if (tab === "chris-clayton") return isOwner && isTabPageEnabled(tab);
    return isTabPageEnabled(tab);
  };

  const fetchSubscription = useCallback(() => {
    if (status !== "authenticated") return;
    fetch("/api/subscription")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setSubscriptionPaid(!!data.paid);
          setSubscriptionTier(data.subscriptionTier ?? null);
        }
      })
      .catch(() => {});
  }, [status]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetchSubscription();
  }, [status, fetchSubscription]);

  useEffect(() => {
    if (status !== "authenticated") return;
    const onFocus = () => fetchSubscription();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [status, fetchSubscription]);

  useEffect(() => {
    if (status !== "authenticated") return;
    const onVisibility = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") fetchSubscription();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [status, fetchSubscription]);

  // Poll on-demand access so admin enable/disable changes reflect instantly (no logout required).
  useEffect(() => {
    if (status !== "authenticated") return;

    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch("/api/user/on-demand-access", { cache: "no-store", credentials: "include" });
        const d = await r.json();
        if (cancelled) return;
        if (d?.success) {
          setCtAccessState(!!d.ctScanAllowed);
          setMemeCoinsTraderAccessState(!!d.memeCoinsTraderAllowed);
        }
      } catch {
        // Keep session-derived access if the endpoint fails.
      }
    };

    load();
    const interval = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [status]);

  useEffect(() => {
    if (status !== "authenticated" || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("from") === "subscribe") {
      fetchSubscription();
      router.replace("/", { scroll: false });
    }
  }, [status, router, fetchSubscription]);

  // Open NovaConnect tab when visiting /?tab=nova-connect or /nova-connect (redirects here with ?tab=nova-connect)
  useEffect(() => {
    const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    if (params?.get("tab") !== "nova-connect") return;
    if (!pageTabFlagsLoaded) return;
    if (!isTabVisibleInGui("nova-connect")) return;
    setActiveTab("nova-connect");
  }, [pageTabFlagsLoaded, isTabVisibleInGui]);

  // If the owner turns a tab OFF while the user is on it, move them to the first visible tab.
  useEffect(() => {
    if (!pageTabFlagsLoaded) return;
    if (isTabVisibleInGui(activeTab)) return;
    const fallback = TAB_VISIBILITY_ORDER.find((t) => isTabVisibleInGui(t)) ?? "new";
    setActiveTab(fallback);
  }, [pageTabFlagsLoaded, activeTab, isTabVisibleInGui]);

  // Helper to load / store which DM message IDs we've already shown as seen (per user)
  const getDmSeenKey = () => {
    const meId = (session?.user as { id?: string })?.id;
    return meId ? `novaConnectDmSeen:${meId}` : null;
  };

  const markDmAsSeenForUser = (otherUserId: string) => {
    const key = getDmSeenKey();
    if (!key || typeof window === "undefined") return;
    const preview = novaConnectDmPreviews.find((p) => p.otherUserId === otherUserId);
    if (!preview) return;
    let seen: Record<string, string> = {};
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) seen = JSON.parse(raw);
    } catch {
      // ignore
    }
    seen[otherUserId] = preview.lastMessageId;
    try {
      window.localStorage.setItem(key, JSON.stringify(seen));
    } catch {
      // ignore
    }
    setNovaConnectDmUnreadUserIds((prev) => prev.filter((id) => id !== otherUserId));
    setNovaConnectHasUnreadDm((prev) => {
      const remaining = novaConnectDmUnreadUserIds.filter((id) => id !== otherUserId);
      return remaining.length > 0;
    });
  };
  const [ctAccounts, setCtAccounts] = useState<{ username: string; tier: string; weight: number; url: string }[]>([]);
  const [ctTweets, setCtTweets] = useState<{ id: string; text: string; author: { username: string; followers: number }; created_at: string; metrics: { likes: number; retweets: number }; url: string }[]>([]);
  const [ctTweetsLoading, setCtTweetsLoading] = useState(false);
  const [ctTweetsError, setCtTweetsError] = useState<string | null>(null);
  const [trackedWallets, setTrackedWallets] = useState<{ address: string; label?: string }[]>([]);
  const [walletAlerts, setWalletAlerts] = useState<WalletAlert[]>([]);
  const [alertMinBuyers, setAlertMinBuyers] = useState(3);
  const [alertThresholdSaving, setAlertThresholdSaving] = useState(false);
  const [liveTradesEnabled, setLiveTradesEnabled] = useState(true);
  const [liveTradesToggling, setLiveTradesToggling] = useState(false);
  const [walletTrades, setWalletTrades] = useState<{ walletLabel: string; walletAddress: string; mint: string; symbol: string; name: string; timestamp: number; txUrl: string; dexUrl: string; side?: "buy" | "sell" | "unknown" }[]>([]);
  const [walletTradesError, setWalletTradesError] = useState<string | null>(null);
  const [walletTradesLoading, setWalletTradesLoading] = useState(false);
  const [firstBuyEnabled, setFirstBuyEnabled] = useState(false);
  const [firstBuyAlerts, setFirstBuyAlerts] = useState<Array<{ walletAddress: string; walletLabel?: string | null; contractAddress: string; symbol: string; name: string; liquidity?: number | null; priceUSD?: number | null; sentAt: string }>>([]);
  const [firstBuyToggling, setFirstBuyToggling] = useState(false);
  const [surgeWindow, setSurgeWindow] = useState<"5m" | "15m" | "30m" | "1h" | "6h" | "24h">("24h");
  type GoHuntingView = "new_pairs" | "final_stretch" | "migrated";
  const [goHuntingView, setGoHuntingView] = useState<GoHuntingView>("new_pairs");
  type BscGoHuntingView = "new_pairs" | "final_stretch" | "migrated" | "trending";
  const [bscGoHuntingView, setBscGoHuntingView] = useState<BscGoHuntingView>("new_pairs");
  const [aiAnalysisChain, setAiAnalysisChain] = useState<"solana" | "bsc">("solana");
  type WalletTrackerView = "meme" | "leverage";
  const [walletTrackerView, setWalletTrackerView] = useState<WalletTrackerView>("meme");
  const onDemandLocked = activeTab === "ct" && !canAccessCtScanEffective;

  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const adminMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setMounted(true);
    try {
      setOnboardingDismissed(localStorage.getItem("novastaris_onboarding_dismissed") === "1");
      const raw = localStorage.getItem(WATCHLIST_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setWatchlist(parsed);
      }
    } catch {
      // leave false so banner shows
    }
  }, []);
  const persistWatchlist = (next: WatchlistItem[]) => {
    setWatchlist(next);
    try {
      localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(next));
    } catch {}
  };
  const toggleWatchlist = (t: Token, chain: "solana" | "bsc") => {
    const key = `${t.contractAddress}:${chain}`;
    const inList = watchlist.some((w) => `${w.contractAddress}:${w.chain ?? "solana"}` === key);
    if (inList) {
      persistWatchlist(watchlist.filter((w) => `${w.contractAddress}:${w.chain ?? "solana"}` !== key));
    } else {
      persistWatchlist([...watchlist, { contractAddress: t.contractAddress, chain, symbol: t.symbol, name: t.name ?? undefined }]);
    }
  };
  const isInWatchlist = (contractAddress: string, chain: "solana" | "bsc") =>
    watchlist.some((w) => w.contractAddress === contractAddress && (w.chain ?? "solana") === chain);
  const dismissOnboarding = () => {
    setOnboardingDismissed(true);
    try {
      localStorage.setItem("novastaris_onboarding_dismissed", "1");
    } catch {}
  };

  useEffect(() => {
    if (!adminMenuOpen) return;
    const close = (e: MouseEvent) => {
      if (adminMenuRef.current && !adminMenuRef.current.contains(e.target as Node)) setAdminMenuOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [adminMenuOpen]);

  // Mark live agent as online when owner has dashboard open (so Nja shows "live agent available")
  useEffect(() => {
    if (status !== "authenticated" || !isOwner) return;
    const ping = () => fetch("/api/chat/presence", { method: "POST" }).catch(() => {});
    ping();
    const interval = setInterval(ping, 20000);
    return () => clearInterval(interval);
  }, [status, isOwner]);

  // Load NovaConnect rules acceptance from localStorage and profile when needed
  useEffect(() => {
    // Local preference (per device)
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem("novaConnectRulesAccepted");
      if (stored === "1") setNovaConnectRulesAccepted(true);
    }
  }, []);

  useEffect(() => {
    if (activeTab !== "nova-connect") return;
    if (status !== "authenticated") return;
    // Fetch profile to know if rules were accepted on this account
    fetch("/api/nova-connect/profile")
      .then((r) => r.json())
      .then((d) => {
        if (!d.success || !d.profile) return;
        if (d.profile.rulesAccepted) {
          setNovaConnectRulesAccepted(true);
          if (typeof window !== "undefined") {
            window.localStorage.setItem("novaConnectRulesAccepted", "1");
          }
        }
      })
      .catch(() => {});
  }, [activeTab, status]);

  // NovaConnect helpers
  const loadNovaConnectUsers = async () => {
    try {
      const res = await fetch("/api/nova-connect/users");
      const data = await res.json();
      if (data.success) {
        setNovaConnectUsers(data.users ?? []);
        setNovaConnectAvatarFailedIds(new Set());
      }
    } catch {
      // silent
    }
  };

  const loadNovaConnectCommunity = async () => {
    setNovaConnectLoading(true);
    setNovaConnectError(null);
    try {
      const res = await fetch("/api/nova-connect/messages?scope=community");
      const data = await res.json();
      if (data.success) {
        setNovaConnectMessages(data.messages ?? []);
        setNovaConnectFeedAvatarFailedIds(new Set());
      } else {
        setNovaConnectError(data.error ?? "Failed to load NovaConnect feed.");
      }
    } catch {
      setNovaConnectError("Failed to load NovaConnect feed.");
    } finally {
      setNovaConnectLoading(false);
    }
  };

  const loadNovaConnectDm = async (userId: string) => {
    setNovaConnectDmMessages([]);
    setNovaConnectDmInput("");
    try {
      const res = await fetch(`/api/nova-connect/messages?scope=dm&userId=${encodeURIComponent(userId)}`);
      const data = await res.json();
      if (data.success) {
        setNovaConnectDmMessages(data.messages ?? []);
        // Mark DM as seen so alerts clear for this user
        markDmAsSeenForUser(userId);
      } else {
        setNovaConnectError(data.error ?? "Failed to load private chat.");
      }
    } catch {
      setNovaConnectError("Failed to load private chat.");
    }
  };

  const novaConnectDmLastIdsRef = useRef<Set<string>>(new Set());
  const playDmBeep = useRef(() => {
    try {
      const ctx = typeof window !== "undefined" && window.AudioContext ? new window.AudioContext() : null;
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      // ignore
    }
  }).current;

  // Load first-buy alert flag on mount for owner so toggle shows correct state when navigating back
  useEffect(() => {
    if (status !== "authenticated" || !isOwner) return;
    fetch("/api/wallet-tracker/first-buy")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setFirstBuyEnabled(d.firstBuyEnabled ?? false);
          setFirstBuyAlerts(d.recentAlerts ?? []);
        }
      })
      .catch(() => {});
  }, [status, isOwner]);

  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState<"idle" | "scan" | "twitter">("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [dexTest, setDexTest] = useState<{ ok: boolean; message: string; newPairs?: number; trending?: number; sample?: string } | null>(null);
  const [moralisTest, setMoralisTest] = useState<{ ok: boolean; message: string; count?: number } | null>(null);
  const [twitterTest, setTwitterTest] = useState<{ ok: boolean; message: string; missing?: string[] } | null>(null);
  const [aiAnalysisCa, setAiAnalysisCa] = useState("");
  const [aiAnalysisAmountUsd, setAiAnalysisAmountUsd] = useState("");
  const [aiAnalysisLoading, setAiAnalysisLoading] = useState(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<{
    score: number;
    signal: "buy" | "no_buy";
    reasons: string[];
    narrativeAssessment?: string;
    amountRiskNote?: string;
    recommendations?: {
      supportResistance?: string;
      marketStructure?: string;
      buyZoneMcap?: string;
      takeProfitPct?: string;
      stopLossPct?: string;
    };
    tokenInfo: { symbol?: string; name?: string; contractAddress?: string; liquidityUsd?: number; volume24h?: number; priceUsd?: number | null; priceChange24hPct?: number; marketCapUsd?: number | null; securityIssues?: string[]; securityWarnings?: string[] };
  } | null>(null);
  const [aiAnalysisError, setAiAnalysisError] = useState<string | null>(null);
  type PinnedItem = { contractAddress: string; chain?: string; symbol?: string | null; name?: string | null; pinnedAt: string; lastAnalyzedAt: string | null; analysisResult: Record<string, unknown> | null };
  const [pinnedTokens, setPinnedTokens] = useState<PinnedItem[]>([]);
  const [pinnedLoading, setPinnedLoading] = useState(false);
  const [pinSuccess, setPinSuccess] = useState<string | null>(null);
  const [refreshingPin, setRefreshingPin] = useState<string | null>(null);
  const [aiAnalysisCopied, setAiAnalysisCopied] = useState(false);
  const [aiAnalysisShareLoading, setAiAnalysisShareLoading] = useState(false);
  const [aiAnalysisShareSuccess, setAiAnalysisShareSuccess] = useState(false);
  const [aiAnalysisFeedbackLoading, setAiAnalysisFeedbackLoading] = useState(false);
  const [aiAnalysisFeedbackSent, setAiAnalysisFeedbackSent] = useState<"good" | "bad" | null>(null);
  const [aiAnalysisFeedbackNote, setAiAnalysisFeedbackNote] = useState("");
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  // Crypto Futures tab
  const [futuresChartFile, setFuturesChartFile] = useState<File | null>(null);
  const [futuresChartPreview, setFuturesChartPreview] = useState<string | null>(null);
  const [futuresSymbol, setFuturesSymbol] = useState("");
  const [futuresMargin, setFuturesMargin] = useState("");
  const [futuresLeverage, setFuturesLeverage] = useState("10");
  const [futuresChartTimeframe, setFuturesChartTimeframe] = useState("");
  const [futuresTradeTimeframe, setFuturesTradeTimeframe] = useState("");
  const [futuresRiskAmount, setFuturesRiskAmount] = useState("");
  const [futuresDirection, setFuturesDirection] = useState<"long" | "short" | "">("");
  const [futuresAnalysisResult, setFuturesAnalysisResult] = useState<{
    score: number;
    signal: "buy" | "no_buy";
    tradeDirection?: "long" | "short";
    reasons: string[];
    recommendations?: {
      supportResistance?: string;
      marketStructure?: string;
      entryZone?: string;
      takeProfitPct?: string;
      stopLossPct?: string;
    };
  } | null>(null);
  const [futuresAnalysisLoading, setFuturesAnalysisLoading] = useState(false);
  const [futuresAnalysisError, setFuturesAnalysisError] = useState<string | null>(null);
  const [futuresView, setFuturesView] = useState<"ai" | "workflow" | "altcoins" | "hot-perps" | "nova-crypto-narratives">("ai");
  type NovaCryptoNarrativesHeadline = { title: string; link: string; pubDate?: string };
  type NovaCryptoNarrativesCot = {
    marketName: string;
    contractMarketCode: string;
    reportDate: string;
    openInterest: number;
    assetManagersNet: number;
    leveragedFundsNet: number;
    dealersNet: number;
    otherReportablesNet: number;
    weekOverWeekChangeLevNet: number | null;
    cftcDatasetUrl: string;
    tradingsterUrl: string;
  };
  type NovaCryptoNarrativesPanelResult = {
    symbol: string;
    newsHeadlines: NovaCryptoNarrativesHeadline[];
    cot: NovaCryptoNarrativesCot | null;
    noiseSummary: string;
    narrativeDirection: "bullish" | "bearish" | "mixed";
    directionConfidence: "low" | "medium" | "high";
    institutionalNarrative: string;
    aiGenerated: boolean;
    disclaimer: string;
  };
  const [novaCryptoNarrativesSymbol, setNovaCryptoNarrativesSymbol] = useState("BTC");
  const [novaCryptoNarrativesLoading, setNovaCryptoNarrativesLoading] = useState(false);
  const [novaCryptoNarrativesError, setNovaCryptoNarrativesError] = useState<string | null>(null);
  const [novaCryptoNarrativesResult, setNovaCryptoNarrativesResult] = useState<NovaCryptoNarrativesPanelResult | null>(null);
  const [topAltcoins, setTopAltcoins] = useState<TrendingPerpRow[]>([]);
  const [topAltcoinsLoading, setTopAltcoinsLoading] = useState(false);
  const [topAltcoinsSortBy, setTopAltcoinsSortBy] = useState<"5m" | "15m" | "30m" | "1h" | "4h" | "24h" | "48h" | "72h" | "1w" | "2w" | "3w" | "4w">("24h");
  const [hotPerps, setHotPerps] = useState<TrendingPerpRow[]>([]);
  const [hotPerpsLoading, setHotPerpsLoading] = useState(false);
  const [hotPerpsNewOnly, setHotPerpsNewOnly] = useState(false);
  const [hotPerpsSortBy, setHotPerpsSortBy] = useState<"5m" | "15m" | "30m" | "1h" | "4h" | "24h" | "48h" | "72h" | "1w" | "2w" | "3w" | "4w">("5m");
  const [futuresAnalysisCopied, setFuturesAnalysisCopied] = useState(false);
  type PerpAiSignal = { signal: "long" | "short" | "no_buy"; score: number; reason: string };
  const [perpAiSignals, setPerpAiSignals] = useState<Record<string, PerpAiSignal | "loading">>({});
  // ApexLiquid / Hyperliquid top traders (under Trading Bot tab, owner only)
  type TopTraderRow = { address: string; label?: string; nickname?: string | null; accountValue?: string; lastTradeTimeMs?: number | null; apexLiquidUrl?: string; isGlobal?: boolean; positions: { coin: string; side: "long" | "short"; szi: string; entryPx: string; positionValue: string; marginUsed?: string; unrealizedPnl: string; leverage?: number }[] };
  const [topTradersData, setTopTradersData] = useState<TopTraderRow[]>([]);
  const [topTradersLoading, setTopTradersLoading] = useState(false);
  const [topTradersError, setTopTradersError] = useState<string | null>(null);
  const [leverageTradersDateFilter, setLeverageTradersDateFilter] = useState<"all" | "today">("all");
  const [leverageTraderFavoriteAddresses, setLeverageTraderFavoriteAddresses] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LEVERAGE_TRADER_FAVORITES_LS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return;
      setLeverageTraderFavoriteAddresses(new Set(parsed.filter((x): x is string => typeof x === "string").map((a) => a.toLowerCase())));
    } catch {
      /* ignore */
    }
  }, []);
  const toggleLeverageTraderFavorite = useCallback((address: string) => {
    const key = address.toLowerCase();
    setLeverageTraderFavoriteAddresses((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      try {
        localStorage.setItem(LEVERAGE_TRADER_FAVORITES_LS_KEY, JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);
  const leverageFilteredTraders = useMemo(() => {
    if (leverageTradersDateFilter !== "today") return topTradersData;
    const now = new Date();
    return topTradersData.filter((t) => {
      if (t.lastTradeTimeMs == null) return false;
      const d = new Date(t.lastTradeTimeMs);
      return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
  }, [leverageTradersDateFilter, topTradersData]);
  const leverageDisplayTraders = useMemo(() => {
    const fav = leverageTraderFavoriteAddresses;
    return [...leverageFilteredTraders].sort((a, b) => {
      const af = fav.has(a.address.toLowerCase()) ? 1 : 0;
      const bf = fav.has(b.address.toLowerCase()) ? 1 : 0;
      return bf - af;
    });
  }, [leverageFilteredTraders, leverageTraderFavoriteAddresses]);
  type TrendingPerpRow = { coin: string; markPx: string; prevDayPx: string; dayPct: number; dayNtlVlm: string; openInterest: string; funding?: string; timeframePct?: number; pct5m?: number; pct15m?: number; pct30m?: number; pct1h?: number; pct4h?: number; pct48h?: number; pct72h?: number; pct1w?: number; pct2w?: number; pct3w?: number; pct4w?: number };
  const [trendingPerps, setTrendingPerps] = useState<TrendingPerpRow[]>([]);
  const [trendingPerpsLoading, setTrendingPerpsLoading] = useState(false);
  const [trendingPerpsTimeframe, setTrendingPerpsTimeframe] = useState<"24h" | "1h" | "30m" | "15m" | "5m">("24h");
  const [trendingPerpsSortBy, setTrendingPerpsSortBy] = useState<"5m" | "15m" | "30m" | "1h" | "4h" | "24h">("24h");
  type PerpPreset =
    | "all"
    | "short_positive_funding"
    | "long_negative_funding"
    | "momentum_5m_3"
    | "exploders_1h_50"
    | "microcap_exploders";
  const [perpPreset, setPerpPreset] = useState<PerpPreset>("all");
  function filterPerpsByPreset<T extends { dayPct: number; funding?: string; pct5m?: number; pct1h?: number; dayNtlVlm?: string }>(
    rows: T[]
  ): T[] {
    if (perpPreset === "all") return rows;
    return rows.filter((p) => {
      const fundingNum = p.funding != null && p.funding !== "" ? Number(p.funding) : null;
      if (perpPreset === "short_positive_funding") return p.dayPct < 0 && fundingNum != null && fundingNum > 0;
      if (perpPreset === "long_negative_funding") return p.dayPct > 0 && fundingNum != null && fundingNum < 0;
      if (perpPreset === "momentum_5m_3") return Math.abs(p.pct5m ?? 0) >= 3;
      if (perpPreset === "exploders_1h_50") return Math.abs(p.pct1h ?? 0) >= 50;
      if (perpPreset === "microcap_exploders") {
        const vol = p.dayNtlVlm != null ? Number(p.dayNtlVlm) : NaN;
        const isLowVol = Number.isFinite(vol) && vol > 0 && vol < 5_000_000; // under $5m 24h notional
        return isLowVol && Math.abs(p.pct1h ?? 0) >= 30;
      }
      return true;
    });
  }
  type PerpAlertRow = { id: string; symbol: string | null; alertType: string; threshold: number | null; lastTriggeredAt: string | null; createdAt: string };
  const [perpAlertsList, setPerpAlertsList] = useState<PerpAlertRow[]>([]);
  const [perpAlertsLoading, setPerpAlertsLoading] = useState(false);
  type PerpRadarItem = { exchange: string; symbol: string; base: string; quote: string; change24hPct: number; lastPrice: number; volume24h: number; quoteVolume24h: number; pct5m?: number; pct15m?: number; pct30m?: number; pct1h?: number; pct4h?: number };
  const [perpRadarItems, setPerpRadarItems] = useState<PerpRadarItem[]>([]);
  const [perpRadarLoading, setPerpRadarLoading] = useState(false);
  const [perpRadarError, setPerpRadarError] = useState<string | null>(null);
  const [perpRadarView, setPerpRadarView] = useState<"all" | "macro" | "metals">("all");
  const [perpRadarPreset, setPerpRadarPreset] = useState<"all" | "24h_up" | "24h_down">("all");
  const [perpRadarSortBy, setPerpRadarSortBy] = useState<"5m" | "15m" | "30m" | "1h" | "4h" | "24h">("24h");
  const [perpAlertAddType, setPerpAlertAddType] = useState<"new_listing" | "5m_pct_above" | "5m_pct_below">("new_listing");
  const [perpAlertAddSymbol, setPerpAlertAddSymbol] = useState("");
  const [perpAlertAddThreshold, setPerpAlertAddThreshold] = useState("");
  const [perpAlertAddError, setPerpAlertAddError] = useState<string | null>(null);
  type NovaForecastItem = { symbol: string; high: number; low: number; shortEntry: number; longEntry: number; currentPrice: number | null; insight: string };
  const [novaForecastItems, setNovaForecastItems] = useState<NovaForecastItem[]>([]);
  const [novaForecastLoading, setNovaForecastLoading] = useState(false);
  const [novaForecastError, setNovaForecastError] = useState<string | null>(null);
  const [novaForecastCustomSymbols, setNovaForecastCustomSymbols] = useState("");
  const [novaForecastRange, setNovaForecastRange] = useState<string>("2w");
  const [novaForecastRangeLabel, setNovaForecastRangeLabel] = useState<string>("2 weeks");
  const [novaForecastSubTab, setNovaForecastSubTab] = useState<"agent" | "nova-smart" | "nova-q" | "nova-radar">("agent");
  type NovaSmartTfResult = { id: string; label: string; high: number; low: number };
  type NovaSmartResult = { symbol: string; timeframes: NovaSmartTfResult[]; smartShortEntry: number; smartLongEntry: number; currentPrice: number | null; strategy: "scalp" | "swing" | "mixed"; strategyNote: string; suggestedLongEntry: number; suggestedLongExit: number; suggestedShortEntry: number; suggestedShortExit: number; entryExitNote: string; recommendedDirection: "long" | "short" | "neutral"; recommendationNote: string };
  const [novaSmartTimeframes, setNovaSmartTimeframes] = useState<string[]>(["15m", "1h", "1w"]);
  const [novaSmartCustomSymbol, setNovaSmartCustomSymbol] = useState("");
  const [novaSmartResults, setNovaSmartResults] = useState<NovaSmartResult[]>([]);
  const [novaSmartLoading, setNovaSmartLoading] = useState(false);
  const [novaSmartError, setNovaSmartError] = useState<string | null>(null);
  const [novaSmartFeedbackSent, setNovaSmartFeedbackSent] = useState<Set<string>>(new Set());
  type NovaQTfResult = { id: string; label: string; support: number; resistance: number; direction: "bullish" | "bearish" | "sideways" };
  type NovaQResult = { symbol: string; currentPrice: number | null; marketDirection: "bullish" | "bearish" | "sideways"; timeframes: NovaQTfResult[] };
  const [novaQTimeframes, setNovaQTimeframes] = useState<string[]>(["15m", "1h", "1w"]);
  const [novaQSymbol, setNovaQSymbol] = useState("BTC");
  const [novaQResult, setNovaQResult] = useState<NovaQResult | null>(null);
  const [novaQLoading, setNovaQLoading] = useState(false);
  const [novaQError, setNovaQError] = useState<string | null>(null);
  type NovaRadarTf = { id: string; label: string; support: number; resistance: number; direction: "bullish" | "bearish" | "sideways" };
  type NovaRadarResult = {
    symbol: string;
    side: "long" | "short";
    targetPrice: number;
    currentPrice: number;
    marketDirection: "bullish" | "bearish" | "sideways";
    pricePath: "up" | "down" | "at_target";
    pctMoveFromSpot: number;
    structureAlignment: "aligned" | "mixed" | "against_trend";
    realism: "realistic" | "stretched" | "unrealistic";
    unrealistic: boolean;
    caveats: string[];
    estimatedReachDateEarly: string | null;
    estimatedReachDateLate: string | null;
    optimisticDays: number | null;
    pessimisticDays: number | null;
    structureTimeframes: NovaRadarTf[];
    range52w: { low: number; high: number } | null;
    avgDailyRangeUsd: number | null;
    summary: string;
    orderIntentNote: string;
    disclaimer: string;
  };
  const [novaRadarSymbol, setNovaRadarSymbol] = useState("BTC");
  const [novaRadarTarget, setNovaRadarTarget] = useState("");
  const [novaRadarSide, setNovaRadarSide] = useState<"long" | "short">("long");
  const [novaRadarLoading, setNovaRadarLoading] = useState(false);
  const [novaRadarError, setNovaRadarError] = useState<string | null>(null);
  const [novaRadarResult, setNovaRadarResult] = useState<NovaRadarResult | null>(null);
  type NovaPlusResult = {
    symbol: string;
    timeframe: string;
    timeframeLabel: string;
    currentPrice: number;
    marketDirection: "bullish" | "bearish" | "sideways";
    bias: "long" | "short" | "neutral";
    /** Long vs short implied by entry / stop / target geometry (authoritative for reading the table). */
    tradeSetup?: "long" | "short";
    tradeSetupSummary?: string;
    riskRewardExplained?: string;
    tradeLevelsContext?: string;
    userInputAlignedLevels?: {
      stopForFullRiskBudget: number | null;
      takeProfitForTargetUsd: number | null;
      stopPctFromEntry: number | null;
      takeProfitPctFromEntry: number | null;
      note: string;
    } | null;
    recommendedEntry: number;
    recommendedStopLoss: number;
    stopLossDistancePct: number;
    recommendedTakeProfit: number;
    riskReward: number;
    analysis: string;
    levels: { rangeHigh: number; rangeLow: number; mid: number };
    orderBook: {
      strongestBidWall: { px: number; sz: number } | null;
      strongestAskWall: { px: number; sz: number } | null;
      wallBias: "bid_support" | "ask_resistance" | "balanced" | "unknown";
    };
    riskManagement: {
      maxRiskPctPerTrade: number;
      accountAmount: number | null;
      riskCapUsd?: number | null;
      targetProfitUsd?: number | null;
      sizingMode?: "risk_capped" | "target_profit" | "capped_to_risk_cap";
      sizingNote?: string;
      suggestedRiskAmount: number | null;
      suggestedPositionSize: number | null;
      note: string;
    };
    pnlPreview?: {
      profitIfTakeProfitUsd: number;
      lossIfStopUsd: number;
      notionalUsd: number;
      notionalFromSizingExplanation?: string;
      leverage: number | null;
      estimatedMarginUsd: number | null;
      marginPctOfAccount?: number | null;
      theoreticalMaxNotionalIfFullAccountUsd?: number | null;
      returnOnMarginIfTpPct: number | null;
      returnOnMarginIfSlPct: number | null;
      estimatedLiquidationPx?: number | null;
      liquidationDistanceFromEntryPct?: number | null;
      liquidationDisclaimer?: string;
      note: string;
    } | null;
  };
  const [novaPlusSymbol, setNovaPlusSymbol] = useState("BTC");
  const [novaPlusAmount, setNovaPlusAmount] = useState("");
  const [novaPlusRiskPct, setNovaPlusRiskPct] = useState("");
  const [novaPlusTargetProfit, setNovaPlusTargetProfit] = useState("");
  const [novaPlusLeverage, setNovaPlusLeverage] = useState("");
  const [novaPlusTimeframe, setNovaPlusTimeframe] = useState("4h");
  const [novaPlusResult, setNovaPlusResult] = useState<NovaPlusResult | null>(null);
  const [novaPlusLoading, setNovaPlusLoading] = useState(false);
  const [novaPlusError, setNovaPlusError] = useState<string | null>(null);
  type LeverageAlertRow = { id: string; walletAddress: string; nickname: string | null; positionsSummary: string; createdAt: string };
  const [leverageAlerts, setLeverageAlerts] = useState<LeverageAlertRow[]>([]);
  const [leverageAlertsLoading, setLeverageAlertsLoading] = useState(false);
  type FillRow = { time: number; coin: string; dir: string; side: string; sz: string; px: string; closedPnl?: string; fee?: string; durationMs?: number };
  const [historyAddress, setHistoryAddress] = useState<string | null>(null);
  const [historyNickname, setHistoryNickname] = useState<string | null>(null);
  const [historyFills, setHistoryFills] = useState<FillRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const historyFillsWithDuration = useMemo(() => {
    if (historyFills.length === 0) return [];
    const asc = [...historyFills].sort((a, b) => a.time - b.time);
    return historyFills.map((f) => {
      const isClose = f.dir.startsWith("Close");
      if (!isClose) return { ...f, durationMs: undefined };
      const openFill = asc.filter((x) => x.time < f.time && x.coin === f.coin && (x.dir.startsWith("Open") || x.dir.startsWith("Add"))).pop();
      const durationMs = openFill ? f.time - openFill.time : undefined;
      return { ...f, durationMs };
    });
  }, [historyFills]);
  const [userLeverageWallets, setUserLeverageWallets] = useState<{ id: string; address: string; nickname: string | null; alertEnabled: boolean }[]>([]);
  const [userMemeCoinWallets, setUserMemeCoinWallets] = useState<{ id: string; address: string; label: string | null; chain: string }[]>([]);
  const [userMemeCoinAlerts, setUserMemeCoinAlerts] = useState<Array<{ id: string; walletAddress: string; contractAddress: string; symbol: string | null; createdAt: string }>>([]);
  const [futuresAnalysisShareLoading, setFuturesAnalysisShareLoading] = useState(false);
  const [futuresAnalysisShareSuccess, setFuturesAnalysisShareSuccess] = useState(false);
  const [futuresFeedbackLoading, setFuturesFeedbackLoading] = useState(false);
  const [futuresFeedbackSent, setFuturesFeedbackSent] = useState<"good" | "bad" | null>(null);
  const [futuresFeedbackNote, setFuturesFeedbackNote] = useState("");
  // Chris Clayton Strategy (owner-only)
  const [chrisClaytonChartFile, setChrisClaytonChartFile] = useState<File | null>(null);
  const [chrisClaytonChartPreview, setChrisClaytonChartPreview] = useState<string | null>(null);
  const [chrisClaytonSymbol, setChrisClaytonSymbol] = useState("");
  const [chrisClaytonAssetType, setChrisClaytonAssetType] = useState<"crypto" | "gold">("crypto");
  const [chrisClaytonResult, setChrisClaytonResult] = useState<{
    signal: "SHORT" | "NO_SETUP";
    confluenceScore: number;
    entry: string;
    tp1: string;
    tp2: string;
    sl: string;
    componentScores?: Record<string, number>;
    summary: string;
    reasons: string[];
  } | null>(null);
  const [chrisClaytonLoading, setChrisClaytonLoading] = useState(false);
  const [chrisClaytonError, setChrisClaytonError] = useState<string | null>(null);
  const [chrisClaytonCopied, setChrisClaytonCopied] = useState(false);
  const [chrisClaytonShareLoading, setChrisClaytonShareLoading] = useState(false);
  const [chrisClaytonShareSuccess, setChrisClaytonShareSuccess] = useState(false);
  const [onlineBossFeedbackLoading, setOnlineBossFeedbackLoading] = useState(false);
  const [onlineBossFeedbackSent, setOnlineBossFeedbackSent] = useState<"good" | "bad" | null>(null);
  const [onlineBossFeedbackNote, setOnlineBossFeedbackNote] = useState("");
  /** Owner-only Online Boss sub-tab */
  const [onlineBossSubTab, setOnlineBossSubTab] = useState<"chart" | "demandFib">("chart");
  const [novaConnectEnabled, setNovaConnectEnabled] = useState(true);
  const [novaConnectRulesAccepted, setNovaConnectRulesAccepted] = useState(false);
  const novaConnectRulesRef = useRef<HTMLDivElement | null>(null);
  const novaConnectPrivacyRef = useRef<HTMLDivElement | null>(null);
  // NovaConnect UI state (community posts may have replies)
  type NovaConnectCommunityMessage = {
    id: string;
    fromUserId: string;
    fromDisplayName: string;
    fromAvatarUrl?: string | null;
    content: string;
    imageUrl?: string | null;
    createdAt: string;
    replies?: NovaConnectCommunityMessage[];
  };
  const [novaConnectMessages, setNovaConnectMessages] = useState<NovaConnectCommunityMessage[]>([]);
  const [novaConnectUsers, setNovaConnectUsers] = useState<
    { id: string; displayName: string; avatarUrl?: string | null; status: string; me: boolean }[]
  >([]);
  const [novaConnectCommunityInput, setNovaConnectCommunityInput] = useState("");
  const [novaConnectCommunityImageUrl, setNovaConnectCommunityImageUrl] = useState("");
  const [novaConnectLoading, setNovaConnectLoading] = useState(false);
  const [novaConnectError, setNovaConnectError] = useState<string | null>(null);
  const [novaConnectSending, setNovaConnectSending] = useState(false);
  const [novaConnectDmUserId, setNovaConnectDmUserId] = useState<string | null>(null);
  const [novaConnectDmMessages, setNovaConnectDmMessages] = useState<
    { id: string; fromUserId: string; toUserId: string | null; fromDisplayName: string; content: string; createdAt: string }[]
  >([]);
  const [novaConnectDmInput, setNovaConnectDmInput] = useState("");
  const [novaConnectDmSending, setNovaConnectDmSending] = useState(false);
  const [novaConnectDmPreviews, setNovaConnectDmPreviews] = useState<
    { otherUserId: string; otherDisplayName: string; lastMessageId: string; lastFromUserId: string; lastContent: string; lastCreatedAt: string }[]
  >([]);
  const [novaConnectDmUnreadUserIds, setNovaConnectDmUnreadUserIds] = useState<string[]>([]);
  const [novaConnectHasUnreadDm, setNovaConnectHasUnreadDm] = useState(false);
  const [novaConnectEditingId, setNovaConnectEditingId] = useState<string | null>(null);
  const [novaConnectEditingContent, setNovaConnectEditingContent] = useState("");
  const [novaConnectEditSaving, setNovaConnectEditSaving] = useState(false);
  const [novaConnectDeleteLoading, setNovaConnectDeleteLoading] = useState<string | null>(null);
  const [novaConnectReplyingToId, setNovaConnectReplyingToId] = useState<string | null>(null);
  const [novaConnectReplyContent, setNovaConnectReplyContent] = useState("");
  const [novaConnectReplySending, setNovaConnectReplySending] = useState(false);
  const [novaConnectHasCustomDisplayName, setNovaConnectHasCustomDisplayName] = useState<boolean | null>(null);
  const [novaConnectAvatarFailedIds, setNovaConnectAvatarFailedIds] = useState<Set<string>>(new Set());
  const [novaConnectAvatarLightbox, setNovaConnectAvatarLightbox] = useState<{
    src: string;
    name: string;
  } | null>(null);
  const [novaConnectFeedAvatarFailedIds, setNovaConnectFeedAvatarFailedIds] = useState<Set<string>>(new Set());
  const [novaConnectNicknamePromptDismissed, setNovaConnectNicknamePromptDismissed] = useState(() =>
    typeof window !== "undefined" ? window.localStorage.getItem("novaConnectNicknamePromptDismissed") === "1" : false
  );

  useEffect(() => {
    if (!novaConnectAvatarLightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNovaConnectAvatarLightbox(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [novaConnectAvatarLightbox]);

  // First-time visit (already registered): direct to NovaConnect for privacy & community rules
  useEffect(() => {
    if (status !== "authenticated" || !novaConnectEnabled) return;
    if (!pageTabFlagsLoaded) return;
    if (!isTabVisibleInGui("nova-connect")) return;
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem("firstVisitDashboard") === "1") return;
    window.localStorage.setItem("firstVisitDashboard", "1");
    setActiveTab("nova-connect");
  }, [status, novaConnectEnabled, pageTabFlagsLoaded, isTabVisibleInGui]);

  // Poll DM and play beep when the other user sends a new message
  useEffect(() => {
    if (!novaConnectDmUserId || status !== "authenticated") return;
    const meId = (session?.user as { id?: string })?.id;
    if (!meId) return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/nova-connect/messages?scope=dm&userId=${encodeURIComponent(novaConnectDmUserId)}`);
        const data = await res.json();
        if (!data.success || !Array.isArray(data.messages)) return;
        const messages = data.messages as { id: string; fromUserId: string; toUserId: string | null; fromDisplayName: string; content: string; createdAt: string }[];
        let hasNewFromOther = false;
        for (const m of messages) {
          if (m.fromUserId !== meId && !novaConnectDmLastIdsRef.current.has(m.id)) {
            hasNewFromOther = true;
          }
          novaConnectDmLastIdsRef.current.add(m.id);
        }
        if (hasNewFromOther) playDmBeep();
        setNovaConnectDmMessages(messages);
      } catch {
        // ignore
      }
    };
    novaConnectDmLastIdsRef.current = new Set();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [novaConnectDmUserId, status, session?.user]);

  // Poll DM previews so users see alerts when someone has messaged them, even if they haven't opened that DM yet
  useEffect(() => {
    if (activeTab !== "nova-connect" || status !== "authenticated" || !canUseNovaConnectPaidFeatures) return;
    const meId = (session?.user as { id?: string })?.id;
    if (!meId) return;
    if (typeof window === "undefined") return;
    const key = getDmSeenKey();
    const loadSeen = (): Record<string, string> => {
      if (!key) return {};
      try {
        const raw = window.localStorage.getItem(key);
        if (!raw) return {};
        return JSON.parse(raw) as Record<string, string>;
      } catch {
        return {};
      }
    };
    const applyPreviews = (previews: { otherUserId: string; lastMessageId: string; lastFromUserId: string; lastCreatedAt: string }[]) => {
      const seen = loadSeen();
      const unreadUserIds: string[] = [];
      for (const p of previews) {
        const seenId = seen[p.otherUserId];
        if (p.lastFromUserId !== meId && (!seenId || seenId !== p.lastMessageId)) {
          unreadUserIds.push(p.otherUserId);
        }
      }
      setNovaConnectDmUnreadUserIds(unreadUserIds);
      setNovaConnectHasUnreadDm(unreadUserIds.length > 0);
    };
    const poll = async () => {
      try {
        const res = await fetch("/api/nova-connect/messages?scope=dm-preview");
        const data = await res.json();
        if (!data.success || !Array.isArray(data.previews)) return;
        const previews = (data.previews as any[]).map((p) => ({
          otherUserId: p.otherUserId as string,
          otherDisplayName: p.otherDisplayName as string,
          lastMessageId: p.lastMessageId as string,
          lastFromUserId: p.lastFromUserId as string,
          lastContent: p.lastContent as string,
          lastCreatedAt: (p.lastCreatedAt as string) ?? new Date().toISOString(),
        }));
        setNovaConnectDmPreviews(previews);
        applyPreviews(previews);
      } catch {
        // ignore
      }
    };
    poll();
    const interval = setInterval(poll, 8000);
    return () => clearInterval(interval);
  }, [activeTab, status, canUseNovaConnectPaidFeatures, session?.user]);

  useEffect(() => {
    if (activeTab !== "nova-connect") return;
    if (!novaConnectRulesAccepted) return;
    loadNovaConnectCommunity();
    if (canUseNovaConnectPaidFeatures) loadNovaConnectUsers();
    fetch("/api/nova-connect/profile")
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.profile) setNovaConnectHasCustomDisplayName(!!d.profile.hasCustomDisplayName);
      })
      .catch(() => {});
  }, [activeTab, novaConnectRulesAccepted, canUseNovaConnectPaidFeatures]);

  // NovaConnect presence heartbeat: mark self as online so others see you in the list
  useEffect(() => {
    if (activeTab !== "nova-connect" || !novaConnectRulesAccepted || status !== "authenticated") return;
    const heartbeat = () =>
      fetch("/api/nova-connect/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "online" }),
      }).catch(() => {});
    heartbeat();
    const interval = setInterval(heartbeat, 45000);
    return () => clearInterval(interval);
  }, [activeTab, novaConnectRulesAccepted, status]);

  // Poll online users list so new people appearing online show up
  useEffect(() => {
    if (activeTab !== "nova-connect" || !novaConnectRulesAccepted || !canUseNovaConnectPaidFeatures) return;
    const interval = setInterval(() => loadNovaConnectUsers(), 15000);
    return () => clearInterval(interval);
  }, [activeTab, novaConnectRulesAccepted, canUseNovaConnectPaidFeatures]);

  const showNicknamePrompt = novaConnectRulesAccepted && novaConnectHasCustomDisplayName === false && !novaConnectNicknamePromptDismissed;
  const dismissNicknamePrompt = () => {
    setNovaConnectNicknamePromptDismissed(true);
    if (typeof window !== "undefined") window.localStorage.setItem("novaConnectNicknamePromptDismissed", "1");
  };

  const fetchTokens = async (tab: TabId = activeTab, showLoading = true) => {
    if (tab === "ai-analysis") {
      if (showLoading) setLoading(false);
      if (isPaid) fetchPinnedTokens();
      return;
    }
    if (tab === "futures" || tab === "trading-bot" || tab === "polymarket-bot" || tab === "prop-firm-bot" || tab === "watchlist") {
      if (showLoading) setLoading(false);
      return;
    }
    if (tab === "ct" && !canAccessCtScanEffective) {
      if (showLoading) setLoading(false);
      setError(null);
      setTokens([]);
      return;
    }
    if (tab === "wallets" && walletTrackerView !== "meme") {
      // Wallet-tracker API is meme-only; leverage view has its own data sources.
      if (showLoading) setLoading(false);
      return;
    }
    if (tab === "wallets" && walletTrackerView === "meme" && !canAccessMemeCoinsTraderEffective) {
      if (showLoading) setLoading(false);
      setError(null);
      setWalletAlerts([]);
      return;
    }
    if (showLoading) setLoading(true);
    setError(null);
    try {
      if (tab === "bsc") {
        const view = bscGoHuntingView;
        const url = view === "trending" ? "/api/trending-bsc" : `/api/new-pairs-bsc?view=${view}&maxAgeMinutes=120&limit=150`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.success) {
          setTokens(data.tokens ?? []);
          setLastFetched(new Date());
        } else {
          setError(data.error ?? "Failed to load BSC tokens");
        }
        if (showLoading) setLoading(false);
        return;
      }
      if (tab === "wallets") {
        const res = await fetch("/api/wallet-tracker");
        const data = await res.json();
        if (data.success) {
          setWalletAlerts(data.alerts ?? []);
          if (data.minBuyers != null) setAlertMinBuyers(data.minBuyers);
          if (data.liveTradesEnabled !== undefined) setLiveTradesEnabled(data.liveTradesEnabled);
          setLastFetched(new Date());
          if (data.liveTradesEnabled) fetchWalletTrades();
        } else {
          if (res.status === 403 && data.locked) setError(data.error || "Subscribe to access this feature.");
          else setError(data.error || "Failed to load wallet alerts");
        }
        if (isOwner) {
          fetch("/api/wallet-tracker/first-buy")
            .then((r) => r.json())
            .then((d) => {
              if (d.success) {
                setFirstBuyEnabled(d.firstBuyEnabled ?? false);
                setFirstBuyAlerts(d.recentAlerts ?? []);
              }
            })
            .catch(() => {});
        }
        if (showLoading) setLoading(false);
        return;
      }
      const surgeWindowParam = tab === "surge" ? surgeWindow : "24h";
      const limit = isPaid ? 200 : 50;
      const url =
        tab === "trending" ? "/api/trending"
        : tab === "surge" ? `/api/surge?window=${surgeWindowParam}&limit=80`
        : tab === "transactions" ? "/api/surge?window=24h&limit=80"
        : tab === "new" ? `/api/new-pairs?maxAgeMinutes=120&limit=${limit}&view=${goHuntingView}`
        : tab === "ct" ? "/api/tokens?source=twitter"
        : "/api/tokens";
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setTokens(data.tokens);
        setLastFetched(new Date());
      } else {
        if (res.status === 403 && data.locked) setError(data.error || "Subscribe to access this feature.");
        else setError(data.error || "Failed to load tokens");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch");
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const fetchCtAccounts = async () => {
    try {
      const res = await fetch("/api/ct-accounts");
      const data = await res.json();
      if (data.success) setCtAccounts(data.accounts || []);
    } catch {
      setCtAccounts([]);
    }
  };

  const fetchTrackedWallets = async () => {
    try {
      const res = await fetch("/api/ct-wallets", { cache: "no-store" });
      const data = await res.json();
      if (data.success) setTrackedWallets(data.wallets || []);
    } catch {
      setTrackedWallets([]);
    }
  };

  const fetchWalletTrades = async () => {
    setWalletTradesLoading(true);
    setWalletTradesError(null);
    try {
      const res = await fetch("/api/wallet-tracker/trades", { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        setWalletTrades(data.trades ?? []);
      } else {
        setWalletTrades([]);
        setWalletTradesError(data.error ?? (res.status === 403 ? "VIP subscription required for live trades." : "Could not load live trades."));
      }
    } catch {
      setWalletTrades([]);
      setWalletTradesError("Failed to load live trades.");
    } finally {
      setWalletTradesLoading(false);
    }
  };

  const toggleLiveTrades = async () => {
    if (!isOwner) return;
    setLiveTradesToggling(true);
    try {
      const res = await fetch("/api/admin/feature-flags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "live_trades_enabled", enabled: !liveTradesEnabled }),
      });
      const data = await res.json();
      if (data.success && data.flags?.live_trades_enabled !== undefined) {
        setLiveTradesEnabled(data.flags.live_trades_enabled);
        if (data.flags.live_trades_enabled) fetchWalletTrades();
      }
    } finally {
      setLiveTradesToggling(false);
    }
  };

  const fetchCtTweets = async () => {
    setCtTweetsLoading(true);
    setCtTweetsError(null);
    try {
      const res = await fetch("/api/ct-tweets");
      const data = await res.json();
      if (data.success) {
        setCtTweets(data.tweets ?? []);
      } else {
        setCtTweets([]);
        setCtTweetsError(data.error ?? "Failed to load CT tweets.");
      }
    } catch {
      setCtTweets([]);
      setCtTweetsError("Failed to load CT tweets.");
    } finally {
      setCtTweetsLoading(false);
    }
  };

  const fetchTopTraders = async () => {
    setTopTradersLoading(true);
    setTopTradersError(null);
    try {
      const res = await fetch("/api/hyperliquid/top-traders", { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        setTopTradersData(data.traders ?? []);
        fetchLeverageAlerts();
      } else {
        setTopTradersData([]);
        const err = data.error ?? "Failed to load Top Leverage Traders.";
        setTopTradersError(typeof err === "string" && (err.includes("429") || err.includes("Rate limited")) ? "Rate limited—please try again in a minute." : err);
      }
    } catch {
      setTopTradersData([]);
      setTopTradersError("Failed to load top traders.");
    } finally {
      setTopTradersLoading(false);
    }
  };

  const fetchLeverageAlerts = async () => {
    setLeverageAlertsLoading(true);
    try {
      const res = await fetch("/api/leverage-wallet-tracker/alerts", { cache: "no-store" });
      const data = await res.json();
      if (data.success) setLeverageAlerts(data.alerts ?? []);
      else setLeverageAlerts([]);
    } catch {
      setLeverageAlerts([]);
    } finally {
      setLeverageAlertsLoading(false);
    }
  };

  const fetchUserLeverageWallets = async () => {
    try {
      const res = await fetch("/api/user/leverage-wallets", { cache: "no-store" });
      const data = await res.json();
      if (data.success) setUserLeverageWallets(data.wallets ?? []);
      else setUserLeverageWallets([]);
    } catch {
      setUserLeverageWallets([]);
    }
  };
  const fetchUserMemeCoinWallets = async () => {
    try {
      const res = await fetch("/api/user/meme-coin-wallets", { cache: "no-store" });
      const data = await res.json();
      if (data.success) setUserMemeCoinWallets(data.wallets ?? []);
      else setUserMemeCoinWallets([]);
    } catch {
      setUserMemeCoinWallets([]);
    }
  };
  const fetchUserMemeCoinAlerts = async () => {
    try {
      const res = await fetch("/api/user/meme-coin-alerts", { cache: "no-store" });
      const data = await res.json();
      if (data.success) setUserMemeCoinAlerts(data.alerts ?? []);
      else setUserMemeCoinAlerts([]);
    } catch {
      setUserMemeCoinAlerts([]);
    }
  };
  const openTraderHistory = (address: string, nickname: string | null) => {
    setHistoryAddress(address);
    setHistoryNickname(nickname ?? null);
    setHistoryFills([]);
    setHistoryLoading(true);
    fetch(`/api/leverage-wallet-tracker/history?address=${encodeURIComponent(address)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setHistoryFills(data.fills ?? []);
        else setHistoryFills([]);
      })
      .catch(() => setHistoryFills([]))
      .finally(() => setHistoryLoading(false));
  };

  useEffect(() => {
    const needsPaid = PAID_TABS.includes(activeTab);
    const needsVip = VIP_ONLY_TABS.includes(activeTab);
    const canAccess = needsVip ? isVip : needsPaid ? isPaid : true;
    if (needsPaid && !canAccess) {
      setLoading(false);
      setError(null);
      return;
    }
    if (activeTab === "ct" && !canAccessCtScanEffective) {
      setLoading(false);
      setError(null);
      return;
    }
    if (activeTab === "wallets" && walletTrackerView === "meme" && !canAccessMemeCoinsTraderEffective) {
      setLoading(false);
      setError(null);
      return;
    }
    fetchTokens(activeTab);
    if (activeTab === "ct") {
      if (canAccessCtScanEffective) {
        fetchCtAccounts();
        fetchCtTweets();
      }
    }
    if (activeTab === "wallets") {
      if (walletTrackerView === "meme") fetchTrackedWallets();
    }
  }, [activeTab, isPaid, isVip, goHuntingView, bscGoHuntingView, walletTrackerView, canAccessCtScanEffective, canAccessMemeCoinsTraderEffective]);

  useEffect(() => {
    if (activeTab === "surge") fetchTokens("surge");
  }, [surgeWindow]);

  const fetchTrendingPerps = async (timeframeOverride?: "24h" | "1h" | "30m" | "15m" | "5m", allTimeframes?: boolean) => {
    const tf = timeframeOverride ?? trendingPerpsTimeframe;
    setTrendingPerpsLoading(true);
    try {
      const url = allTimeframes
        ? "/api/hyperliquid/trending-perps?limit=25&allTimeframes=1"
        : `/api/hyperliquid/trending-perps?limit=40&timeframe=${tf}`;
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json();
      if (data.success && Array.isArray(data.perps)) setTrendingPerps(data.perps);
      else setTrendingPerps([]);
    } catch {
      setTrendingPerps([]);
    } finally {
      setTrendingPerpsLoading(false);
    }
  };

  const fetchPerpRadar = async (view?: "all" | "macro" | "metals") => {
    const v = view ?? perpRadarView;
    setPerpRadarLoading(true);
    setPerpRadarError(null);
    try {
      const params = new URLSearchParams();
      if (v === "macro" || v === "metals") {
        params.set("category", v);
        params.set("limit", "50");
      } else {
        params.set("minChangePct", "3");
        params.set("minQuoteVolume", "100000");
        params.set("limit", "150");
      }
      const res = await fetch(`/api/perp-radar?${params.toString()}`, { cache: "no-store", credentials: "include" });
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.items)) {
        setPerpRadarItems(data.items);
      } else {
        setPerpRadarItems([]);
        setPerpRadarError(data?.error ?? (res.ok ? "No data" : `Error ${res.status}`));
      }
    } catch (e) {
      setPerpRadarItems([]);
      setPerpRadarError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setPerpRadarLoading(false);
    }
  };

  const MACRO_BASES_REGEX = /^(CRUDE|XBR|OIL|WTI|BRENT|CL|NG|NATURALGAS|GAS|XAU|GOLD|XAG|SILVER|SPX|SPX500|SP500|NDX|NAS100|DJI|US30)$/i;
  const MACRO_PINNED_REGEX = /^(XAU|XAG|SPX)$/i;
  const METALS_BASES_REGEX = /^(XAU|GOLD|XAG|SILVER)$/i;
  const METALS_PINNED_REGEX = /^(XAU|XAG)$/i;
  /** Fallback when server gets 451: fetch Binance from user's browser (works in allowed regions). */
  const fetchPerpRadarFromBrowser = async () => {
    setPerpRadarLoading(true);
    setPerpRadarError(null);
    const macroOnly = perpRadarView === "macro";
    const metalsOnly = perpRadarView === "metals";
    const minChangePct = 3;
    const minQuoteVolume = macroOnly || metalsOnly ? 0 : 100_000;
    const limit = macroOnly || metalsOnly ? 50 : 150;
    try {
      const res = await fetch("https://fapi.binance.com/fapi/v1/ticker/24hr", { cache: "no-store" });
      if (!res.ok) throw new Error(`Binance returned ${res.status}. Your region may be restricted.`);
      const data = await res.json();
      const arr = Array.isArray(data) ? data : [data];
      const out: PerpRadarItem[] = [];
      for (const t of arr) {
        if (!t?.symbol?.endsWith?.("USDT")) continue;
        const base = t.symbol.replace("USDT", "");
        if (macroOnly && !MACRO_BASES_REGEX.test(base)) continue;
        if (metalsOnly && !METALS_BASES_REGEX.test(base)) continue;
        const change = Number(t.priceChangePercent ?? "0");
        const quoteVol = Number(t.quoteVolume ?? "0");
        if (!Number.isFinite(change) || !Number.isFinite(quoteVol)) continue;
        const pinnedMacro = macroOnly && MACRO_PINNED_REGEX.test(base);
        const pinnedMetals = metalsOnly && METALS_PINNED_REGEX.test(base);
        if (!macroOnly && !metalsOnly && (Math.abs(change) < minChangePct || quoteVol < minQuoteVolume)) continue;
        if (macroOnly && !pinnedMacro && quoteVol < 0) continue;
        if (metalsOnly && !pinnedMetals && quoteVol < 0) continue;
        const last = Number(t.lastPrice ?? "0");
        const vol = Number(t.volume ?? "0");
        if (!Number.isFinite(last) || !Number.isFinite(vol)) continue;
        out.push({
          exchange: "binance",
          symbol: t.symbol,
          base,
          quote: "USDT",
          change24hPct: change,
          lastPrice: last,
          volume24h: vol,
          quoteVolume24h: quoteVol,
        });
      }
      out.sort((a, b) => Math.abs(b.change24hPct) - Math.abs(a.change24hPct));
      const list = out.slice(0, limit);
      setPerpRadarItems(list);
      const bases = list.slice(0, 35).map((i) => i.base);
      if (bases.length > 0) {
        try {
          const resEnrich = await fetch(`/api/perp-radar/enrich?bases=${encodeURIComponent(bases.join(","))}`, { cache: "no-store", credentials: "include" });
          const jsonEnrich = await resEnrich.json();
          if (jsonEnrich.success && jsonEnrich.data && typeof jsonEnrich.data === "object") {
            const data = jsonEnrich.data as Record<string, { pct5m?: number | null; pct15m?: number | null; pct30m?: number | null; pct1h?: number | null; pct4h?: number | null }>;
            const merged = list.map((item) => {
              const d = data[item.base];
              if (!d) return item;
              return {
                ...item,
                pct5m: d.pct5m ?? undefined,
                pct15m: d.pct15m ?? undefined,
                pct30m: d.pct30m ?? undefined,
                pct1h: d.pct1h ?? undefined,
                pct4h: d.pct4h ?? undefined,
              };
            });
            setPerpRadarItems(merged);
          }
        } catch {
          /* keep list without 5m–4h if enrich fails */
        }
      }
    } catch (e) {
      setPerpRadarItems([]);
      setPerpRadarError(e instanceof Error ? e.message : "Failed to load from browser");
    } finally {
      setPerpRadarLoading(false);
    }
  };

  const fetchNovaForecast = async (symbolsOverride?: string[], rangeOverride?: string) => {
    setNovaForecastLoading(true);
    setNovaForecastError(null);
    const range = rangeOverride ?? novaForecastRange;
    try {
      const params = new URLSearchParams();
      if (range) params.set("range", range);
      if (symbolsOverride?.length) params.set("symbols", symbolsOverride.join(","));
      const qs = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(`/api/nova-forecast${qs}`, { cache: "no-store", credentials: "include" });
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.forecasts)) {
        setNovaForecastItems(data.forecasts);
        if (data.rangeId) setNovaForecastRange(data.rangeId);
        if (data.rangeLabel) setNovaForecastRangeLabel(data.rangeLabel);
      } else {
        setNovaForecastItems([]);
        setNovaForecastError(data?.error ?? (res.ok ? "No data" : `Error ${res.status}`));
      }
    } catch (e) {
      setNovaForecastItems([]);
      setNovaForecastError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setNovaForecastLoading(false);
    }
  };

  const submitNovaSmartFeedback = async (symbol: string, strategy: string, worked: boolean) => {
    try {
      await fetch("/api/admin/nova-smart-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, strategy, worked }),
        credentials: "include",
      });
    } catch {
      // ignore
    }
  };

  const fetchNovaSmart = async () => {
    setNovaSmartFeedbackSent(new Set());
    setNovaSmartLoading(true);
    setNovaSmartError(null);
    const symbols = novaSmartCustomSymbol.trim()
      ? novaSmartCustomSymbol.split(/[\s,]+/).map((s) => s.trim().toUpperCase()).filter(Boolean)
      : ["BTC", "ETH", "SOL"];
    if (symbols.length === 0) {
      setNovaSmartError("Enter at least one symbol or use defaults.");
      setNovaSmartLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/nova-smart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbols, timeframes: novaSmartTimeframes }),
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.results)) {
        setNovaSmartResults(data.results);
      } else {
        setNovaSmartResults([]);
        setNovaSmartError(data?.locked ? "NovaSmart Analysis is for VIP subscribers." : (data?.error ?? (res.ok ? "No data" : `Error ${res.status}`)));
      }
    } catch (e) {
      setNovaSmartResults([]);
      setNovaSmartError(e instanceof Error ? e.message : "NovaSmart failed");
    } finally {
      setNovaSmartLoading(false);
    }
  };

  const fetchNovaQ = async () => {
    setNovaQLoading(true);
    setNovaQError(null);
    const symbol = novaQSymbol.trim().toUpperCase() || "BTC";
    try {
      const res = await fetch("/api/nova-q", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, timeframes: novaQTimeframes }),
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.success && data.result) {
        setNovaQResult(data.result as NovaQResult);
      } else {
        setNovaQResult(null);
        setNovaQError(data?.locked ? "NovaQ is for VIP subscribers." : (data?.error ?? (res.ok ? "No data" : `Error ${res.status}`)));
      }
    } catch (e) {
      setNovaQResult(null);
      setNovaQError(e instanceof Error ? e.message : "NovaQ failed");
    } finally {
      setNovaQLoading(false);
    }
  };

  const fetchNovaRadar = async () => {
    setNovaRadarLoading(true);
    setNovaRadarError(null);
    const targetRaw = novaRadarTarget.trim();
    if (!targetRaw) {
      setNovaRadarError("Enter a limit price (for example 67000).");
      setNovaRadarLoading(false);
      return;
    }
    const symbol = novaRadarSymbol.trim().toUpperCase() || "BTC";
    try {
      const res = await fetch("/api/nova-radar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, targetPrice: targetRaw, side: novaRadarSide }),
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.success && data.result) {
        setNovaRadarResult(data.result as NovaRadarResult);
      } else {
        setNovaRadarResult(null);
        setNovaRadarError(data?.locked ? "NovaRadar is for VIP subscribers." : (data?.error ?? (res.ok ? "No data" : `Error ${res.status}`)));
      }
    } catch (e) {
      setNovaRadarResult(null);
      setNovaRadarError(e instanceof Error ? e.message : "NovaRadar failed");
    } finally {
      setNovaRadarLoading(false);
    }
  };

  const fetchNovaPlus = async () => {
    setNovaPlusLoading(true);
    setNovaPlusError(null);
    const symbol = novaPlusSymbol.trim().toUpperCase() || "BTC";
    const amount = Number(novaPlusAmount);
    try {
      const res = await fetch("/api/nova-plus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          timeframe: novaPlusTimeframe,
          amount: Number.isFinite(amount) && amount > 0 ? amount : null,
          riskPct: (() => {
            const r = Number(novaPlusRiskPct);
            return Number.isFinite(r) && r > 0 ? Math.min(50, Math.max(0.01, r)) : undefined;
          })(),
          targetProfitUsd: (() => {
            const p = Number(novaPlusTargetProfit);
            return Number.isFinite(p) && p > 0 ? p : null;
          })(),
          leverage: (() => {
            const L = Number(novaPlusLeverage);
            return Number.isFinite(L) && L >= 1 ? L : null;
          })(),
        }),
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.success && data.result) {
        setNovaPlusResult(data.result as NovaPlusResult);
      } else {
        setNovaPlusResult(null);
        setNovaPlusError(data?.locked ? "Nova+ is for VIP subscribers." : (data?.error ?? (res.ok ? "No data" : `Error ${res.status}`)));
      }
    } catch (e) {
      setNovaPlusResult(null);
      setNovaPlusError(e instanceof Error ? e.message : "Nova+ failed");
    } finally {
      setNovaPlusLoading(false);
    }
  };

  const fetchTopAltcoins = async () => {
    setTopAltcoinsLoading(true);
    try {
      const res = await fetch("/api/hyperliquid/top-altcoins", { cache: "no-store" });
      const data = await res.json();
      if (data.success && Array.isArray(data.perps)) setTopAltcoins(data.perps);
      else setTopAltcoins([]);
    } catch {
      setTopAltcoins([]);
    } finally {
      setTopAltcoinsLoading(false);
    }
  };

  const fetchHotPerps = async () => {
    setHotPerpsLoading(true);
    try {
      const res = await fetch("/api/hyperliquid/hot-new-perps", { cache: "no-store" });
      const data = await res.json();
      if (data.success && Array.isArray(data.perps)) {
        setHotPerps(data.perps);
        setHotPerpsNewOnly(!!data.newOnly);
      } else {
        setHotPerps([]);
        setHotPerpsNewOnly(false);
      }
    } catch {
      setHotPerps([]);
      setHotPerpsNewOnly(false);
    } finally {
      setHotPerpsLoading(false);
    }
  };

  const fetchPerpAiSignal = async (symbol: string) => {
    setPerpAiSignals((prev) => ({ ...prev, [symbol]: "loading" }));
    try {
      const res = await fetch("/api/ai-perp-signal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, timeframe: "15m" }),
      });
      const data = await res.json();
      if (res.status === 403 && data.locked) {
        alert("Subscribe to use NovaStaris AI Signal (perps).");
        setPerpAiSignals((p) => {
          const next = { ...p };
          delete next[symbol];
          return next;
        });
        return;
      }
      if (data.success && (data.signal === "long" || data.signal === "short" || data.signal === "no_buy")) {
        setPerpAiSignals((p) => ({ ...p, [symbol]: { signal: data.signal, score: data.score ?? 0, reason: data.reason ?? "" } }));
      } else {
        setPerpAiSignals((p) => {
          const next = { ...p };
          delete next[symbol];
          return next;
        });
      }
    } catch {
      setPerpAiSignals((p) => {
        const next = { ...p };
        delete next[symbol];
        return next;
      });
    }
  };

  const fetchPerpAlerts = async () => {
    setPerpAlertsLoading(true);
    try {
      const res = await fetch("/api/user/perp-alerts", { cache: "no-store" });
      const data = await res.json();
      if (data.success && Array.isArray(data.alerts)) setPerpAlertsList(data.alerts);
      else if (res.status !== 403) setPerpAlertsList([]);
    } catch {
      setPerpAlertsList([]);
    } finally {
      setPerpAlertsLoading(false);
    }
  };

  const addPerpAlert = async () => {
    setPerpAlertAddError(null);
    const symbol = perpAlertAddType === "new_listing" ? null : perpAlertAddSymbol.trim().toUpperCase() || null;
    const threshold = perpAlertAddType !== "new_listing" && perpAlertAddThreshold.trim() ? parseFloat(perpAlertAddThreshold) : null;
    if (perpAlertAddType !== "new_listing" && !symbol) {
      setPerpAlertAddError("Symbol required for this alert type.");
      return;
    }
    if ((perpAlertAddType === "5m_pct_above" || perpAlertAddType === "5m_pct_below") && (threshold == null || !Number.isFinite(threshold))) {
      setPerpAlertAddError("Enter a number for threshold.");
      return;
    }
    try {
      const res = await fetch("/api/user/perp-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertType: perpAlertAddType, symbol, threshold }),
      });
      const data = await res.json();
      if (data.success) {
        setPerpAlertAddSymbol("");
        setPerpAlertAddThreshold("");
        fetchPerpAlerts();
      } else {
        setPerpAlertAddError(data.error || "Failed to add alert.");
      }
    } catch {
      setPerpAlertAddError("Request failed.");
    }
  };

  const deletePerpAlert = async (id: string) => {
    try {
      const res = await fetch("/api/user/perp-alerts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success) fetchPerpAlerts();
    } catch {
      /* ignore */
    }
  };

  const renderPerpAiSignalCell = (symbol: string) => {
    const v = perpAiSignals[symbol];
    if (v === "loading") return <span className="text-xs text-muted-foreground">…</span>;
    if (v) {
      const label = v.signal === "long" ? "Long" : v.signal === "short" ? "Short" : "No buy";
      const color = v.signal === "long" ? "text-emerald-600 dark:text-emerald-400" : v.signal === "short" ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground";
      return (
        <span className="text-xs" title={v.reason}>
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${color}`}>{v.score}</Badge> <span className={color}>{label}</span>
        </span>
      );
    }
    return (
      <Button variant="ghost" size="sm" className="h-7 text-xs text-cyan-600 dark:text-cyan-400 hover:underline" onClick={() => fetchPerpAiSignal(symbol)}>
        AI Signal
      </Button>
    );
  };

  useEffect(() => {
    if (activeTab === "wallets" && walletTrackerView === "leverage") {
      fetchTopTraders();
      fetchLeverageAlerts();
      fetchUserLeverageWallets();
    }
    if (activeTab === "wallets" && walletTrackerView === "meme") {
      if (canAccessMemeCoinsTraderEffective) {
        fetchUserMemeCoinWallets();
        fetchUserMemeCoinAlerts();
      } else {
        setUserMemeCoinWallets([]);
        setUserMemeCoinAlerts([]);
      }
    }
    if (activeTab === "futures" && isPaid) fetchTrendingPerps();
    if (activeTab === "futures" && futuresView === "altcoins") fetchTopAltcoins();
    if (activeTab === "futures" && futuresView === "hot-perps") fetchHotPerps();
    if (activeTab === "trending-perps" && isPaid) {
      fetchTrendingPerps(undefined, true);
    }
    if (activeTab === "trending-perps" && isOwner) {
      fetchPerpAlerts();
    }
    if (activeTab === "perp-radar" && isPaid) {
      fetchPerpRadar();
    }
    if (activeTab === "nova-forecast" && isVip) {
      fetchNovaForecast();
    }
  }, [activeTab, walletTrackerView, futuresView, isPaid, isVip, isOwner, canAccessMemeCoinsTraderEffective]);

  // Auto-refresh current tab every 60s (skip ai-analysis, futures, narratives, watchlist). Wallets tab refreshes every 2 min.
  useEffect(() => {
    if (activeTab === "ai-analysis" || activeTab === "futures" || activeTab === "trending-perps" || activeTab === "perp-radar" || activeTab === "narratives" || activeTab === "trading-bot" || activeTab === "polymarket-bot" || activeTab === "prop-firm-bot" || activeTab === "nova-forecast" || activeTab === "nova-plus" || activeTab === "nova-investment" || activeTab === "watchlist") return;
    if (activeTab === "wallets") {
      const interval = setInterval(() => {
        if (walletTrackerView === "meme") {
          fetchTrackedWallets();
          if (liveTradesEnabled && canAccessMemeCoinsTraderEffective) fetchWalletTrades();
        }
      }, 2 * 60 * 1000);
      return () => clearInterval(interval);
    }
    const interval = setInterval(() => fetchTokens(activeTab, false), AUTO_REFRESH_SECONDS * 1000);
    return () => clearInterval(interval);
  }, [activeTab, liveTradesEnabled, walletTrackerView, canAccessMemeCoinsTraderEffective]);

  const runAiAnalysis = async () => {
    const ca = aiAnalysisCa.trim();
    if (!ca) {
      setAiAnalysisError("Enter a contract address.");
      return;
    }
    if (aiAnalysisChain === "bsc" && !isPaid) {
      setAiAnalysisError("BSC AI Agent is for Pro and VIP subscribers. Subscribe to use it.");
      return;
    }
    if (aiAnalysisChain === "bsc" && !/^0x[0-9a-fA-F]{40}$/.test(ca)) {
      setAiAnalysisError("Invalid BSC address. Use 0x followed by 40 hex characters.");
      return;
    }
    setAiAnalysisError(null);
    setAiAnalysisResult(null);
    setAiAnalysisFeedbackSent(null);
    setAiAnalysisFeedbackNote("");
    setAiAnalysisLoading(true);
    try {
      const amountNum = aiAnalysisAmountUsd.trim() ? parseFloat(aiAnalysisAmountUsd.replace(/,/g, "")) : NaN;
        const amountUsd = Number.isFinite(amountNum) && amountNum > 0 ? amountNum : undefined;
      const endpoint = aiAnalysisChain === "bsc" ? "/api/ai-analyze-bsc" : "/api/ai-analyze";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractAddress: ca, ...(amountUsd != null ? { amountUsd } : {}) }),
      });
      const data = await res.json();
      if (data.success) {
        setAiAnalysisResult({
          score: data.score,
          signal: data.signal === "buy" ? "buy" : "no_buy",
          reasons: data.reasons ?? [],
          narrativeAssessment: data.narrativeAssessment,
          amountRiskNote: data.amountRiskNote,
          recommendations: data.recommendations,
          tokenInfo: { ...data.tokenInfo, contractAddress: ca },
        });
      } else {
        if (res.status === 403 && data.locked) setAiAnalysisError(data.error || "Subscribe to access NovaStaris AI Agent.");
        else {
          const msg = data.error || "Analysis failed.";
          const friendly = (res.status === 529 || /overloaded/i.test(msg))
            ? "AI is temporarily overloaded. Please try again in a minute."
            : msg;
          setAiAnalysisError(friendly);
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Request failed.";
      const friendly = /529|overloaded/i.test(msg)
        ? "AI is temporarily overloaded. Please try again in a minute."
        : msg;
      setAiAnalysisError(friendly);
    } finally {
      setAiAnalysisLoading(false);
    }
  };

  const fetchPinnedTokens = async () => {
    if (!isPaid) return;
    setPinnedLoading(true);
    try {
      const res = await fetch("/api/pins");
      const data = await res.json();
      if (data.success && Array.isArray(data.pins)) {
        setPinnedTokens(data.pins);
      }
    } catch {
      setPinnedTokens([]);
    } finally {
      setPinnedLoading(false);
    }
  };

  const pinCurrentToken = async () => {
    const ca = aiAnalysisResult?.tokenInfo?.contractAddress ?? aiAnalysisCa.trim();
    if (!ca) return;
    setPinSuccess(null);
    try {
      const res = await fetch("/api/pins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractAddress: ca,
          chain: aiAnalysisChain,
          symbol: aiAnalysisResult?.tokenInfo?.symbol,
          name: aiAnalysisResult?.tokenInfo?.name,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPinSuccess("Pinned. Next update in ~3 min (or click Refresh on the pin).");
        await fetchPinnedTokens();
      } else {
        setAiAnalysisError(data.error ?? "Failed to pin");
      }
    } catch (e) {
      setAiAnalysisError(e instanceof Error ? e.message : "Failed to pin");
    }
  };

  const unpinToken = async (contractAddress: string) => {
    try {
      const res = await fetch(`/api/pins?contractAddress=${encodeURIComponent(contractAddress)}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) await fetchPinnedTokens();
    } catch {
      /* noop */
    }
  };

  const refreshPinnedAnalysis = async (contractAddress: string) => {
    setRefreshingPin(contractAddress);
    try {
      const res = await fetch("/api/pins/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractAddress }),
      });
      const data = await res.json();
      if (data.success && data.result) {
        setAiAnalysisResult({
          score: data.result.score,
          signal: data.result.signal === "buy" ? "buy" : "no_buy",
          reasons: data.result.reasons ?? [],
          narrativeAssessment: data.result.narrativeAssessment,
          amountRiskNote: data.result.amountRiskNote,
          recommendations: data.result.recommendations,
          tokenInfo: { ...data.result.tokenInfo, contractAddress },
        });
        setAiAnalysisCa(contractAddress);
        await fetchPinnedTokens();
      }
    } finally {
      setRefreshingPin(null);
    }
  };

  const onFuturesChartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (futuresChartPreview) URL.revokeObjectURL(futuresChartPreview);
    setFuturesChartPreview(null);
    setFuturesChartFile(file ?? null);
    if (file) setFuturesChartPreview(URL.createObjectURL(file));
    setFuturesAnalysisError(null);
  };

  const runFuturesAnalysis = async () => {
    if (!futuresChartFile || !futuresSymbol.trim()) {
      setFuturesAnalysisError("Upload a chart and enter a symbol (e.g. BTC/USDC).");
      return;
    }
    const margin = parseFloat(futuresMargin.trim());
    if (!Number.isFinite(margin) || margin <= 0) {
      setFuturesAnalysisError("Enter a valid margin (amount to invest).");
      return;
    }
    const leverage = parseFloat(futuresLeverage.trim());
    if (!Number.isFinite(leverage) || leverage < 1 || leverage > 125) {
      setFuturesAnalysisError("Leverage must be between 1 and 125.");
      return;
    }
    if (!futuresChartTimeframe.trim()) {
      setFuturesAnalysisError("Chart timeframe is required (e.g. 5m, 15m, 4h).");
      return;
    }
    if (!futuresTradeTimeframe.trim()) {
      setFuturesAnalysisError("Trade timeframe is required (e.g. Scalp, Swing).");
      return;
    }
    setFuturesAnalysisError(null);
    setFuturesAnalysisResult(null);
    setFuturesAnalysisLoading(true);
    try {
      const form = new FormData();
      form.append("chart", futuresChartFile);
      form.append("symbol", futuresSymbol.trim());
      form.append("margin", String(margin));
      form.append("leverage", String(leverage));
      form.append("chartTimeframe", futuresChartTimeframe.trim());
      form.append("tradeTimeframe", futuresTradeTimeframe.trim());
      const risk = parseFloat(futuresRiskAmount.trim());
      if (Number.isFinite(risk) && risk > 0) form.append("riskAmount", String(risk));
      if (futuresDirection) form.append("direction", futuresDirection);
      const res = await fetch("/api/ai-analyze-futures", { method: "POST", body: form });
      const data = await res.json();
      if (data.success) {
        setFuturesAnalysisResult({
          score: data.score,
          signal: data.signal === "buy" ? "buy" : "no_buy",
          tradeDirection: data.tradeDirection === "long" || data.tradeDirection === "short" ? data.tradeDirection : undefined,
          reasons: data.reasons ?? [],
          recommendations: data.recommendations,
        });
      } else {
        if (res.status === 403 && data.locked) setFuturesAnalysisError(data.error || "Subscribe to use Crypto Futures.");
        else setFuturesAnalysisError(data.error || "Analysis failed.");
      }
    } catch (e) {
      setFuturesAnalysisError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setFuturesAnalysisLoading(false);
    }
  };

  const fetchNovaCryptoNarratives = async () => {
    const sym = novaCryptoNarrativesSymbol.trim();
    if (!sym) {
      setNovaCryptoNarrativesError("Enter a contract symbol (e.g. BTC).");
      return;
    }
    setNovaCryptoNarrativesLoading(true);
    setNovaCryptoNarrativesError(null);
    try {
      const res = await fetch("/api/nova-crypto-narratives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: sym }),
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.success && data.result) {
        setNovaCryptoNarrativesResult(data.result as NovaCryptoNarrativesPanelResult);
      } else {
        setNovaCryptoNarrativesResult(null);
        setNovaCryptoNarrativesError(
          data?.locked ? "Nova Crypto Narratives is for Pro and VIP subscribers." : (data?.error ?? `Error ${res.status}`)
        );
      }
    } catch (e) {
      setNovaCryptoNarrativesResult(null);
      setNovaCryptoNarrativesError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setNovaCryptoNarrativesLoading(false);
    }
  };

  const viewPinnedResult = (p: PinnedItem) => {
    const r = p.analysisResult as { score?: number; signal?: string; reasons?: string[]; recommendations?: { supportResistance?: string; marketStructure?: string; buyZoneMcap?: string; takeProfitPct?: string; stopLossPct?: string }; tokenInfo?: { symbol?: string; name?: string; [k: string]: unknown } } | null;
    if (!r) return;
    setAiAnalysisChain((p.chain === "bsc" ? "bsc" : "solana"));
    setAiAnalysisResult({
      score: r.score ?? 0,
      signal: r.signal === "buy" ? "buy" : "no_buy",
      reasons: r.reasons ?? [],
      narrativeAssessment: (r as { narrativeAssessment?: string }).narrativeAssessment,
      amountRiskNote: (r as { amountRiskNote?: string }).amountRiskNote,
      recommendations: r.recommendations,
      tokenInfo: { ...r.tokenInfo, contractAddress: p.contractAddress },
    });
    setAiAnalysisCa(p.contractAddress);
  };

  // Sort transactions tab by total txns (buys + sells) desc; dedupe by id so React keys are unique
  const tokensForDisplay = (() => {
    const base =
      activeTab === "transactions" && tokens.length > 0
        ? [...tokens].sort((a, b) => {
            const ta = (a.txnsBuys24h ?? 0) + (a.txnsSells24h ?? 0);
            const tb = (b.txnsBuys24h ?? 0) + (b.txnsSells24h ?? 0);
            return tb - ta;
          })
        : tokens;
    const seen = new Set<string>();
    return base.filter((t) => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });
  })();

  const formatVol = (v: number | null | undefined) =>
    v != null ? `$${(v / 1000).toFixed(1)}k` : "—";

  const testDexScreener = async () => {
    setDexTest(null);
    try {
      const res = await fetch("/api/test-dexscreener");
      const data = await res.json();
      setDexTest({
        ok: data.success,
        message: data.message || (data.success ? "DexScreener OK" : "DexScreener failed"),
        newPairs: data.newPairsCount,
        trending: data.trendingCount,
        sample: data.sample?.symbol ? `${data.sample.symbol} (${data.sample.dexId})` : undefined,
      });
    } catch {
      setDexTest({ ok: false, message: "Request failed" });
    }
  };

  const testMoralis = async () => {
    setMoralisTest(null);
    try {
      const res = await fetch("/api/test-moralis");
      const data = await res.json();
      setMoralisTest({
        ok: data.success,
        message: data.message || (data.success ? "Moralis OK" : "Moralis failed"),
        count: data.count,
      });
    } catch {
      setMoralisTest({ ok: false, message: "Request failed" });
    }
  };

  const testTwitter = async () => {
    setTwitterTest(null);
    try {
      const res = await fetch("/api/test-twitter");
      const data = await res.json();
      setTwitterTest({
        ok: data.success,
        message: data.message || (data.success ? "Twitter scan OK" : "Twitter scan failed"),
        missing: data.missing || [],
      });
    } catch {
      setTwitterTest({ ok: false, message: "Request failed" });
    }
  };

  const runScan = async (type: "scan" | "twitter") => {
    if (type === "twitter" && !canAccessCtScanEffective) {
      setError("CT Scan is VIP on-demand. Contact support to request access.");
      setScanning("idle");
      return;
    }
    setScanning(type);
    setError(null);
    try {
      const url = type === "twitter" ? "/api/scan-twitter" : "/api/scan?type=new";
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        await fetchTokens();
        if (data.tokens?.length > 0) {
          setError(null);
        }
      } else {
        const msg = data.error ? (data.hint ? `${data.error} ${data.hint}` : data.error) : data.hint || "Scan failed";
        setError(msg);
      }
      if (data.success && type === "twitter" && data.tokens?.length > 0) {
        if (isTabVisibleInGui("ct")) setActiveTab("ct");
        else setActiveTab("new");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setScanning("idle");
    }
  };

  const formatLiq = (v: number | null) =>
    v != null ? `$${(v / 1000).toFixed(1)}k` : "—";
  const formatPrice = (v: number | null) =>
    v != null
      ? v < 0.01
        ? v.toExponential(2)
        : v.toFixed(6)
      : "—";
  const formatAge = (launchedAt: string) => {
    if (!launchedAt) return "—";
    const ms = Date.now() - new Date(launchedAt).getTime();
    const m = Math.floor(ms / 60000);
    const h = Math.floor(ms / 3600000);
    const d = Math.floor(ms / 86400000);
    if (d > 0) return `${d}d`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  };
  const formatAiAnalysisForShare = (r: NonNullable<typeof aiAnalysisResult>) => {
    const symbol = r.tokenInfo?.symbol ?? "Token";
    const name = r.tokenInfo?.name ?? "";
    const title = name ? `${symbol} | ${name}` : symbol;
    const lines: string[] = [];
    lines.push(`📊 ${r.score}/100 · ${r.signal === "buy" ? "🟢 BUY" : "🔴 NO BUY"}`);
    if (r.tokenInfo && (r.tokenInfo.liquidityUsd != null || r.tokenInfo.volume24h != null)) {
      const liq = r.tokenInfo.liquidityUsd != null ? `$${r.tokenInfo.liquidityUsd.toLocaleString()}` : "—";
      const vol = r.tokenInfo.volume24h != null ? `$${r.tokenInfo.volume24h.toLocaleString()}` : "—";
      const pct = r.tokenInfo.priceChange24hPct != null ? `${r.tokenInfo.priceChange24hPct >= 0 ? "+" : ""}${r.tokenInfo.priceChange24hPct.toFixed(1)}% 24h` : "";
      lines.push(`💰 Liq: ${liq} · Vol 24h: ${vol}${pct ? ` · 📈 ${pct}` : ""}`);
    }
    if (r.tokenInfo?.contractAddress) {
      lines.push(`📌 CA: ${r.tokenInfo.contractAddress}`);
      lines.push(`🔗 DexScreener: https://dexscreener.com/solana/${r.tokenInfo.contractAddress}`);
    }
    if ((r as { narrativeAssessment?: string }).narrativeAssessment) {
      lines.push(`📖 Narrative: ${(r as { narrativeAssessment?: string }).narrativeAssessment}`);
    }
    lines.push("");
    const rec = r.recommendations;
    if (rec && (rec.supportResistance || rec.marketStructure || rec.buyZoneMcap || rec.takeProfitPct || rec.stopLossPct)) {
      lines.push("📐 Trading levels (meme coins are volatile — use risk management)");
      if (rec.supportResistance) lines.push(`  📍 Support / Resistance: ${rec.supportResistance}`);
      if (rec.marketStructure) lines.push(`  📈 Market structure: ${rec.marketStructure}`);
      if (rec.buyZoneMcap) lines.push(`  🎯 Buy zone (mcap): ${rec.buyZoneMcap}`);
      if (rec.takeProfitPct) lines.push(`  ✅ Take profit: ${rec.takeProfitPct}`);
      if (rec.stopLossPct) lines.push(`  🛑 Stop loss: ${rec.stopLossPct}`);
      lines.push("");
    }
    r.reasons.forEach((reason) => lines.push(`• ${reason}`));
    return { title, content: lines.join("\n") };
  };

  const formatFuturesAnalysisForShare = (r: NonNullable<typeof futuresAnalysisResult>) => {
    const sym = futuresSymbol.trim() || "—";
    const dir = r.tradeDirection ? ` (${r.tradeDirection})` : "";
    const title = `Futures: ${sym} · ${r.score}/100 · ${r.signal === "buy" ? "BUY" : "NO BUY"}${dir}`;
    const lines: string[] = [];
    lines.push(`📊 ${r.score}/100 · ${r.signal === "buy" ? "🟢 BUY" : "🔴 NO BUY"}${r.tradeDirection ? ` · ${r.tradeDirection.toUpperCase()}` : ""}`);
    lines.push(`📌 Symbol: ${sym}`);
    if (futuresChartTimeframe.trim()) lines.push(`⏱ Chart TF: ${futuresChartTimeframe.trim()}`);
    if (futuresTradeTimeframe.trim()) lines.push(`⏱ Trade TF: ${futuresTradeTimeframe.trim()}`);
    if (futuresLeverage.trim()) lines.push(`📐 Leverage: ${futuresLeverage}x`);
    lines.push("");
    const rec = r.recommendations;
    if (rec && (rec.supportResistance || rec.marketStructure || rec.entryZone || rec.takeProfitPct || rec.stopLossPct)) {
      lines.push("📐 Trading levels (futures — use risk management)");
      if (rec.supportResistance) lines.push(`  📍 Support / Resistance: ${rec.supportResistance}`);
      if (rec.marketStructure) lines.push(`  📈 Market structure: ${rec.marketStructure}`);
      if (rec.entryZone) lines.push(`  🎯 Entry zone: ${rec.entryZone}`);
      if (rec.takeProfitPct) lines.push(`  ✅ Take profit: ${rec.takeProfitPct}`);
      if (rec.stopLossPct) lines.push(`  🛑 Stop loss: ${rec.stopLossPct}`);
      lines.push("");
    }
    r.reasons.forEach((reason) => lines.push(`• ${reason}`));
    return { title, content: lines.join("\n") };
  };

  const onChrisClaytonChartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setChrisClaytonChartFile(file);
      const url = URL.createObjectURL(file);
      setChrisClaytonChartPreview(url);
    } else {
      setChrisClaytonChartFile(null);
      setChrisClaytonChartPreview(null);
    }
    setChrisClaytonError(null);
  };

  const runChrisClaytonAnalysis = async () => {
    if (!chrisClaytonChartFile) {
      setChrisClaytonError("Upload a chart image.");
      return;
    }
    setChrisClaytonError(null);
    setChrisClaytonResult(null);
    setChrisClaytonLoading(true);
    try {
      const form = new FormData();
      form.append("chart", chrisClaytonChartFile);
      if (chrisClaytonSymbol.trim()) form.append("symbol", chrisClaytonSymbol.trim());
      form.append("assetType", chrisClaytonAssetType);
      const res = await fetch("/api/admin/chris-clayton-strategy", { method: "POST", body: form });
      const data = await res.json();
      if (data.success) {
        setChrisClaytonResult({
          signal: data.signal === "SHORT" ? "SHORT" : "NO_SETUP",
          confluenceScore: data.confluenceScore ?? 0,
          entry: data.entry ?? "—",
          tp1: data.tp1 ?? "—",
          tp2: data.tp2 ?? "—",
          sl: data.sl ?? "—",
          componentScores: data.componentScores,
          summary: data.summary ?? "",
          reasons: Array.isArray(data.reasons) ? data.reasons : [],
        });
      } else {
        setChrisClaytonError(data.error ?? "Analysis failed.");
      }
    } catch (e) {
      setChrisClaytonError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setChrisClaytonLoading(false);
    }
  };

  const formatChrisClaytonForShare = (r: NonNullable<typeof chrisClaytonResult>) => {
    const sym = chrisClaytonSymbol.trim() || "—";
    const title = `Online Boss Strategy: ${sym} · ${r.signal} · Confluence ${(r.confluenceScore * 100).toFixed(0)}%`;
    const lines: string[] = [];
    lines.push(`📊 ${r.signal} · Confluence ${(r.confluenceScore * 100).toFixed(0)}%`);
    lines.push(`📌 Symbol: ${sym}`);
    lines.push(`🎯 Entry: ${r.entry}`);
    lines.push(`✅ TP1: ${r.tp1}`);
    lines.push(`✅ TP2: ${r.tp2}`);
    lines.push(`🛑 SL: ${r.sl}`);
    if (r.summary) lines.push("", r.summary);
    r.reasons.forEach((reason) => lines.push(`• ${reason}`));
    return { title, content: lines.join("\n") };
  };

  const dexUrl = (t: Token) =>
    t.pairAddress
      ? `https://dexscreener.com/solana/${t.pairAddress}`
      : `https://dexscreener.com/solana/${t.contractAddress}`;
  const dexUrlBsc = (t: Token) =>
    t.pairAddress
      ? `https://dexscreener.com/bsc/${t.pairAddress}`
      : `https://dexscreener.com/bsc/${t.contractAddress}`;
  const bscScanUrl = (t: Token) => `https://bscscan.com/token/${t.contractAddress}`;
  const pumpFunUrl = (t: Token) => `https://pump.fun/coin/${t.contractAddress}`;
  const gmgnUrl = (t: Token) => `https://gmgn.ai/sol/token/${encodeURIComponent(t.contractAddress)}`;
  const maestroUrl = (t: Token) =>
    `https://t.me/maestro?start=${encodeURIComponent(t.contractAddress)}`;
  const ttfTelegramUrl = (t: Token) =>
    `https://t.me/ttf_sol_bot?start=${encodeURIComponent(t.contractAddress)}`;

  return (
    <div className="min-h-screen font-sans relative overflow-x-hidden">
      {/* Electric background */}
      <div
        className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,var(--nova-glow),transparent)] dark:bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,var(--nova-glow),transparent)]"
        aria-hidden
      />
      <div className="fixed inset-0 -z-10 bg-zinc-100 dark:bg-zinc-950" aria-hidden />
      <div
        className="fixed inset-0 -z-10 opacity-[0.4] dark:opacity-[0.06]"
        style={{
          backgroundImage: `linear-gradient(rgba(34,211,238,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.03) 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
        }}
        aria-hidden
      />

      <header className="sticky top-0 z-10 border-b border-zinc-200/80 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl shadow-sm dark:shadow-none">
        <div className="mx-auto max-w-6xl px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="flex flex-col min-w-0">
                <span
                  className="text-xl sm:text-3xl font-black tracking-tight bg-gradient-to-r from-cyan-400 via-violet-400 to-blue-500 bg-clip-text text-transparent bg-[length:200%_100%] drop-shadow-sm truncate"
                  style={{ animation: "nova-gradient-shift 6s ease infinite" }}
                >
                  NovaStaris
                </span>
                <span className="hidden sm:flex items-center gap-1.5 text-xs sm:text-sm font-semibold mt-0.5 tracking-wide bg-gradient-to-r from-amber-400 via-yellow-300 to-cyan-400 bg-clip-text text-transparent dark:from-amber-300 dark:via-yellow-200 dark:to-cyan-300">
                  <Zap className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400 shrink-0 animate-[nova-zap-pulse_2s_ease-in-out_infinite]" aria-hidden />
                  Your Advanced AI Lightning Crypto Sniper and Futures Intelligence
                </span>
              </h1>
            </div>
            <div className="flex items-center gap-2 shrink-0 md:hidden">
              <Button variant="outline" size="icon" className="h-11 w-11 border-zinc-200 dark:border-zinc-700" onClick={() => setMobileMenuOpen((v) => !v)} aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}>
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </div>
            <div className="hidden md:flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2" role="group" aria-label="Theme">
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 shrink-0">Theme</span>
              <div className="flex rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-800/50 p-0.5">
                {(["light", "dark", "system"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTheme(t)}
                    className={`rounded px-2.5 py-1.5 text-xs font-medium transition-all ${
                      !mounted ? "text-zinc-500 dark:text-zinc-400" : theme === t
                        ? "bg-cyan-500 text-white dark:bg-cyan-600 shadow-sm"
                        : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/80 dark:hover:bg-zinc-700/80"
                    }`}
                  >
                    {t === "light" ? "Light" : t === "dark" ? "Dark" : "System"}
                  </button>
                ))}
              </div>
            </div>
            <Button variant="outline" size="sm" asChild className="font-normal border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
              <Link href="/about">About</Link>
            </Button>
            <Button variant="outline" size="sm" asChild className="font-normal border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
              <Link href="/chat">Chat</Link>
            </Button>
            <Button variant="outline" size="sm" asChild className="font-normal border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
              <Link href="/support">Support</Link>
            </Button>
            {isOwner && (
              <Button variant="outline" size="sm" asChild className="font-normal border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
                <Link href="/status">Status</Link>
              </Button>
            )}
            {status !== "authenticated" && (
              <>
                <Button variant="outline" size="sm" asChild className="font-normal border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
                  <Link href="/register">Register</Link>
                </Button>
                <Button variant="outline" size="sm" asChild className="font-normal border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
                  <Link href="/signin">Sign in</Link>
                </Button>
              </>
            )}
            {status === "authenticated" && (
              <Button variant="outline" size="sm" asChild className="font-normal border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
                <Link href="/account">Account</Link>
              </Button>
            )}
            {status === "authenticated" && !isPaid && (
              <Button size="sm" asChild className="bg-amber-500 hover:bg-amber-600 text-white dark:bg-amber-600 dark:hover:bg-amber-700">
                <Link href="/subscribe">Upgrade to Pro</Link>
              </Button>
            )}
            {status === "authenticated" && isPaid && (
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded bg-emerald-50 dark:bg-emerald-950/50">{tier === "vip" ? "VIP" : "Pro"}</span>
            )}
            {status === "authenticated" && isOwner && (
              <>
                {presencePingOk === true && (
                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded bg-emerald-50 dark:bg-emerald-950/50" title="Visitors will see &quot;Live agent available&quot;">
                    Live: online
                  </span>
                )}
                {presencePingOk === false && (
                  <span className="text-xs font-medium text-amber-600 dark:text-amber-400 px-2 py-1 rounded bg-amber-50 dark:bg-amber-950/50" title="Set OWNER_EMAIL in Vercel to your sign-in email and redeploy.">
                    Live: not marked
                  </span>
                )}
                <div className="relative" ref={adminMenuRef}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); setAdminMenuOpen((v) => !v); }}
                    className="border-zinc-200 dark:border-zinc-700 inline-flex items-center gap-1"
                  >
                    Nova Admin
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${adminMenuOpen ? "rotate-180" : ""}`} />
                  </Button>
                  {adminMenuOpen && (
                    <div className="absolute top-full left-0 mt-1 z-50 min-w-[200px] rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg py-1">
                      <Link href="/admin" onClick={() => setAdminMenuOpen(false)} className="block px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800">Nova Admin hub</Link>
                      <Link href="/admin/insights" onClick={() => setAdminMenuOpen(false)} className="block px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800">App insights</Link>
                      <Link href="/admin/metrics" onClick={() => setAdminMenuOpen(false)} className="block px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800">Metrics</Link>
                      <Link href="/admin/customers" onClick={() => setAdminMenuOpen(false)} className="block px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800">Customers</Link>
                      <Link href="/admin/wallet-tracker" onClick={() => setAdminMenuOpen(false)} className="block px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800">Wallet Tracker</Link>
                      <Link href="/admin/leverage-wallet-tracker" onClick={() => setAdminMenuOpen(false)} className="block px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800">Leverage Wallet Tracker</Link>
                      <Link href="/admin/feature-flags" onClick={() => setAdminMenuOpen(false)} className="block px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800">Feature flags</Link>
                      <Link href="/admin/support" onClick={() => setAdminMenuOpen(false)} className="block px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800">Support tickets</Link>
                      <Link href="/admin/chat" onClick={() => setAdminMenuOpen(false)} className="block px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800">Live chat</Link>
                      <Link href="/admin/ai-feedback" onClick={() => setAdminMenuOpen(false)} className="block px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800">AI Feedback</Link>
                    </div>
                  )}
                </div>
              </>
            )}
            {status === "authenticated" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (isOwner) {
                    fetch("/api/chat/presence", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ offline: true }) }).finally(() => signOut());
                  } else {
                    signOut();
                  }
                }}
                className="border-zinc-200 dark:border-zinc-700"
              >
                Log out
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchTokens()}
              disabled={loading}
              className="border-zinc-200 dark:border-zinc-700 hover:border-cyan-400/50 dark:hover:border-cyan-500/50 hover:bg-cyan-50/50 dark:hover:bg-cyan-950/30 transition-colors"
            >
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => runScan("scan")}
              disabled={scanning !== "idle"}
              className="bg-gradient-to-r from-cyan-500 via-violet-500 to-blue-600 text-white border-0 hover:opacity-95 hover:shadow-lg hover:shadow-cyan-500/25 dark:shadow-cyan-500/15 transition-all"
            >
              {scanning === "scan" ? "Scanning…" : "Scan new pairs"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => runScan("twitter")}
              disabled={scanning !== "idle" || !canAccessCtScanEffective}
              className="bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700"
            >
              {scanning === "twitter" ? "Scanning CT…" : "Scan Twitter"}
            </Button>
            </div>
          </div>
          {mobileMenuOpen && (
            <div className="md:hidden mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800 flex flex-col gap-1 max-h-[70vh] overflow-y-auto">
              <div className="flex items-center gap-2 py-2 min-h-[44px]" role="group" aria-label="Theme">
                <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400 shrink-0">Theme</span>
                <div className="flex rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-800/50 p-0.5">
                  {(["light", "dark", "system"] as const).map((t) => (
                    <button key={t} type="button" onClick={() => setTheme(t)} className={`rounded px-3 py-2 text-sm font-medium transition-all min-h-[40px] ${!mounted ? "text-zinc-500" : theme === t ? "bg-cyan-500 text-white dark:bg-cyan-600" : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/80 dark:hover:bg-zinc-700/80"}`}>
                      {t === "light" ? "Light" : t === "dark" ? "Dark" : "System"}
                    </button>
                  ))}
                </div>
              </div>
              <Button variant="outline" size="sm" asChild className="justify-start h-12 font-normal border-zinc-200 dark:border-zinc-700">
                <Link href="/about" onClick={() => setMobileMenuOpen(false)}>About</Link>
              </Button>
              <Button variant="outline" size="sm" asChild className="justify-start h-12 font-normal border-zinc-200 dark:border-zinc-700">
                <Link href="/chat" onClick={() => setMobileMenuOpen(false)}>Chat</Link>
              </Button>
              <Button variant="outline" size="sm" asChild className="justify-start h-12 font-normal border-zinc-200 dark:border-zinc-700">
                <Link href="/support" onClick={() => setMobileMenuOpen(false)}>Support</Link>
              </Button>
              {isOwner && (
                <Button variant="outline" size="sm" asChild className="justify-start h-12 font-normal border-zinc-200 dark:border-zinc-700">
                  <Link href="/status" onClick={() => setMobileMenuOpen(false)}>Status</Link>
                </Button>
              )}
              {status !== "authenticated" && (
                <>
                  <Button variant="outline" size="sm" asChild className="justify-start h-12 font-normal border-zinc-200 dark:border-zinc-700">
                    <Link href="/register" onClick={() => setMobileMenuOpen(false)}>Register</Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild className="justify-start h-12 font-normal border-zinc-200 dark:border-zinc-700">
                    <Link href="/signin" onClick={() => setMobileMenuOpen(false)}>Sign in</Link>
                  </Button>
                </>
              )}
              {status === "authenticated" && (
                <Button variant="outline" size="sm" asChild className="justify-start h-12 font-normal border-zinc-200 dark:border-zinc-700">
                  <Link href="/account" onClick={() => setMobileMenuOpen(false)}>Account</Link>
                </Button>
              )}
              {status === "authenticated" && !isPaid && (
                <Button size="sm" asChild className="justify-start h-12 bg-amber-500 hover:bg-amber-600 text-white">
                  <Link href="/subscribe" onClick={() => setMobileMenuOpen(false)}>Upgrade to Pro</Link>
                </Button>
              )}
              {status === "authenticated" && isPaid && (
                <div className="py-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">{tier === "vip" ? "VIP" : "Pro"}</div>
              )}
              {status === "authenticated" && isOwner && (
                <Button variant="outline" size="sm" asChild className="justify-start h-12 font-normal border-zinc-200 dark:border-zinc-700">
                  <Link href="/admin" onClick={() => setMobileMenuOpen(false)}>Nova Admin</Link>
                </Button>
              )}
              {status === "authenticated" && (
                <Button variant="outline" size="sm" className="justify-start h-12 border-zinc-200 dark:border-zinc-700" onClick={() => { setMobileMenuOpen(false); if (isOwner) fetch("/api/chat/presence", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ offline: true }) }).finally(() => signOut()); else signOut(); }}>
                  Log out
                </Button>
              )}
              <Button variant="outline" size="sm" className="justify-start h-12 border-zinc-200 dark:border-zinc-700" onClick={() => { setMobileMenuOpen(false); fetchTokens(); }}>
                Refresh
              </Button>
              <Button size="sm" className="justify-start h-12 bg-gradient-to-r from-cyan-500 via-violet-500 to-blue-600 text-white" onClick={() => { setMobileMenuOpen(false); runScan("scan"); }} disabled={scanning !== "idle"}>
                {scanning === "scan" ? "Scanning…" : "Scan new pairs"}
              </Button>
              <Button variant="secondary" size="sm" className="justify-start h-12 bg-zinc-100 dark:bg-zinc-800" onClick={() => { setMobileMenuOpen(false); runScan("twitter"); }} disabled={scanning !== "idle" || !canAccessCtScanEffective}>
                {scanning === "twitter" ? "Scanning CT…" : "Scan Twitter"}
              </Button>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-3 sm:px-4 py-4 sm:py-8 pb-20 sm:pb-8">
        {mounted && !onboardingDismissed && (
          <div className="mb-6 rounded-xl border border-cyan-200/80 dark:border-cyan-800/80 bg-cyan-50/90 dark:bg-cyan-950/40 px-4 py-3 text-sm text-cyan-800 dark:text-cyan-200 shadow-sm flex items-center justify-between gap-3 flex-wrap">
            <span><strong>New here?</strong> Start with <strong>Go Hunting</strong> or <strong>Trending</strong>, then use <strong>NovaStaris AI Agent</strong> on tokens you like.</span>
            <Button variant="ghost" size="sm" onClick={dismissOnboarding} className="shrink-0 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-200/50 dark:hover:bg-cyan-800/50">Dismiss</Button>
          </div>
        )}
        {error && (
          <div className="mb-6 rounded-xl border border-amber-200/80 dark:border-amber-800/80 bg-amber-50/90 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-800 dark:text-amber-200 shadow-sm flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="flex-1">{error}</span>
            <span className="flex gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={() => { setError(null); fetchTokens(activeTab); }} className="border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200">Retry</Button>
              <Link href="/support"><Button variant="ghost" size="sm" className="text-amber-800 dark:text-amber-200">Report issue</Button></Link>
            </span>
          </div>
        )}
        {isOwner && (
          <div className="mb-6 flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={testDexScreener}
              className="border-zinc-200 dark:border-zinc-700 hover:border-cyan-400/50 dark:hover:border-cyan-500/50"
            >
              Test DexScreener
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={testMoralis}
              className="border-zinc-200 dark:border-zinc-700 hover:border-cyan-400/50 dark:hover:border-cyan-500/50"
            >
              Test Moralis
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={testTwitter}
              className="border-zinc-200 dark:border-zinc-700 hover:border-cyan-400/50 dark:hover:border-cyan-500/50"
            >
              Test Twitter Scan
            </Button>
          </div>
        )}
        {isOwner && dexTest && (
          <div
            className={`mb-6 rounded-xl border px-4 py-3 text-sm shadow-sm ${
              dexTest.ok
                ? "border-emerald-200/80 dark:border-emerald-800/80 bg-emerald-50/90 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200"
                : "border-red-200/80 dark:border-red-800/80 bg-red-50/90 dark:bg-red-950/40 text-red-800 dark:text-red-200"
            }`}
          >
            <strong>DexScreener:</strong> {dexTest.message}
            {dexTest.ok && (
              <span className="ml-2">
                — Go Hunting (new pairs): {dexTest.newPairs ?? "—"}, Trending: {dexTest.trending ?? "—"}
                {dexTest.sample && ` · Sample: ${dexTest.sample}`}
              </span>
            )}
          </div>
        )}
        {moralisTest && (
          <div
            className={`mb-6 rounded-xl border px-4 py-3 text-sm shadow-sm ${
              moralisTest.ok
                ? "border-emerald-200/80 dark:border-emerald-800/80 bg-emerald-50/90 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200"
                : "border-red-200/80 dark:border-red-800/80 bg-red-50/90 dark:bg-red-950/40 text-red-800 dark:text-red-200"
            }`}
          >
            <strong>Moralis (Pump.fun):</strong> {moralisTest.message}
            {moralisTest.count !== undefined && (
              <span className="ml-2">— New tokens: {moralisTest.count}</span>
            )}
          </div>
        )}
        {isOwner && twitterTest && (
          <div
            className={`mb-6 rounded-xl border px-4 py-3 text-sm shadow-sm ${
              twitterTest.ok
                ? "border-emerald-200/80 dark:border-emerald-800/80 bg-emerald-50/90 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200"
                : "border-red-200/80 dark:border-red-800/80 bg-red-50/90 dark:bg-red-950/40 text-red-800 dark:text-red-200"
            }`}
          >
            <strong>Twitter scan:</strong> {twitterTest.message}
          </div>
        )}

        <Card className="rounded-2xl border-zinc-200/90 dark:border-zinc-800/90 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm shadow-lg dark:shadow-none dark:shadow-[0_0_0_1px_rgba(34,211,238,0.06)] overflow-hidden">
          <CardHeader className="pb-3 border-b border-zinc-200/80 dark:border-zinc-800/80">
            <CardTitle className="text-lg font-bold bg-gradient-to-r from-zinc-900 to-zinc-700 dark:from-zinc-100 dark:to-zinc-300 bg-clip-text text-transparent">
              Tokens by viral score
            </CardTitle>
            <p className="text-muted-foreground text-sm mt-1 leading-relaxed">
              Higher score = better liquidity, security & socials. <strong className="text-cyan-600 dark:text-cyan-400">40+</strong> = high confidence · <strong>30–39</strong> = watch · <strong>20–29</strong> = risky · <strong>15–19</strong> = very new (Pump.fun).
            </p>
            <details className="mt-3 text-xs text-muted-foreground">
              <summary className="cursor-pointer font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200">How it works</summary>
              <ul className="mt-2 list-inside list-disc space-y-1 pl-1">
                <li><strong>Go Hunting</strong> = Newest pairs (last 2h, or newest available) / Final Stretch / Migrated from DexScreener + Birdeye. Each refresh shuffles order for variety. <strong>Trending</strong> = live by 24h volume + price change. <strong>Surge</strong> = high volume in 5m–24h window. <strong>Transactions</strong> = buys vs sells (24h), sorted by activity.</li>
                <li><strong>CT Scan</strong>: Spot coins going viral from smart money and influencer buzz before the crowd.</li>
                <li><strong>NovaStaris AI Agent</strong>: Paste a token contract address; NovaStaris AI scores it 0–100, gives a buy/no-buy signal, and explains why.</li>
                <li><strong>Crypto Futures</strong>: <strong>NovaStaris AI Chart Analysis</strong> — upload a chart, set margin, leverage & timeframes; get AI support/resistance, entry zone, take profit & stop loss. <strong>Institutional Workflow</strong> — 4-phase system (macro bias, daily flow, pre-trade, execution) with free tools and rules for leverage trading.</li>
                <li><strong>Narratives</strong> (Pro/VIP): Global trends, US trends, trending memes, and trending meme coins—with links to sources and a checklist to spot narrative-driven plays (e.g. when a story like “aliens” breaks, coins follow).</li>
                <li><strong>Wallet Tracker</strong>: Get alerted when tracked wallets pile into the same token—so you can move with the flow.</li>
                <li><strong>Coach Calls + Telegram Signals</strong> (VIP): Exclusive CA from the team, displayed in-app and sent to our Telegram Call channel. VIP members add their Telegram ID (one per user) to get signals there.</li>
              </ul>
            </details>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabId)} className="mt-4">
              <TabsList className="bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700/80 flex-nowrap md:flex-wrap h-auto gap-2 p-2 rounded-lg overflow-x-auto overflow-y-hidden md:overflow-visible -mx-1 sm:mx-0 [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5">
                {isTabVisibleInGui("new") && (
                  <TabsTrigger value="new" className="rounded-md border border-zinc-200 dark:border-zinc-600 px-3 py-2.5 sm:py-1.5 min-h-[44px] sm:min-h-0 text-sm font-medium shrink-0 data-[state=inactive]:bg-white/70 data-[state=inactive]:text-zinc-700 dark:data-[state=inactive]:bg-zinc-700/70 dark:data-[state=inactive]:text-zinc-200 data-[state=inactive]:hover:bg-zinc-200/80 dark:data-[state=inactive]:hover:bg-zinc-600/80 data-[state=active]:border-transparent data-[state=active]:bg-cyan-500 data-[state=active]:text-white dark:data-[state=active]:bg-cyan-600">Go Hunting</TabsTrigger>
                )}
                {isTabVisibleInGui("trending") && (
                  <TabsTrigger value="trending" className="rounded-md border border-zinc-200 dark:border-zinc-600 px-3 py-2.5 sm:py-1.5 min-h-[44px] sm:min-h-0 text-sm font-medium shrink-0 data-[state=inactive]:bg-white/70 data-[state=inactive]:text-zinc-700 dark:data-[state=inactive]:bg-zinc-700/70 dark:data-[state=inactive]:text-zinc-200 data-[state=inactive]:hover:bg-zinc-200/80 dark:data-[state=inactive]:hover:bg-zinc-600/80 data-[state=active]:border-transparent data-[state=active]:bg-cyan-500 data-[state=active]:text-white dark:data-[state=active]:bg-cyan-600">Trending</TabsTrigger>
                )}
                {isTabVisibleInGui("surge") && (
                  <TabsTrigger value="surge" className="rounded-md border border-zinc-200 dark:border-zinc-600 px-3 py-2.5 sm:py-1.5 min-h-[44px] sm:min-h-0 text-sm font-medium shrink-0 data-[state=inactive]:bg-white/70 data-[state=inactive]:text-zinc-700 dark:data-[state=inactive]:bg-zinc-700/70 dark:data-[state=inactive]:text-zinc-200 data-[state=inactive]:hover:bg-zinc-200/80 dark:data-[state=inactive]:hover:bg-zinc-600/80 data-[state=active]:border-transparent data-[state=active]:bg-cyan-500 data-[state=active]:text-white dark:data-[state=active]:bg-cyan-600">Surge</TabsTrigger>
                )}
                {isTabVisibleInGui("transactions") && (
                  <TabsTrigger value="transactions" className="rounded-md border border-zinc-200 dark:border-zinc-600 px-3 py-2.5 sm:py-1.5 min-h-[44px] sm:min-h-0 text-sm font-medium shrink-0 data-[state=inactive]:bg-white/70 data-[state=inactive]:text-zinc-700 dark:data-[state=inactive]:bg-zinc-700/70 dark:data-[state=inactive]:text-zinc-200 data-[state=inactive]:hover:bg-zinc-200/80 dark:data-[state=inactive]:hover:bg-zinc-600/80 data-[state=active]:border-transparent data-[state=active]:bg-cyan-500 data-[state=active]:text-white dark:data-[state=active]:bg-cyan-600">Transactions</TabsTrigger>
                )}
                {isTabVisibleInGui("ai-analysis") && (
                  <TabsTrigger value="ai-analysis" className="rounded-md border border-zinc-200 dark:border-zinc-600 px-3 py-2.5 sm:py-1.5 min-h-[44px] sm:min-h-0 text-sm font-medium shrink-0 data-[state=inactive]:bg-white/70 data-[state=inactive]:text-zinc-700 dark:data-[state=inactive]:bg-zinc-700/70 dark:data-[state=inactive]:text-zinc-200 data-[state=inactive]:hover:bg-zinc-200/80 dark:data-[state=inactive]:hover:bg-zinc-600/80 data-[state=active]:border-transparent data-[state=active]:bg-cyan-500 data-[state=active]:text-white dark:data-[state=active]:bg-cyan-600"><Flame className="inline-block h-5 w-5 flame-hot-tab mr-1.5 -mt-0.5 animate-flame-flicker shrink-0" aria-hidden />NovaStaris AI Agent</TabsTrigger>
                )}
                {isTabVisibleInGui("futures") && (
                  <TabsTrigger value="futures" className="rounded-md border border-zinc-200 dark:border-zinc-600 px-3 py-2.5 sm:py-1.5 min-h-[44px] sm:min-h-0 text-sm font-medium shrink-0 data-[state=inactive]:bg-white/70 data-[state=inactive]:text-zinc-700 dark:data-[state=inactive]:bg-zinc-700/70 dark:data-[state=inactive]:text-zinc-200 data-[state=inactive]:hover:bg-zinc-200/80 dark:data-[state=inactive]:hover:bg-zinc-600/80 data-[state=active]:border-transparent data-[state=active]:bg-cyan-500 data-[state=active]:text-white dark:data-[state=active]:bg-cyan-600"><Flame className="inline-block h-5 w-5 flame-hot-tab mr-1.5 -mt-0.5 animate-flame-flicker shrink-0" aria-hidden />Crypto Futures</TabsTrigger>
                )}
                {isTabVisibleInGui("trending-perps") && (
                  <TabsTrigger value="trending-perps" className="rounded-md border border-zinc-200 dark:border-zinc-600 px-3 py-2.5 sm:py-1.5 min-h-[44px] sm:min-h-0 text-sm font-medium shrink-0 data-[state=inactive]:bg-white/70 data-[state=inactive]:text-zinc-700 dark:data-[state=inactive]:bg-zinc-700/70 dark:data-[state=inactive]:text-zinc-200 data-[state=inactive]:hover:bg-zinc-200/80 dark:data-[state=inactive]:hover:bg-zinc-600/80 data-[state=active]:border-transparent data-[state=active]:bg-cyan-500 data-[state=active]:text-white dark:data-[state=active]:bg-cyan-600"><Flame className="inline-block h-5 w-5 flame-hot-tab mr-1.5 -mt-0.5 animate-flame-flicker shrink-0" aria-hidden />Trending perps</TabsTrigger>
                )}
                {isTabVisibleInGui("perp-radar") && (
                  <TabsTrigger value="perp-radar" className="rounded-md border border-zinc-200 dark:border-zinc-600 px-3 py-2.5 sm:py-1.5 min-h-[44px] sm:min-h-0 text-sm font-medium shrink-0 data-[state=inactive]:bg-white/70 data-[state=inactive]:text-zinc-700 dark:data-[state=inactive]:bg-zinc-700/70 dark:data-[state=inactive]:text-zinc-200 data-[state=inactive]:hover:bg-zinc-200/80 dark:data-[state=inactive]:hover:bg-zinc-600/80 data-[state=active]:border-transparent data-[state=active]:bg-cyan-500 data-[state=active]:text-white dark:data-[state=active]:bg-cyan-600"><Flame className="inline-block h-5 w-5 flame-hot-tab mr-1.5 -mt-0.5 animate-flame-flicker shrink-0" aria-hidden />Perp Radar</TabsTrigger>
                )}
                {isTabVisibleInGui("narratives") && (
                  <TabsTrigger value="narratives" className="rounded-md border border-zinc-200 dark:border-zinc-600 px-3 py-2.5 sm:py-1.5 min-h-[44px] sm:min-h-0 text-sm font-medium shrink-0 data-[state=inactive]:bg-white/70 data-[state=inactive]:text-zinc-700 dark:data-[state=inactive]:bg-zinc-700/70 dark:data-[state=inactive]:text-zinc-200 data-[state=inactive]:hover:bg-zinc-200/80 dark:data-[state=inactive]:hover:bg-zinc-600/80 data-[state=active]:border-transparent data-[state=active]:bg-cyan-500 data-[state=active]:text-white dark:data-[state=active]:bg-cyan-600">Narratives</TabsTrigger>
                )}
                {isTabVisibleInGui("trading-bot") && (
                  <TabsTrigger value="trading-bot" className="rounded-md border border-zinc-200 dark:border-zinc-600 px-3 py-2.5 sm:py-1.5 min-h-[44px] sm:min-h-0 text-sm font-medium shrink-0 data-[state=inactive]:bg-white/70 data-[state=inactive]:text-zinc-700 dark:data-[state=inactive]:bg-zinc-700/70 dark:data-[state=inactive]:text-zinc-200 data-[state=inactive]:hover:bg-zinc-200/80 dark:data-[state=inactive]:hover:bg-zinc-600/80 data-[state=active]:border-transparent data-[state=active]:bg-cyan-500 data-[state=active]:text-white dark:data-[state=active]:bg-cyan-600"><Flame className="inline-block h-5 w-5 flame-hot-tab mr-1.5 -mt-0.5 animate-flame-flicker shrink-0" aria-hidden />NovaStaris AI Trading Bots</TabsTrigger>
                )}
                {isTabVisibleInGui("trading-bot") && (
                  <TabsTrigger value="polymarket-bot" className="rounded-md border border-zinc-200 dark:border-zinc-600 px-3 py-2.5 sm:py-1.5 min-h-[44px] sm:min-h-0 text-sm font-medium shrink-0 data-[state=inactive]:bg-white/70 data-[state=inactive]:text-zinc-700 dark:data-[state=inactive]:bg-zinc-700/70 dark:data-[state=inactive]:text-zinc-200 data-[state=inactive]:hover:bg-zinc-200/80 dark:data-[state=inactive]:hover:bg-zinc-600/80 data-[state=active]:border-transparent data-[state=active]:bg-cyan-500 data-[state=active]:text-white dark:data-[state=active]:bg-cyan-600"><Flame className="inline-block h-5 w-5 flame-hot-tab mr-1.5 -mt-0.5 animate-flame-flicker shrink-0" aria-hidden />Nova Polymarket Bot</TabsTrigger>
                )}
                {isTabVisibleInGui("trading-bot") && isVip && (
                  <TabsTrigger value="prop-firm-bot" className="rounded-md border border-zinc-200 dark:border-zinc-600 px-3 py-2.5 sm:py-1.5 min-h-[44px] sm:min-h-0 text-sm font-medium shrink-0 data-[state=inactive]:bg-white/70 data-[state=inactive]:text-zinc-700 dark:data-[state=inactive]:bg-zinc-700/70 dark:data-[state=inactive]:text-zinc-200 data-[state=inactive]:hover:bg-zinc-200/80 dark:data-[state=inactive]:hover:bg-zinc-600/80 data-[state=active]:border-transparent data-[state=active]:bg-cyan-500 data-[state=active]:text-white dark:data-[state=active]:bg-cyan-600"><Flame className="inline-block h-5 w-5 flame-hot-tab mr-1.5 -mt-0.5 animate-flame-flicker shrink-0" aria-hidden />Nova Prop Firm Bot</TabsTrigger>
                )}
                {isTabVisibleInGui("ct") && (
                  <TabsTrigger value="ct" className="rounded-md border border-zinc-200 dark:border-zinc-600 px-3 py-2.5 sm:py-1.5 min-h-[44px] sm:min-h-0 text-sm font-medium shrink-0 data-[state=inactive]:bg-white/70 data-[state=inactive]:text-zinc-700 dark:data-[state=inactive]:bg-zinc-700/70 dark:data-[state=inactive]:text-zinc-200 data-[state=inactive]:hover:bg-zinc-200/80 dark:data-[state=inactive]:hover:bg-zinc-600/80 data-[state=active]:border-transparent data-[state=active]:bg-cyan-500 data-[state=active]:text-white dark:data-[state=active]:bg-cyan-600">CT Scan</TabsTrigger>
                )}
                {isTabVisibleInGui("wallets") && (
                  <TabsTrigger value="wallets" className="rounded-md border border-zinc-200 dark:border-zinc-600 px-3 py-2.5 sm:py-1.5 min-h-[44px] sm:min-h-0 text-sm font-medium shrink-0 data-[state=inactive]:bg-white/70 data-[state=inactive]:text-zinc-700 dark:data-[state=inactive]:bg-zinc-700/70 dark:data-[state=inactive]:text-zinc-200 data-[state=inactive]:hover:bg-zinc-200/80 dark:data-[state=inactive]:hover:bg-zinc-600/80 data-[state=active]:border-transparent data-[state=active]:bg-cyan-500 data-[state=active]:text-white dark:data-[state=active]:bg-cyan-600"><Flame className="inline-block h-5 w-5 flame-hot-tab mr-1.5 -mt-0.5 animate-flame-flicker shrink-0" aria-hidden />Wallet Tracker</TabsTrigger>
                )}
                {isTabVisibleInGui("coach-calls") && (
                  <TabsTrigger value="coach-calls" className="rounded-md border border-zinc-200 dark:border-zinc-600 px-3 py-2.5 sm:py-1.5 min-h-[44px] sm:min-h-0 text-sm font-medium shrink-0 data-[state=inactive]:bg-white/70 data-[state=inactive]:text-zinc-700 dark:data-[state=inactive]:bg-zinc-700/70 dark:data-[state=inactive]:text-zinc-200 data-[state=inactive]:hover:bg-zinc-200/80 dark:data-[state=inactive]:hover:bg-zinc-600/80 data-[state=active]:border-transparent data-[state=active]:bg-cyan-500 data-[state=active]:text-white dark:data-[state=active]:bg-cyan-600"><Flame className="inline-block h-5 w-5 flame-hot-tab mr-1.5 -mt-0.5 animate-flame-flicker shrink-0" aria-hidden />Coach Calls + Telegram Signals</TabsTrigger>
                )}
                {isTabVisibleInGui("nova-forecast") && (
                  <TabsTrigger value="nova-forecast" className="rounded-md border border-zinc-200 dark:border-zinc-600 px-3 py-2.5 sm:py-1.5 min-h-[44px] sm:min-h-0 text-sm font-medium shrink-0 data-[state=inactive]:bg-white/70 data-[state=inactive]:text-zinc-700 dark:data-[state=inactive]:bg-zinc-700/70 dark:data-[state=inactive]:text-zinc-200 data-[state=inactive]:hover:bg-zinc-200/80 dark:data-[state=inactive]:hover:bg-zinc-600/80 data-[state=active]:border-transparent data-[state=active]:bg-violet-500 data-[state=active]:text-white dark:data-[state=active]:bg-violet-600"><Flame className="inline-block h-5 w-5 flame-hot-tab mr-1.5 -mt-0.5 animate-flame-flicker shrink-0" aria-hidden />NovaForecast Agent</TabsTrigger>
                )}
                {isTabVisibleInGui("nova-plus") && (
                  <TabsTrigger value="nova-plus" className="rounded-md border border-zinc-200 dark:border-zinc-600 px-3 py-2.5 sm:py-1.5 min-h-[44px] sm:min-h-0 text-sm font-medium shrink-0 data-[state=inactive]:bg-white/70 data-[state=inactive]:text-zinc-700 dark:data-[state=inactive]:bg-zinc-700/70 dark:data-[state=inactive]:text-zinc-200 data-[state=inactive]:hover:bg-zinc-200/80 dark:data-[state=inactive]:hover:bg-zinc-600/80 data-[state=active]:border-transparent data-[state=active]:bg-violet-500 data-[state=active]:text-white dark:data-[state=active]:bg-violet-600"><Flame className="inline-block h-5 w-5 flame-hot-tab mr-1.5 -mt-0.5 animate-flame-flicker shrink-0" aria-hidden />Nova+</TabsTrigger>
                )}
                {isTabVisibleInGui("nova-investment") && (
                  <TabsTrigger value="nova-investment" className="rounded-md border border-zinc-200 dark:border-zinc-600 px-3 py-2.5 sm:py-1.5 min-h-[44px] sm:min-h-0 text-sm font-medium shrink-0 data-[state=inactive]:bg-white/70 data-[state=inactive]:text-zinc-700 dark:data-[state=inactive]:bg-zinc-700/70 dark:data-[state=inactive]:text-zinc-200 data-[state=inactive]:hover:bg-zinc-200/80 dark:data-[state=inactive]:hover:bg-zinc-600/80 data-[state=active]:border-transparent data-[state=active]:bg-violet-500 data-[state=active]:text-white dark:data-[state=active]:bg-violet-600">Nova Investment Agent</TabsTrigger>
                )}
                {isTabVisibleInGui("bsc") && (
                  <TabsTrigger value="bsc" className="rounded-md border border-zinc-200 dark:border-zinc-600 px-3 py-2.5 sm:py-1.5 min-h-[44px] sm:min-h-0 text-sm font-medium shrink-0 data-[state=inactive]:bg-white/70 data-[state=inactive]:text-zinc-700 dark:data-[state=inactive]:bg-zinc-700/70 dark:data-[state=inactive]:text-zinc-200 data-[state=inactive]:hover:bg-zinc-200/80 dark:data-[state=inactive]:hover:bg-zinc-600/80 data-[state=active]:border-transparent data-[state=active]:bg-cyan-500 data-[state=active]:text-white dark:data-[state=active]:bg-cyan-600">BSC</TabsTrigger>
                )}
                {isTabVisibleInGui("watchlist") && (
                  <TabsTrigger value="watchlist" className="rounded-md border border-zinc-200 dark:border-zinc-600 px-3 py-2.5 sm:py-1.5 min-h-[44px] sm:min-h-0 text-sm font-medium shrink-0 data-[state=inactive]:bg-white/70 data-[state=inactive]:text-zinc-700 dark:data-[state=inactive]:bg-zinc-700/70 dark:data-[state=inactive]:text-zinc-200 data-[state=inactive]:hover:bg-zinc-200/80 dark:data-[state=inactive]:hover:bg-zinc-600/80 data-[state=active]:border-transparent data-[state=active]:bg-cyan-500 data-[state=active]:text-white dark:data-[state=active]:bg-cyan-600">Watchlist {watchlist.length > 0 ? `(${watchlist.length})` : ""}</TabsTrigger>
                )}
                {isTabVisibleInGui("nova-connect") && (
                  <TabsTrigger
                    value="nova-connect"
                    className="rounded-md border border-zinc-200 dark:border-zinc-600 px-3 py-2.5 sm:py-1.5 min-h-[44px] sm:min-h-0 text-sm font-medium shrink-0 data-[state=inactive]:bg-white/70 data-[state=inactive]:text-zinc-700 dark:data-[state=inactive]:bg-zinc-700/70 dark:data-[state=inactive]:text-zinc-200 data-[state=inactive]:hover:bg-zinc-200/80 dark:data-[state=inactive]:hover:bg-zinc-600/80 data-[state=active]:border-transparent data-[state=active]:bg-emerald-500 data-[state=active]:text-white dark:data-[state=active]:bg-emerald-600 flex items-center gap-1"
                  >
                    <span>NovaConnect</span>
                    {novaConnectHasUnreadDm && (
                      <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400 dark:bg-emerald-300" aria-hidden />
                    )}
                  </TabsTrigger>
                )}
                {isTabVisibleInGui("chris-clayton") && (
                  <TabsTrigger value="chris-clayton" className="rounded-md border border-zinc-200 dark:border-zinc-600 px-3 py-2.5 sm:py-1.5 min-h-[44px] sm:min-h-0 text-sm font-medium shrink-0 data-[state=inactive]:bg-white/70 data-[state=inactive]:text-zinc-700 dark:data-[state=inactive]:bg-zinc-700/70 dark:data-[state=inactive]:text-zinc-200 data-[state=inactive]:hover:bg-zinc-200/80 dark:data-[state=inactive]:hover:bg-zinc-600/80 data-[state=active]:border-transparent data-[state=active]:bg-amber-500 data-[state=active]:text-white dark:data-[state=active]:bg-amber-600">Online Boss Strategy</TabsTrigger>
                )}
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="p-0">
            {(onDemandLocked || ((VIP_ONLY_TABS.includes(activeTab) && !isVip) || (PAID_TABS.includes(activeTab) && (activeTab === "nova-connect" ? !canUseNovaConnectPaidFeatures : !isPaid)))) ? (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <p className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
                  {onDemandLocked ? "On-demand access required" : VIP_ONLY_TABS.includes(activeTab) && !isVip ? "VIP required" : "Subscribe for access"}
                </p>
                <p className="mt-2 text-sm text-muted-foreground max-w-md">
                  {activeTab === "surge" && "Surge shows tokens with high volume in 5m–24h windows."}
                  {activeTab === "transactions" && "Transactions shows buys vs sells (24h) and activity."}
                  {activeTab === "ai-analysis" && "NovaStaris AI Agent scores any token 0–100 and gives a buy/no-buy signal."}
                  {activeTab === "futures" && "Upload a chart and get AI support/resistance, entry zone, take profit & stop loss for futures."}
                  {activeTab === "trending-perps" && "See the biggest perp movers in one place—5m, 15m, 30m, 1h, and 24h—so you can spot what’s moving fast."}
                  {activeTab === "perp-radar" && "Spot the biggest perp movers across exchanges—before they peak."}
                  {activeTab === "narratives" && "Narratives: global trends, US trends, trending memes and meme coins—sources and checklist to spot narrative-driven plays."}
                  {activeTab === "ct" &&
                    (canAccessCtScanEffective
                      ? "CT Scan (Twitter tracker) surfaces coins when smart money and influencers are talking about them."
                      : "CT Scan is VIP on-demand. Request access and an admin will enable it for your account.")}
                  {activeTab === "wallets" &&
                    (walletTrackerView === "meme" && !canAccessMemeCoinsTraderEffective
                      ? "Mem Coins Traders (Wallet Tracker → Meme) is VIP on-demand. Request access and an admin will enable it for your account."
                      : "Wallet Tracker: Meme Coins Traders and Top Leverage Traders. Add your own wallets.")}
                  {activeTab === "coach-calls" && "Coach Calls + Telegram Signals: exclusive CA (call alerts) from the team, in-app and via Telegram. VIP only."}
                  {activeTab === "nova-plus" && "Nova+ provides risk-managed trade analysis with a recommended stop loss, take-profit target, and position sizing guidance. VIP only."}
                  {activeTab === "nova-investment" && "Nova Investment Agent builds leverage strategies from your amount, risk preset, and duration (support/resistance + direction, leverage, stop loss, entry/exit). VIP only."}
                  {activeTab === "nova-connect" && "NovaConnect: the first social platform for crypto traders. See community rules, your NovaConnect status, and community feed and chat."}
                  {" "}
                  {onDemandLocked
                    ? "Contact support to request access (enabled manually by admin)."
                    : VIP_ONLY_TABS.includes(activeTab) && !isVip
                      ? "Upgrade to VIP to use this feature."
                      : activeTab === "nova-connect"
                        ? "Upgrade to Pro or VIP, or ask an admin to allow NovaConnect for you."
                        : "Upgrade to Pro or VIP to use this feature."}
                </p>
                <Button asChild className="mt-6 bg-amber-500 hover:bg-amber-600 text-white dark:bg-amber-600 dark:hover:bg-amber-700">
                  <Link
                    href={
                      onDemandLocked
                        ? activeTab === "ct"
                          ? "/support?subject=CT%20Scan%20access%20request"
                          : "/support?subject=Mem%20Coins%20Trader%20access%20request"
                        : "/subscribe"
                    }
                  >
                    {onDemandLocked ? "Contact for access" : VIP_ONLY_TABS.includes(activeTab) && !isVip ? "Upgrade to VIP" : "Subscribe to Pro"}
                  </Link>
                </Button>
              </div>
            ) : (
              <>
            {activeTab === "new" && (
              <div className="mx-3 sm:mx-6 mt-4 mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200/80 dark:border-zinc-700/80 bg-zinc-50/80 dark:bg-zinc-800/50 p-3">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">View:</span>
                {(["new_pairs", "final_stretch", "migrated"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setGoHuntingView(v)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      goHuntingView === v
                        ? "bg-cyan-500 text-white dark:bg-cyan-600"
                        : "bg-zinc-200/80 dark:bg-zinc-700/80 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300/80 dark:hover:bg-zinc-600/80"
                    }`}
                  >
                    {v === "new_pairs" ? "New pairs" : v === "final_stretch" ? "Final Stretch" : "Migrated"}
                  </button>
                ))}
                <span className="text-xs text-muted-foreground ml-1">
                  {goHuntingView === "new_pairs" && "All new pairs (last 60m — meme coins move fast)."}
                  {goHuntingView === "final_stretch" && "Pump.fun tokens still on bonding curve."}
                  {goHuntingView === "migrated" && "Recently migrated to Raydium/Orca."}
                </span>
              </div>
            )}
            {activeTab === "bsc" && (
              <div className="mx-3 sm:mx-6 mt-4 mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200/80 dark:border-zinc-700/80 bg-zinc-50/80 dark:bg-zinc-800/50 p-3">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Go Hunting:</span>
                {(["new_pairs", "final_stretch", "migrated", "trending"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setBscGoHuntingView(v)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      bscGoHuntingView === v
                        ? "bg-cyan-500 text-white dark:bg-cyan-600"
                        : "bg-zinc-200/80 dark:bg-zinc-700/80 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300/80 dark:hover:bg-zinc-600/80"
                    }`}
                  >
                    {v === "new_pairs" ? "New pairs" : v === "final_stretch" ? "Final Stretch" : v === "migrated" ? "Migrated" : "Trending"}
                  </button>
                ))}
                <span className="text-xs text-muted-foreground ml-1">
                  {bscGoHuntingView === "new_pairs" && "New BSC pairs (PancakeSwap etc.)."}
                  {bscGoHuntingView === "final_stretch" && "BSC pairs on main DEXs."}
                  {bscGoHuntingView === "migrated" && "Migrated BSC pairs."}
                  {bscGoHuntingView === "trending" && "Trending BSC meme coins by volume and price change."}
                </span>
              </div>
            )}
            {activeTab === "ct" && ctAccounts.length > 0 && (
              <details className="mx-3 sm:mx-6 mt-4 mb-2 rounded-lg border border-zinc-200/80 dark:border-zinc-700/80 bg-zinc-50/80 dark:bg-zinc-800/50">
                <summary className="cursor-pointer px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Accounts we track ({ctAccounts.length})
                </summary>
                <div className="px-4 pb-3 pt-1 flex flex-wrap gap-2">
                  {ctAccounts.slice(0, 50).map((a) => (
                    <a
                      key={a.username}
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs px-2 py-1 rounded bg-zinc-200/80 dark:bg-zinc-700/80 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 text-zinc-700 dark:text-zinc-300 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors"
                    >
                      @{a.username}
                    </a>
                  ))}
                  {ctAccounts.length > 50 && <span className="text-xs text-muted-foreground">+{ctAccounts.length - 50} more</span>}
                </div>
              </details>
            )}
            {activeTab === "ct" && (
              <details className="mx-3 sm:mx-6 mt-2 mb-2 rounded-lg border border-zinc-200/80 dark:border-zinc-700/80 bg-zinc-50/80 dark:bg-zinc-800/50" open>
                <summary className="cursor-pointer px-4 py-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-between gap-2">
                  <span>
                    Live tweets from tracked accounts
                    {ctTweets.length > 0 && <span className="ml-2 text-xs font-normal text-muted-foreground">({ctTweets.length} in last 2h)</span>}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); fetchCtTweets(); }}
                    disabled={ctTweetsLoading}
                    className="shrink-0 border-zinc-200 dark:border-zinc-700"
                  >
                    {ctTweetsLoading ? "Loading…" : "Refresh"}
                  </Button>
                </summary>
                <div className="px-4 pb-4 pt-1">
                  {ctTweetsLoading ? (
                    <p className="text-sm text-muted-foreground py-4">Loading tweets…</p>
                  ) : ctTweetsError ? (
                    <p className="text-sm text-amber-600 dark:text-amber-400 py-4">{ctTweetsError}</p>
                  ) : ctTweets.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">No recent tweets. Run &quot;Scan Twitter&quot; to refresh, or tweets may be delayed.</p>
                  ) : (
                    <ul className="space-y-3 max-h-[420px] overflow-y-auto">
                      {ctTweets.slice(0, 50).map((t) => (
                        <li key={t.id || t.url + t.created_at} className="rounded-lg border border-zinc-200/80 dark:border-zinc-700/80 bg-white dark:bg-zinc-900/80 p-3 text-left">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <a href={t.url} target="_blank" rel="noopener noreferrer" className="font-medium text-cyan-600 dark:text-cyan-400 hover:underline">
                                @{t.author.username}
                              </a>
                              <span className="text-xs text-muted-foreground ml-2">· {t.author.followers.toLocaleString()} followers</span>
                              <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300 break-words line-clamp-3">{t.text}</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {new Date(t.created_at).toLocaleString()} · ♥ {t.metrics?.likes ?? 0} · 🔁 {t.metrics?.retweets ?? 0}
                              </p>
                            </div>
                            <a href={t.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:underline">View</a>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </details>
            )}
            {activeTab === "surge" && (
              <div className="mx-3 sm:mx-6 mt-4 mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200/80 dark:border-zinc-700/80 bg-zinc-50/80 dark:bg-zinc-800/50 p-3">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Volume window:</span>
                {(["5m", "15m", "30m", "1h", "6h", "24h"] as const).map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setSurgeWindow(w)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      surgeWindow === w
                        ? "bg-cyan-500 text-white dark:bg-cyan-600"
                        : "bg-zinc-200/80 dark:bg-zinc-700/80 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300/80 dark:hover:bg-zinc-600/80"
                    }`}
                  >
                    {w}
                  </button>
                ))}
                <span className="text-xs text-muted-foreground ml-1">5m/15m/30m estimated from 1h. Up to 80 coins.</span>
              </div>
            )}
            {loading && activeTab !== "ai-analysis" && activeTab !== "futures" && activeTab !== "trading-bot" && activeTab !== "polymarket-bot" && activeTab !== "prop-firm-bot" && tokensForDisplay.length === 0 ? (
              <div className="px-4 py-4">
                <Table>
                  <TableHeader>
                    <TableRow className="border-zinc-200/80 dark:border-zinc-800/80 hover:bg-transparent">
                      <TableHead className="font-semibold text-zinc-700 dark:text-zinc-300">Symbol</TableHead>
                      <TableHead className="hidden sm:table-cell font-semibold text-zinc-700 dark:text-zinc-300">Name</TableHead>
                      <TableHead className="text-right font-semibold text-zinc-700 dark:text-zinc-300">Score</TableHead>
                      <TableHead className="text-right font-semibold text-zinc-700 dark:text-zinc-300">Age</TableHead>
                      <TableHead className="text-right font-semibold text-zinc-700 dark:text-zinc-300">Liquidity</TableHead>
                      <TableHead className="text-right font-semibold text-zinc-700 dark:text-zinc-300">Price</TableHead>
                      <TableHead className="text-right font-semibold text-zinc-700 dark:text-zinc-300">Links</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                      <TableRow key={i} className="border-zinc-200/60 dark:border-zinc-800/60">
                        <TableCell><div className="h-5 w-12 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse" /></TableCell>
                        <TableCell className="hidden sm:table-cell"><div className="h-5 w-24 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse" /></TableCell>
                        <TableCell className="text-right"><div className="h-5 w-8 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse ml-auto" /></TableCell>
                        <TableCell className="text-right"><div className="h-5 w-10 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse ml-auto" /></TableCell>
                        <TableCell className="text-right"><div className="h-5 w-14 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse ml-auto" /></TableCell>
                        <TableCell className="text-right"><div className="h-5 w-16 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse ml-auto" /></TableCell>
                        <TableCell className="text-right"><div className="h-5 w-20 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse ml-auto" /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : activeTab === "ai-analysis" ? (
              <div className="mx-3 sm:mx-6 py-6 sm:py-8 max-w-2xl">
                {isPaid && (
                  <details className="mb-6 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80" open={pinnedTokens.length > 0}>
                    <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                      <span className="block font-semibold">Nova Staris Monitoring Board</span>
                      <span className="block text-xs font-normal text-muted-foreground mt-0.5">Pinned tokens — NovaStarisAI re-checks every ~3 min{pinnedTokens.length > 0 && ` · ${pinnedTokens.length} token${pinnedTokens.length === 1 ? "" : "s"} pinned`}</span>
                    </summary>
                    <div className="px-4 pb-4 pt-1">
                      {pinnedLoading && pinnedTokens.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-2">Loading pins…</p>
                      ) : pinnedTokens.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-2">Pin to the Nova Staris monitoring board for 3-min updates.</p>
                      ) : (
                        <ul className="space-y-2">
                          {pinnedTokens.map((p) => {
                            const res = p.analysisResult as { score?: number; signal?: string; tokenInfo?: { symbol?: string } } | null;
                            const last = p.lastAnalyzedAt ? `${Math.round((Date.now() - new Date(p.lastAnalyzedAt).getTime()) / 60000)}m ago` : "pending";
                            const pinDexUrl = p.chain === "bsc" ? `https://dexscreener.com/bsc/${p.contractAddress}` : `https://dexscreener.com/solana/${p.contractAddress}`;
                            return (
                              <li key={p.contractAddress} className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200/80 dark:border-zinc-700/80 bg-white dark:bg-zinc-900/80 px-3 py-2 text-sm">
                                <div className="min-w-0">
                                  <span className="font-medium text-zinc-900 dark:text-zinc-100">{p.symbol || res?.tokenInfo?.symbol || "—"}</span>
                                  <span className="text-xs text-muted-foreground ml-2">Score {res?.score ?? "—"} · {last}</span>
                                </div>
                                <div className="flex gap-1.5 shrink-0">
                                  <Button type="button" variant="outline" size="sm" onClick={() => viewPinnedResult(p)} className="text-xs">View</Button>
                                  <a href={pinDexUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-2 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800">Dex</a>
                                  <Button type="button" variant="outline" size="sm" onClick={() => refreshPinnedAnalysis(p.contractAddress)} disabled={refreshingPin === p.contractAddress} className="text-xs">{refreshingPin === p.contractAddress ? "…" : "Refresh"}</Button>
                                  <Button type="button" variant="ghost" size="sm" onClick={() => unpinToken(p.contractAddress)} className="text-xs text-rose-600 dark:text-rose-400">Unpin</Button>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </details>
                )}
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Chain:</span>
                  <button
                    type="button"
                    onClick={() => { setAiAnalysisChain("solana"); setAiAnalysisError(null); setAiAnalysisResult(null); }}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium ${aiAnalysisChain === "solana" ? "bg-cyan-500 text-white dark:bg-cyan-600" : "bg-zinc-200/80 dark:bg-zinc-700/80 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300/80 dark:hover:bg-zinc-600/80"}`}
                  >
                    Solana
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAiAnalysisChain("bsc"); setAiAnalysisError(null); setAiAnalysisResult(null); }}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium ${aiAnalysisChain === "bsc" ? "bg-cyan-500 text-white dark:bg-cyan-600" : "bg-zinc-200/80 dark:bg-zinc-700/80 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300/80 dark:hover:bg-zinc-600/80"}`}
                  >
                    BSC
                  </button>
                  {aiAnalysisChain === "bsc" && !isPaid && (
                    <span className="text-xs text-amber-600 dark:text-amber-400">BSC AI Agent is for Pro and VIP only.</span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  {aiAnalysisChain === "bsc"
                    ? "Enter a BSC token contract address (0x + 40 hex chars). Pro/VIP only. Optionally add the amount you plan to invest. NovaStaris AI will analyze on-chain data, security, and give buy zone, take profit & stop loss."
                    : "Enter a Solana token contract address (CA). Optionally add the amount you plan to invest so the AI can say if it's too risky for the token's liquidity. NovaStaris AI will analyze on-chain data, security, support/resistance, and give buy zone, take profit & stop loss."}
                </p>
                <div className="flex flex-wrap gap-2 items-end">
                  <div className="flex-1 min-w-[200px]">
                    <label htmlFor="ai-ca" className="sr-only">Contract address</label>
                    <input
                      id="ai-ca"
                      type="text"
                      placeholder={aiAnalysisChain === "bsc" ? "e.g. 0x1234... (BSC contract)" : "e.g. So11111111111111111111111111111111111111112"}
                      value={aiAnalysisCa}
                      onChange={(e) => { setAiAnalysisCa(e.target.value); setAiAnalysisError(null); }}
                      className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                  <div className="min-w-[120px]">
                    <label htmlFor="ai-amount" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Amount to invest ($)</label>
                    <input
                      id="ai-amount"
                      type="text"
                      inputMode="decimal"
                      placeholder="Optional"
                      value={aiAnalysisAmountUsd}
                      onChange={(e) => { setAiAnalysisAmountUsd(e.target.value); setAiAnalysisError(null); }}
                      className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                  <Button
                    onClick={runAiAnalysis}
                    disabled={aiAnalysisLoading}
                    className="bg-cyan-500 hover:bg-cyan-600 text-white dark:bg-cyan-600 dark:hover:bg-cyan-700"
                  >
                    {aiAnalysisLoading ? "Analyzing…" : "Analyze"}
                  </Button>
                </div>
                {aiAnalysisError && (
                  <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{aiAnalysisError}</p>
                )}
                {aiAnalysisResult && (
                  <div className="mt-6 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 p-5">
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">{aiAnalysisResult.tokenInfo?.symbol ?? "—"}</span>
                        <span className="text-sm text-muted-foreground">{aiAnalysisResult.tokenInfo?.name}</span>
                      </div>
                      <div
                        className={`text-4xl font-bold tabular-nums ${
                          aiAnalysisResult.score >= 76 ? "text-emerald-600 dark:text-emerald-400" :
                          aiAnalysisResult.score >= 51 ? "text-cyan-600 dark:text-cyan-400" :
                          aiAnalysisResult.score >= 26 ? "text-amber-600 dark:text-amber-400" :
                          "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {aiAnalysisResult.score}
                        <span className="text-lg font-normal text-muted-foreground ml-1">/ 100</span>
                      </div>
                      <Badge
                        className={`text-sm font-bold px-3 py-1 ${
                          aiAnalysisResult.signal === "buy"
                            ? "bg-emerald-500 text-white dark:bg-emerald-600 border-0 hover:bg-emerald-600 dark:hover:bg-emerald-700"
                            : "bg-rose-500 text-white dark:bg-rose-600 border-0 hover:bg-rose-600 dark:hover:bg-rose-700"
                        }`}
                      >
                        {aiAnalysisResult.signal === "buy" ? "BUY" : "NO BUY"}
                      </Badge>
                    </div>
                    <details className="mt-3 text-sm text-muted-foreground">
                      <summary className="cursor-pointer font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200">Why 0–100?</summary>
                      <p className="mt-2 pl-2 border-l-2 border-cyan-300 dark:border-cyan-700">
                        NovaStaris AI weighs liquidity, volume, security checks, socials, and <strong>narrative strength</strong> (viral potential, community/KOL buzz). Strong narratives often drive volume and mcap. 76+ = high confidence; 51–75 = watch; 26–50 = risky; 0–25 = very risky or new. The score is a snapshot — always do your own research and manage risk.
                      </p>
                    </details>
                    {aiAnalysisResult.narrativeAssessment && (
                      <div className="mt-3 rounded-lg border border-violet-200/80 dark:border-violet-800/80 bg-violet-50/50 dark:bg-violet-950/30 p-3 text-sm">
                        <p className="font-medium text-violet-800 dark:text-violet-200">Narrative</p>
                        <p className="text-violet-700 dark:text-violet-300">{aiAnalysisResult.narrativeAssessment}</p>
                      </div>
                    )}
                    {aiAnalysisResult.tokenInfo && (aiAnalysisResult.tokenInfo.liquidityUsd != null || aiAnalysisResult.tokenInfo.volume24h != null) && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Liquidity ${(aiAnalysisResult.tokenInfo.liquidityUsd ?? 0).toLocaleString()} · Vol 24h ${(aiAnalysisResult.tokenInfo.volume24h ?? 0).toLocaleString()}
                        {aiAnalysisResult.tokenInfo.priceChange24hPct != null && ` · ${aiAnalysisResult.tokenInfo.priceChange24hPct >= 0 ? "+" : ""}${aiAnalysisResult.tokenInfo.priceChange24hPct.toFixed(1)}% 24h`}
                      </p>
                    )}
                    {(aiAnalysisResult.tokenInfo?.securityIssues?.length ?? 0) > 0 && (
                      <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{(aiAnalysisResult.tokenInfo?.securityIssues ?? []).join(" ")}</p>
                    )}
                    {aiAnalysisResult.amountRiskNote && (
                      <div className="mt-4 rounded-lg border border-amber-200/80 dark:border-amber-800/80 bg-amber-50/50 dark:bg-amber-950/30 p-3 text-sm">
                        <p className="font-medium text-amber-800 dark:text-amber-200">Amount vs risk:</p>
                        <p className="text-amber-700 dark:text-amber-300">{aiAnalysisResult.amountRiskNote}</p>
                      </div>
                    )}
                    {aiAnalysisResult.recommendations && (aiAnalysisResult.recommendations.supportResistance || aiAnalysisResult.recommendations.marketStructure || aiAnalysisResult.recommendations.buyZoneMcap || aiAnalysisResult.recommendations.takeProfitPct || aiAnalysisResult.recommendations.stopLossPct) && (
                      <div className="mt-4 rounded-lg border border-cyan-200/80 dark:border-cyan-800/80 bg-cyan-50/50 dark:bg-cyan-950/30 p-4 space-y-2 text-sm">
                        <p className="font-semibold text-cyan-800 dark:text-cyan-200">Trading levels (meme coins are volatile — use risk management)</p>
                        {aiAnalysisResult.recommendations.supportResistance && <p><span className="text-muted-foreground">Support / Resistance:</span> {aiAnalysisResult.recommendations.supportResistance}</p>}
                        {aiAnalysisResult.recommendations.marketStructure && <p><span className="text-muted-foreground">Market structure:</span> {aiAnalysisResult.recommendations.marketStructure}</p>}
                        {aiAnalysisResult.recommendations.buyZoneMcap && <p><span className="text-muted-foreground">Buy zone (mcap):</span> {aiAnalysisResult.recommendations.buyZoneMcap}</p>}
                        {aiAnalysisResult.recommendations.takeProfitPct && <p><span className="text-emerald-600 dark:text-emerald-400">Take profit:</span> {aiAnalysisResult.recommendations.takeProfitPct}</p>}
                        {aiAnalysisResult.recommendations.stopLossPct && <p><span className="text-rose-600 dark:text-rose-400">Stop loss:</span> {aiAnalysisResult.recommendations.stopLossPct}</p>}
                      </div>
                    )}
                    <ul className="mt-4 list-disc list-inside space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
                      {aiAnalysisResult.reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                    {isOwner && (
                      <div className="mt-4 flex flex-wrap gap-2 items-center">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const { title: t, content: c } = formatAiAnalysisForShare(aiAnalysisResult);
                            const full = [t, c].filter(Boolean).join("\n\n");
                            navigator.clipboard.writeText(full).then(() => {
                              setAiAnalysisCopied(true);
                              setTimeout(() => setAiAnalysisCopied(false), 2000);
                            });
                          }}
                          className="border-zinc-300 dark:border-zinc-600"
                        >
                          {aiAnalysisCopied ? "Copied!" : <><Copy className="h-3.5 w-3.5 mr-1.5 inline" /> Copy analysis</>}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={aiAnalysisShareLoading}
                          onClick={async () => {
                            setAiAnalysisShareLoading(true);
                            setAiAnalysisShareSuccess(false);
                            try {
                              const { title: t, content: c } = formatAiAnalysisForShare(aiAnalysisResult);
                              const res = await fetch("/api/coach-calls", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ title: t, content: c }),
                              });
                              const data = await res.json();
                              if (data.success) {
                                setAiAnalysisShareSuccess(true);
                                setTimeout(() => setAiAnalysisShareSuccess(false), 3000);
                              } else {
                                alert(data.error ?? "Failed to share");
                              }
                            } catch {
                              alert("Failed to share");
                            } finally {
                              setAiAnalysisShareLoading(false);
                            }
                          }}
                          className="border-cyan-300 dark:border-cyan-700 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-50 dark:hover:bg-cyan-950/50"
                        >
                          {aiAnalysisShareLoading ? "Sharing…" : aiAnalysisShareSuccess ? "Shared!" : <><Send className="h-3.5 w-3.5 mr-1.5 inline" /> Share to Coach Calls</>}
                        </Button>
                      </div>
                    )}
                    {isPaid && (aiAnalysisResult.tokenInfo?.contractAddress ?? aiAnalysisCa.trim()) && (
                        <>
                          <Button type="button" variant="outline" size="sm" onClick={pinCurrentToken} className="border-cyan-300 dark:border-cyan-700 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-50 dark:hover:bg-cyan-950/50">
                            Pin to the Nova Staris monitoring board for 3-min updates
                          </Button>
                          {pinSuccess && <span className="text-xs text-emerald-600 dark:text-emerald-400">{pinSuccess}</span>}
                        </>
                      )}
                      {isOwner && (
                        <div className="w-full mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700 space-y-2">
                          <span className="text-xs text-muted-foreground">Was this analysis accurate?</span>
                          {aiAnalysisFeedbackSent ? (
                            <span className="text-xs text-emerald-600 dark:text-emerald-400 block">Thanks — feedback recorded.</span>
                          ) : (
                            <>
                              <div className="flex flex-wrap items-center gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={aiAnalysisFeedbackLoading}
                                  onClick={async () => {
                                    const ca = aiAnalysisResult.tokenInfo?.contractAddress ?? aiAnalysisCa.trim();
                                    if (!ca) return;
                                    setAiAnalysisFeedbackLoading(true);
                                    try {
                                      const res = await fetch("/api/admin/ai-feedback", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({
                                          contractAddress: ca,
                                          outcome: "good",
                                          score: aiAnalysisResult.score,
                                          signal: aiAnalysisResult.signal,
                                          note: aiAnalysisFeedbackNote.trim() || undefined,
                                        }),
                                      });
                                      const data = await res.json();
                                      if (data.success) { setAiAnalysisFeedbackSent("good"); setAiAnalysisFeedbackNote(""); }
                                      else alert(data.error ?? "Failed to send feedback");
                                    } catch {
                                      alert("Failed to send feedback");
                                    } finally {
                                      setAiAnalysisFeedbackLoading(false);
                                    }
                                  }}
                                  className="text-xs border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
                                >
                                  Yes, worked well
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={aiAnalysisFeedbackLoading}
                                  onClick={async () => {
                                    const ca = aiAnalysisResult.tokenInfo?.contractAddress ?? aiAnalysisCa.trim();
                                    if (!ca) return;
                                    setAiAnalysisFeedbackLoading(true);
                                    try {
                                      const res = await fetch("/api/admin/ai-feedback", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({
                                          contractAddress: ca,
                                          outcome: "bad",
                                          score: aiAnalysisResult.score,
                                          signal: aiAnalysisResult.signal,
                                          note: aiAnalysisFeedbackNote.trim() || undefined,
                                        }),
                                      });
                                      const data = await res.json();
                                      if (data.success) { setAiAnalysisFeedbackSent("bad"); setAiAnalysisFeedbackNote(""); }
                                      else alert(data.error ?? "Failed to send feedback");
                                    } catch {
                                      alert("Failed to send feedback");
                                    } finally {
                                      setAiAnalysisFeedbackLoading(false);
                                    }
                                  }}
                                  className="text-xs border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                                >
                                  No, didn't work
                                </Button>
                              </div>
                              <textarea
                                placeholder="Optional note (e.g. took profit earlier, stop hit)"
                                value={aiAnalysisFeedbackNote}
                                onChange={(e) => setAiAnalysisFeedbackNote(e.target.value.slice(0, 500))}
                                rows={2}
                                className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                              />
                            </>
                          )}
                        </div>
                      )}
                    </div>
                )}
              </div>
            ) : activeTab === "perp-radar" ? (
              <div className="mx-3 sm:mx-6 py-6 sm:py-8">
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">Perp Radar</h2>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-muted-foreground">View:</span>
                      <button
                        type="button"
                        onClick={() => { setPerpRadarView("all"); fetchPerpRadar("all"); }}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium ${perpRadarView === "all" ? "bg-cyan-500 text-white dark:bg-cyan-600" : "bg-zinc-200 dark:bg-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-500"}`}
                      >
                        All movers
                      </button>
                      <button
                        type="button"
                        onClick={() => { setPerpRadarView("macro"); fetchPerpRadar("macro"); }}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium ${perpRadarView === "macro" ? "bg-cyan-500 text-white dark:bg-cyan-600" : "bg-zinc-200 dark:bg-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-500"}`}
                      >
                        Macro perps
                      </button>
                      <button
                        type="button"
                        onClick={() => { setPerpRadarView("metals"); fetchPerpRadar("metals"); }}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium ${perpRadarView === "metals" ? "bg-cyan-500 text-white dark:bg-cyan-600" : "bg-zinc-200 dark:bg-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-500"}`}
                      >
                        Metals only
                      </button>
                      <span className="text-xs text-muted-foreground ml-1">Preset:</span>
                      <select
                        value={perpRadarPreset}
                        onChange={(e) => setPerpRadarPreset(e.target.value as "all" | "24h_up" | "24h_down")}
                        className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200"
                      >
                        <option value="all">All</option>
                        <option value="24h_up">24h up</option>
                        <option value="24h_down">24h down</option>
                      </select>
                      <span className="text-xs text-muted-foreground">Sort by:</span>
                      <select
                        value={perpRadarSortBy}
                        onChange={(e) => setPerpRadarSortBy(e.target.value as "5m" | "15m" | "30m" | "1h" | "4h" | "24h")}
                        className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200"
                      >
                        <option value="5m">5m %</option>
                        <option value="15m">15m %</option>
                        <option value="30m">30m %</option>
                        <option value="1h">1h %</option>
                        <option value="4h">4h %</option>
                        <option value="24h">24h %</option>
                      </select>
                      <Button variant="outline" size="sm" onClick={() => fetchPerpRadar()} disabled={perpRadarLoading}>
                        {perpRadarLoading ? "Loading…" : "Refresh"}
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    {perpRadarView === "macro"
                      ? "Macro perps from Binance USDT-M: energy, metals, and indices (e.g. XAU, XAG, SPX, BRENT). We pin XAU/XAG/SPX so they show even when they are not top 24h movers."
                      : perpRadarView === "metals"
                      ? "Metals-only view (XAU/XAG aliases). We pin XAU/XAG so they always show when listed."
                      : "Biggest 24h movers (≥3%, $100k+ vol). List changes on each Refresh—up to 150 symbols. 5m–4h from Binance when allowed, otherwise Hyperliquid where listed; else —. Use AI Signal or Crypto Futures to analyze."}
                  </p>
                  {perpRadarError && (
                    <div className="mb-3">
                      <p className="text-sm text-rose-600 dark:text-rose-400">{perpRadarError.includes("451") || perpRadarError.includes("restricts") ? "Binance blocks API access from our server's region." : perpRadarError}</p>
                      {(perpRadarError.includes("451") || perpRadarError.includes("restricts")) && (
                        <>
                          <p className="text-xs text-muted-foreground mt-1">In some regions Binance blocks access. Use <strong>Trending perps</strong> (Hyperliquid) for similar movers, or try «Load from my browser».</p>
                          <Button variant="outline" size="sm" className="mt-2" onClick={fetchPerpRadarFromBrowser} disabled={perpRadarLoading}>
                            {perpRadarLoading ? "Loading…" : "Load from my browser"}
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                  {perpRadarLoading && perpRadarItems.length === 0 && !perpRadarError ? (
                    <p className="text-xs text-muted-foreground">Loading…</p>
                  ) : perpRadarItems.length === 0 && !perpRadarError ? (
                    <p className="text-xs text-muted-foreground">{perpRadarView === "macro" ? "No macro perps found. Binance may not list them in your region, or try Refresh." : perpRadarView === "metals" ? "No metals perps found. Try Refresh, or check if XAU/XAG are listed in your region." : "No big movers right now. Hit Refresh to try again."}</p>
                  ) : perpRadarItems.length > 0 ? (
                    <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Symbol</TableHead>
                            <TableHead className="text-right text-xs">5m %</TableHead>
                            <TableHead className="text-right text-xs">15m %</TableHead>
                            <TableHead className="text-right text-xs">30m %</TableHead>
                            <TableHead className="text-right text-xs">1h %</TableHead>
                            <TableHead className="text-right text-xs">4h %</TableHead>
                            <TableHead className="text-right text-xs">24h %</TableHead>
                            <TableHead className="text-right text-xs">Price</TableHead>
                            <TableHead className="text-right text-xs" title="24h quote volume">24h Vol</TableHead>
                            <TableHead className="text-center text-xs w-20" title="On-demand NovaStaris AI signal (subscribers)">AI Signal</TableHead>
                            <TableHead className="text-right text-xs w-16">Trade</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(() => {
                            const filtered = perpRadarPreset === "all" ? [...perpRadarItems] : perpRadarPreset === "24h_up" ? perpRadarItems.filter((p) => p.change24hPct > 0) : perpRadarItems.filter((p) => p.change24hPct < 0);
                            const key = perpRadarSortBy;
                            const getVal = (p: PerpRadarItem) => key === "24h" ? p.change24hPct : key === "5m" ? (p.pct5m ?? 0) : key === "15m" ? (p.pct15m ?? 0) : key === "30m" ? (p.pct30m ?? 0) : key === "1h" ? (p.pct1h ?? 0) : (p.pct4h ?? 0);
                            const sorted = [...filtered].sort((a, b) => Math.abs(getVal(b)) - Math.abs(getVal(a)));
                            const fmt = (v: number | undefined) => (v == null ? "—" : (v >= 0 ? "+" : "") + v.toFixed(2) + "%");
                            const cls = (v: number | undefined) => (v == null ? "text-muted-foreground" : v >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400");
                            return sorted.map((p, i) => (
                              <TableRow key={`${p.exchange}-${p.symbol}-${i}`}>
                                <TableCell className="font-mono text-xs">{p.symbol}</TableCell>
                                <TableCell className={`text-right font-mono text-xs font-medium ${cls(p.pct5m)}`}>{fmt(p.pct5m)}</TableCell>
                                <TableCell className={`text-right font-mono text-xs font-medium ${cls(p.pct15m)}`}>{fmt(p.pct15m)}</TableCell>
                                <TableCell className={`text-right font-mono text-xs font-medium ${cls(p.pct30m)}`}>{fmt(p.pct30m)}</TableCell>
                                <TableCell className={`text-right font-mono text-xs font-medium ${cls(p.pct1h)}`}>{fmt(p.pct1h)}</TableCell>
                                <TableCell className={`text-right font-mono text-xs font-medium ${cls(p.pct4h)}`}>{fmt(p.pct4h)}</TableCell>
                                <TableCell className={`text-right font-mono text-xs font-medium ${cls(p.change24hPct)}`}>{fmt(p.change24hPct)}</TableCell>
                                <TableCell className="text-right font-mono text-xs">${Number(p.lastPrice).toLocaleString(undefined, { maximumFractionDigits: 4, minimumFractionDigits: 2 })}</TableCell>
                                <TableCell className="text-right font-mono text-xs text-muted-foreground">${(p.quoteVolume24h / 1_000_000).toFixed(2)}M</TableCell>
                                <TableCell className="text-center">{renderPerpAiSignalCell(p.base)}</TableCell>
                                <TableCell className="text-right">
                                  <a href={`https://www.binance.com/en/futures/${p.symbol}`} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline">Trade</a>
                                </TableCell>
                              </TableRow>
                            ));
                          })()}
                        </TableBody>
                      </Table>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : activeTab === "trending-perps" ? (
              <div className="mx-3 sm:mx-6 py-6 sm:py-8">
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">Trending perps</h2>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-muted-foreground">Preset:</span>
                      <select
                        value={perpPreset}
                        onChange={(e) => setPerpPreset(e.target.value as PerpPreset)}
                        className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200"
                      >
                        <option value="all">All</option>
                        <option value="short_positive_funding">Short + green funding</option>
                        <option value="long_negative_funding">Long + negative funding</option>
                        <option value="momentum_5m_3">5m % ≥ 3%</option>
                        <option value="exploders_1h_50">Exploders: 1h % ≥ 50%</option>
                        <option value="microcap_exploders">Micro caps: &lt;$5m vol, 1h % ≥ 30%</option>
                      </select>
                      <span className="text-xs text-muted-foreground">Sort by:</span>
                      <select
                        value={trendingPerpsSortBy}
                        onChange={(e) => setTrendingPerpsSortBy(e.target.value as "5m" | "15m" | "30m" | "1h" | "24h")}
                        className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200"
                      >
                        <option value="5m">5m %</option>
                        <option value="15m">15m %</option>
                        <option value="30m">30m %</option>
                        <option value="1h">1h %</option>
                        <option value="24h">24h %</option>
                      </select>
                      <Button variant="outline" size="sm" onClick={() => fetchTrendingPerps(undefined, true)} disabled={trendingPerpsLoading}>
                        {trendingPerpsLoading ? "Loading…" : "Refresh"}
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">Biggest movers by % change across 5m, 15m, 30m, 1h, 4h, and 24h. <strong>Direction</strong> is based on <strong>24h</strong> price change only: Long = price went up over 24h, Short = price went down (past move, not a forecast). <strong>Funding</strong> shows positioning: positive = long-heavy (longs pay shorts), negative = short-heavy. Pick one and use Crypto Futures (AI or Institutional Workflow) to analyze and trade.</p>
                  {isOwner && (
                    <div className="mb-4 rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 bg-zinc-50/50 dark:bg-zinc-800/30">
                      <h3 className="text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-2">Perp alerts (Telegram) — Owner only</h3>
                      <p className="text-xs text-muted-foreground mb-2">Get notified when a new perp is listed, or when 5m % crosses your threshold. Alerts run on cron. Owner-only for now.</p>
                      {perpAlertsLoading ? (
                        <p className="text-xs text-muted-foreground">Loading…</p>
                      ) : (
                        <>
                          <ul className="text-xs space-y-1 mb-3">
                            {perpAlertsList.map((a) => (
                              <li key={a.id} className="flex items-center justify-between gap-2">
                                <span className="font-mono">
                                  {a.alertType === "new_listing" ? "New listing" : `${a.symbol ?? ""} 5m ${a.alertType === "5m_pct_above" ? "≥" : "≤"} ${a.threshold ?? ""}%`}
                                </span>
                                <Button variant="ghost" size="sm" className="h-6 text-xs text-rose-600 hover:text-rose-700" onClick={() => deletePerpAlert(a.id)}>Remove</Button>
                              </li>
                            ))}
                            {perpAlertsList.length === 0 && <li className="text-muted-foreground">No alerts yet.</li>}
                          </ul>
                          <div className="flex flex-wrap items-center gap-2">
                            <select value={perpAlertAddType} onChange={(e) => setPerpAlertAddType(e.target.value as "new_listing" | "5m_pct_above" | "5m_pct_below")} className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                              <option value="new_listing">New listing</option>
                              <option value="5m_pct_above">5m % ≥</option>
                              <option value="5m_pct_below">5m % ≤</option>
                            </select>
                            {(perpAlertAddType === "5m_pct_above" || perpAlertAddType === "5m_pct_below") && (
                              <>
                                <input type="text" placeholder="Symbol (e.g. BTC)" value={perpAlertAddSymbol} onChange={(e) => setPerpAlertAddSymbol(e.target.value)} className="w-20 text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200" />
                                <input type="number" step="any" placeholder="%" value={perpAlertAddThreshold} onChange={(e) => setPerpAlertAddThreshold(e.target.value)} className="w-16 text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200" />
                              </>
                            )}
                            <Button size="sm" variant="outline" onClick={addPerpAlert}>Add alert</Button>
                            {perpAlertAddError && <span className="text-xs text-rose-600">{perpAlertAddError}</span>}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  {trendingPerpsLoading && trendingPerps.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Loading…</p>
                  ) : trendingPerps.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No data. Try Refresh.</p>
                  ) : (
                    <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Symbol</TableHead>
                            <TableHead className="text-right text-xs">5m %</TableHead>
                            <TableHead className="text-right text-xs">15m %</TableHead>
                            <TableHead className="text-right text-xs">30m %</TableHead>
                            <TableHead className="text-right text-xs">1h %</TableHead>
                            <TableHead className="text-right text-xs">4h %</TableHead>
                            <TableHead className="text-right text-xs">24h %</TableHead>
                            <TableHead className="text-center text-xs" title="Based on 24h % change: Long = price up over 24h, Short = price down. Past move, not a forecast.">Direction <span className="text-muted-foreground/70" title="Based on 24h % change. Past move, not a forecast.">ⓘ</span></TableHead>
                            <TableHead className="text-right text-xs" title="Positive = longs pay shorts (long-heavy). Negative = shorts pay longs (short-heavy).">Funding <span className="text-muted-foreground/70" title="Positive = longs pay shorts (long-heavy). Negative = shorts pay longs (short-heavy).">ⓘ</span></TableHead>
                            <TableHead className="text-right text-xs">Price</TableHead>
                            <TableHead className="text-right text-xs" title="Total notional volume (buys + sells) over 24h">24h Vol <span className="text-muted-foreground/70" title="Total notional volume (buys + sells)">ⓘ</span></TableHead>
                            <TableHead className="text-center text-xs w-20" title="On-demand NovaStaris AI signal (subscribers)">AI Signal</TableHead>
                            <TableHead className="text-right text-xs w-16">Trade</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filterPerpsByPreset([...trendingPerps])
                            .sort((a, b) => {
                              const key = trendingPerpsSortBy;
                              const va = key === "24h" ? a.dayPct : key === "5m" ? (a.pct5m ?? 0) : key === "15m" ? (a.pct15m ?? 0) : key === "30m" ? (a.pct30m ?? 0) : key === "1h" ? (a.pct1h ?? 0) : (a.pct4h ?? 0);
                              const vb = key === "24h" ? b.dayPct : key === "5m" ? (b.pct5m ?? 0) : key === "15m" ? (b.pct15m ?? 0) : key === "30m" ? (b.pct30m ?? 0) : key === "1h" ? (b.pct1h ?? 0) : (b.pct4h ?? 0);
                              return Math.abs(vb) - Math.abs(va);
                            })
                            .map((p) => {
                            const fmt = (v: number | undefined) => (v == null ? "—" : (v >= 0 ? "+" : "") + v.toFixed(2) + "%");
                            const cls = (v: number | undefined) => (v == null ? "text-muted-foreground" : v >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400");
                            const dirPct = p.dayPct;
                            const direction = dirPct > 0 ? "Long" : dirPct < 0 ? "Short" : "—";
                            const fundingNum = p.funding != null && p.funding !== "" ? Number(p.funding) * 100 : null;
                            const fundingStr = fundingNum == null ? "—" : (fundingNum >= 0 ? "+" : "") + fundingNum.toFixed(4) + "%";
                            return (
                              <TableRow key={p.coin}>
                                <TableCell className="font-mono text-xs">{p.coin}</TableCell>
                                <TableCell className={`text-right font-mono text-xs font-medium ${cls(p.pct5m)}`}>{fmt(p.pct5m)}</TableCell>
                                <TableCell className={`text-right font-mono text-xs font-medium ${cls(p.pct15m)}`}>{fmt(p.pct15m)}</TableCell>
                                <TableCell className={`text-right font-mono text-xs font-medium ${cls(p.pct30m)}`}>{fmt(p.pct30m)}</TableCell>
                                <TableCell className={`text-right font-mono text-xs font-medium ${cls(p.pct1h)}`}>{fmt(p.pct1h)}</TableCell>
                                <TableCell className={`text-right font-mono text-xs font-medium ${cls(p.pct4h)}`}>{fmt(p.pct4h)}</TableCell>
                                <TableCell className={`text-right font-mono text-xs font-medium ${cls(p.dayPct)}`}>{fmt(p.dayPct)}</TableCell>
                                <TableCell className={`text-center text-xs font-medium ${dirPct > 0 ? "text-emerald-600 dark:text-emerald-400" : dirPct < 0 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"}`}>{direction}</TableCell>
                                <TableCell className={`text-right font-mono text-xs ${fundingNum != null ? (fundingNum >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400") : "text-muted-foreground"}`} title="Positive = long-heavy (longs pay shorts). Negative = short-heavy (shorts pay longs).">{fundingStr}</TableCell>
                                <TableCell className="text-right font-mono text-xs">${Number(p.markPx).toLocaleString(undefined, { maximumFractionDigits: 4, minimumFractionDigits: 2 })}</TableCell>
                                <TableCell className="text-right font-mono text-xs text-muted-foreground" title="Total notional volume (buys + sells)">${Number(p.dayNtlVlm).toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                                <TableCell className="text-center">{renderPerpAiSignalCell(p.coin)}</TableCell>
                                <TableCell className="text-right">
                                  <a href={`https://app.hyperliquid.xyz/trade/${p.coin}`} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline">Trade</a>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </div>
            ) : activeTab === "futures" ? (
              <div className="mx-3 sm:mx-6 py-6 sm:py-8">
                <div className="flex flex-wrap gap-2 mb-6">
                  <Button
                    variant={futuresView === "ai" ? "default" : "outline"}
                    size="sm"
                    className={futuresView === "ai" ? "bg-cyan-500 hover:bg-cyan-600 dark:bg-cyan-600 dark:hover:bg-cyan-700" : ""}
                    onClick={() => setFuturesView("ai")}
                  >
                    NovaStaris AI Chart Analysis
                  </Button>
                  <Button
                    variant={futuresView === "workflow" ? "default" : "outline"}
                    size="sm"
                    className={futuresView === "workflow" ? "bg-cyan-500 hover:bg-cyan-600 dark:bg-cyan-600 dark:hover:bg-cyan-700" : ""}
                    onClick={() => setFuturesView("workflow")}
                  >
                    Institutional Workflow
                  </Button>
                  <Button
                    variant={futuresView === "altcoins" ? "default" : "outline"}
                    size="sm"
                    className={futuresView === "altcoins" ? "bg-cyan-500 hover:bg-cyan-600 dark:bg-cyan-600 dark:hover:bg-cyan-700" : ""}
                    onClick={() => setFuturesView("altcoins")}
                  >
                    Top Altcoins
                  </Button>
                  <Button
                    variant={futuresView === "hot-perps" ? "default" : "outline"}
                    size="sm"
                    className={futuresView === "hot-perps" ? "bg-cyan-500 hover:bg-cyan-600 dark:bg-cyan-600 dark:hover:bg-cyan-700" : ""}
                    onClick={() => setFuturesView("hot-perps")}
                  >
                    Hot New Perps
                  </Button>
                  <Button
                    variant={futuresView === "nova-crypto-narratives" ? "default" : "outline"}
                    size="sm"
                    className={futuresView === "nova-crypto-narratives" ? "bg-cyan-500 hover:bg-cyan-600 dark:bg-cyan-600 dark:hover:bg-cyan-700" : ""}
                    onClick={() => setFuturesView("nova-crypto-narratives")}
                  >
                    Nova Crypto Narratives
                  </Button>
                </div>
                {futuresView === "workflow" ? (
                  <FuturesWorkflow />
                ) : futuresView === "altcoins" ? (
                  <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 max-w-full">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                      <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">Top Altcoins</h2>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-muted-foreground">Preset:</span>
                        <select
                          value={perpPreset}
                          onChange={(e) => setPerpPreset(e.target.value as PerpPreset)}
                          className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200"
                        >
                          <option value="all">All</option>
                          <option value="short_positive_funding">Short + green funding</option>
                          <option value="long_negative_funding">Long + negative funding</option>
                          <option value="momentum_5m_3">5m % ≥ 3%</option>
                        </select>
                        <span className="text-xs text-muted-foreground">Sort by:</span>
                        <select
                          value={topAltcoinsSortBy}
                          onChange={(e) => setTopAltcoinsSortBy(e.target.value as "5m" | "15m" | "30m" | "1h" | "4h" | "24h" | "48h" | "72h" | "1w" | "2w" | "3w" | "4w")}
                          className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200"
                        >
                          <option value="5m">5m %</option>
                          <option value="15m">15m %</option>
                          <option value="30m">30m %</option>
                          <option value="1h">1h %</option>
                          <option value="4h">4h %</option>
                          <option value="24h">24h %</option>
                          <option value="48h">48h %</option>
                          <option value="72h">72h %</option>
                          <option value="1w">1w %</option>
                          <option value="2w">2w %</option>
                          <option value="3w">3w %</option>
                          <option value="4w">4w %</option>
                        </select>
                        <Button variant="outline" size="sm" onClick={fetchTopAltcoins} disabled={topAltcoinsLoading}>
                          {topAltcoinsLoading ? "Loading…" : "Refresh"}
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">BTC, ETH, SOL, DOGE and other major perps—same data as Trending perps (5m to 4h, 24h %, Direction, Funding). Use AI Chart Analysis or Institutional Workflow to analyze and trade.</p>
                    {topAltcoinsLoading && topAltcoins.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Loading…</p>
                    ) : topAltcoins.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No data. Try Refresh.</p>
                    ) : (
                      <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">Symbol</TableHead>
                              <TableHead className="text-right text-xs">5m %</TableHead>
                              <TableHead className="text-right text-xs">15m %</TableHead>
                              <TableHead className="text-right text-xs">30m %</TableHead>
                              <TableHead className="text-right text-xs">1h %</TableHead>
                              <TableHead className="text-right text-xs">4h %</TableHead>
                              <TableHead className="text-right text-xs">24h %</TableHead>
                              <TableHead className="text-center text-xs" title="Based on 24h % change. Past move, not a forecast.">Direction</TableHead>
                              <TableHead className="text-right text-xs" title="Positive = long-heavy, negative = short-heavy.">Funding</TableHead>
                              <TableHead className="text-right text-xs">Price</TableHead>
                              <TableHead className="text-right text-xs" title="Total notional volume (buys + sells)">24h Vol</TableHead>
                              <TableHead className="text-center text-xs w-20" title="On-demand NovaStaris AI signal (subscribers)">AI Signal</TableHead>
                              <TableHead className="text-right text-xs w-16">Trade</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filterPerpsByPreset([...topAltcoins])
                              .sort((a, b) => {
                                const key = topAltcoinsSortBy;
                                const va = key === "24h" ? a.dayPct : key === "5m" ? (a.pct5m ?? 0) : key === "15m" ? (a.pct15m ?? 0) : key === "30m" ? (a.pct30m ?? 0) : key === "1h" ? (a.pct1h ?? 0) : key === "4h" ? (a.pct4h ?? 0) : key === "48h" ? (a.pct48h ?? 0) : key === "72h" ? (a.pct72h ?? 0) : key === "1w" ? (a.pct1w ?? 0) : key === "2w" ? (a.pct2w ?? 0) : key === "3w" ? (a.pct3w ?? 0) : (a.pct4w ?? 0);
                                const vb = key === "24h" ? b.dayPct : key === "5m" ? (b.pct5m ?? 0) : key === "15m" ? (b.pct15m ?? 0) : key === "30m" ? (b.pct30m ?? 0) : key === "1h" ? (b.pct1h ?? 0) : key === "4h" ? (b.pct4h ?? 0) : key === "48h" ? (b.pct48h ?? 0) : key === "72h" ? (b.pct72h ?? 0) : key === "1w" ? (b.pct1w ?? 0) : key === "2w" ? (b.pct2w ?? 0) : key === "3w" ? (b.pct3w ?? 0) : (b.pct4w ?? 0);
                                return Math.abs(vb) - Math.abs(va);
                              })
                              .map((p) => {
                                const fmt = (v: number | undefined) => (v == null ? "—" : (v >= 0 ? "+" : "") + v.toFixed(2) + "%");
                                const cls = (v: number | undefined) => (v == null ? "text-muted-foreground" : v >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400");
                                const dirPct = p.dayPct;
                                const direction = dirPct > 0 ? "Long" : dirPct < 0 ? "Short" : "—";
                                const fundingNum = p.funding != null && p.funding !== "" ? Number(p.funding) * 100 : null;
                                const fundingStr = fundingNum == null ? "—" : (fundingNum >= 0 ? "+" : "") + fundingNum.toFixed(4) + "%";
                                return (
                                  <TableRow key={p.coin}>
                                    <TableCell className="font-mono text-xs">{p.coin}</TableCell>
                                    <TableCell className={`text-right font-mono text-xs font-medium ${cls(p.pct5m)}`}>{fmt(p.pct5m)}</TableCell>
                                    <TableCell className={`text-right font-mono text-xs font-medium ${cls(p.pct15m)}`}>{fmt(p.pct15m)}</TableCell>
                                    <TableCell className={`text-right font-mono text-xs font-medium ${cls(p.pct30m)}`}>{fmt(p.pct30m)}</TableCell>
                                    <TableCell className={`text-right font-mono text-xs font-medium ${cls(p.pct1h)}`}>{fmt(p.pct1h)}</TableCell>
                                    <TableCell className={`text-right font-mono text-xs font-medium ${cls(p.pct4h)}`}>{fmt(p.pct4h)}</TableCell>
                                    <TableCell className={`text-right font-mono text-xs font-medium ${cls(p.dayPct)}`}>{fmt(p.dayPct)}</TableCell>
                                    <TableCell className={`text-center text-xs font-medium ${dirPct > 0 ? "text-emerald-600 dark:text-emerald-400" : dirPct < 0 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"}`}>{direction}</TableCell>
                                    <TableCell className={`text-right font-mono text-xs ${fundingNum != null ? (fundingNum >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400") : "text-muted-foreground"}`}>{fundingStr}</TableCell>
                                    <TableCell className="text-right font-mono text-xs">${Number(p.markPx).toLocaleString(undefined, { maximumFractionDigits: 4, minimumFractionDigits: 2 })}</TableCell>
                                    <TableCell className="text-right font-mono text-xs text-muted-foreground">${Number(p.dayNtlVlm).toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                                    <TableCell className="text-center">{renderPerpAiSignalCell(p.coin)}</TableCell>
                                    <TableCell className="text-right">
                                      <a href={`https://app.hyperliquid.xyz/trade/${p.coin}`} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline">Trade</a>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                ) : futuresView === "hot-perps" ? (
                  <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 max-w-full">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                      <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">Hot New Perps</h2>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-muted-foreground">Preset:</span>
                        <select
                          value={perpPreset}
                          onChange={(e) => setPerpPreset(e.target.value as PerpPreset)}
                          className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200"
                        >
                          <option value="all">All</option>
                          <option value="short_positive_funding">Short + green funding</option>
                          <option value="long_negative_funding">Long + negative funding</option>
                          <option value="momentum_5m_3">5m % ≥ 3%</option>
                        </select>
                        <span className="text-xs text-muted-foreground">Sort by:</span>
                        <select
                          value={hotPerpsSortBy}
                          onChange={(e) => setHotPerpsSortBy(e.target.value as "5m" | "15m" | "30m" | "1h" | "4h" | "24h" | "48h" | "72h" | "1w" | "2w" | "3w" | "4w")}
                          className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200"
                        >
                          <option value="5m">5m %</option>
                          <option value="15m">15m %</option>
                          <option value="30m">30m %</option>
                          <option value="1h">1h %</option>
                          <option value="4h">4h %</option>
                          <option value="24h">24h %</option>
                          <option value="48h">48h %</option>
                          <option value="72h">72h %</option>
                          <option value="1w">1w %</option>
                          <option value="2w">2w %</option>
                          <option value="3w">3w %</option>
                          <option value="4w">4w %</option>
                        </select>
                        <Button variant="outline" size="sm" onClick={fetchHotPerps} disabled={hotPerpsLoading}>
                          {hotPerpsLoading ? "Loading…" : "Refresh"}
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                      {hotPerpsNewOnly
                        ? "New listings in the last 7 days with strong short-term momentum—sorted by 5m by default. When new perps are listed we show them here first."
                        : "No new listings in the last 7 days—showing top momentum perps instead. When new perps appear, we’ll show them here first."}
                      {" "}Columns: 5m–4h, 24h %, Direction, Funding. Use AI Chart Analysis or Institutional Workflow to analyze and trade.
                    </p>
                    {hotPerpsLoading && hotPerps.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Loading…</p>
                    ) : hotPerps.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No data. Try Refresh.</p>
                    ) : (
                      <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">Symbol</TableHead>
                              <TableHead className="text-right text-xs">5m %</TableHead>
                              <TableHead className="text-right text-xs">15m %</TableHead>
                              <TableHead className="text-right text-xs">30m %</TableHead>
                              <TableHead className="text-right text-xs">1h %</TableHead>
                              <TableHead className="text-right text-xs">4h %</TableHead>
                              <TableHead className="text-right text-xs">24h %</TableHead>
                              <TableHead className="text-center text-xs" title="Based on 24h % change. Past move, not a forecast.">Direction</TableHead>
                              <TableHead className="text-right text-xs" title="Positive = long-heavy, negative = short-heavy.">Funding</TableHead>
                              <TableHead className="text-right text-xs">Price</TableHead>
                              <TableHead className="text-right text-xs" title="Total notional volume (buys + sells)">24h Vol</TableHead>
                              <TableHead className="text-center text-xs w-20" title="On-demand NovaStaris AI signal (subscribers)">AI Signal</TableHead>
                              <TableHead className="text-right text-xs w-16">Trade</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filterPerpsByPreset([...hotPerps])
                              .sort((a, b) => {
                                const key = hotPerpsSortBy;
                                const va = key === "24h" ? a.dayPct : key === "5m" ? (a.pct5m ?? 0) : key === "15m" ? (a.pct15m ?? 0) : key === "30m" ? (a.pct30m ?? 0) : key === "1h" ? (a.pct1h ?? 0) : key === "4h" ? (a.pct4h ?? 0) : key === "48h" ? (a.pct48h ?? 0) : key === "72h" ? (a.pct72h ?? 0) : key === "1w" ? (a.pct1w ?? 0) : key === "2w" ? (a.pct2w ?? 0) : key === "3w" ? (a.pct3w ?? 0) : (a.pct4w ?? 0);
                                const vb = key === "24h" ? b.dayPct : key === "5m" ? (b.pct5m ?? 0) : key === "15m" ? (b.pct15m ?? 0) : key === "30m" ? (b.pct30m ?? 0) : key === "1h" ? (b.pct1h ?? 0) : key === "4h" ? (b.pct4h ?? 0) : key === "48h" ? (b.pct48h ?? 0) : key === "72h" ? (b.pct72h ?? 0) : key === "1w" ? (b.pct1w ?? 0) : key === "2w" ? (b.pct2w ?? 0) : key === "3w" ? (b.pct3w ?? 0) : (b.pct4w ?? 0);
                                return Math.abs(vb) - Math.abs(va);
                              })
                              .map((p) => {
                                const fmt = (v: number | undefined) => (v == null ? "—" : (v >= 0 ? "+" : "") + v.toFixed(2) + "%");
                                const cls = (v: number | undefined) => (v == null ? "text-muted-foreground" : v >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400");
                                const dirPct = p.dayPct;
                                const direction = dirPct > 0 ? "Long" : dirPct < 0 ? "Short" : "—";
                                const fundingNum = p.funding != null && p.funding !== "" ? Number(p.funding) * 100 : null;
                                const fundingStr = fundingNum == null ? "—" : (fundingNum >= 0 ? "+" : "") + fundingNum.toFixed(4) + "%";
                                return (
                                  <TableRow key={p.coin}>
                                    <TableCell className="font-mono text-xs">{p.coin}</TableCell>
                                    <TableCell className={`text-right font-mono text-xs font-medium ${cls(p.pct5m)}`}>{fmt(p.pct5m)}</TableCell>
                                    <TableCell className={`text-right font-mono text-xs font-medium ${cls(p.pct15m)}`}>{fmt(p.pct15m)}</TableCell>
                                    <TableCell className={`text-right font-mono text-xs font-medium ${cls(p.pct30m)}`}>{fmt(p.pct30m)}</TableCell>
                                    <TableCell className={`text-right font-mono text-xs font-medium ${cls(p.pct1h)}`}>{fmt(p.pct1h)}</TableCell>
                                    <TableCell className={`text-right font-mono text-xs font-medium ${cls(p.pct4h)}`}>{fmt(p.pct4h)}</TableCell>
                                    <TableCell className={`text-right font-mono text-xs font-medium ${cls(p.dayPct)}`}>{fmt(p.dayPct)}</TableCell>
                                    <TableCell className={`text-center text-xs font-medium ${dirPct > 0 ? "text-emerald-600 dark:text-emerald-400" : dirPct < 0 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"}`}>{direction}</TableCell>
                                    <TableCell className={`text-right font-mono text-xs ${fundingNum != null ? (fundingNum >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400") : "text-muted-foreground"}`}>{fundingStr}</TableCell>
                                    <TableCell className="text-right font-mono text-xs">${Number(p.markPx).toLocaleString(undefined, { maximumFractionDigits: 4, minimumFractionDigits: 2 })}</TableCell>
                                    <TableCell className="text-right font-mono text-xs text-muted-foreground">${Number(p.dayNtlVlm).toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                                    <TableCell className="text-center">{renderPerpAiSignalCell(p.coin)}</TableCell>
                                    <TableCell className="text-right">
                                      <a href={`https://app.hyperliquid.xyz/trade/${p.coin}`} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline">Trade</a>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                ) : futuresView === "nova-crypto-narratives" ? (
                  <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 max-w-3xl space-y-4">
                    <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">Nova Crypto Narratives</h2>
                    <p className="text-xs text-muted-foreground">
                      Pro and VIP. Pulls recent headlines (via public news search), summarizes narrative noise, and pairs it with{" "}
                      <strong className="text-zinc-700 dark:text-zinc-300">CFTC Traders in Financial Futures (TFF)</strong> positioning where we map your symbol to a listed contract. The same data is viewable on{" "}
                      <a href="https://www.tradingster.com/cot/futures/fin/133741" target="_blank" rel="noopener noreferrer" className="text-cyan-600 dark:text-cyan-400 hover:underline">
                        Tradingster
                      </a>{" "}
                      (example: CME Bitcoin 133741). Reports are weekly—always check the as-of date.
                    </p>
                    <div className="flex flex-wrap items-end gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">Contract</label>
                        <input
                          type="text"
                          placeholder="e.g. BTC, ETH, SOL"
                          value={novaCryptoNarrativesSymbol}
                          onChange={(e) => setNovaCryptoNarrativesSymbol(e.target.value.toUpperCase())}
                          className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 w-40 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200"
                        />
                      </div>
                      <Button
                        onClick={fetchNovaCryptoNarratives}
                        disabled={novaCryptoNarrativesLoading || !novaCryptoNarrativesSymbol.trim()}
                        className="bg-cyan-500 hover:bg-cyan-600 text-white dark:bg-cyan-600 dark:hover:bg-cyan-700"
                      >
                        {novaCryptoNarrativesLoading ? "Loading…" : "See Narratives"}
                      </Button>
                    </div>
                    {novaCryptoNarrativesError && (
                      <p className="text-sm text-rose-600 dark:text-rose-400">{novaCryptoNarrativesError}</p>
                    )}
                    {novaCryptoNarrativesResult && (
                      <div className="space-y-4 pt-2 border-t border-zinc-200 dark:border-zinc-700">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">{novaCryptoNarrativesResult.symbol}</span>
                          <Badge
                            variant="outline"
                            className={
                              novaCryptoNarrativesResult.narrativeDirection === "bullish"
                                ? "border-emerald-500/60 text-emerald-700 dark:text-emerald-300"
                                : novaCryptoNarrativesResult.narrativeDirection === "bearish"
                                  ? "border-rose-500/60 text-rose-700 dark:text-rose-300"
                                  : "border-zinc-400/60 text-zinc-700 dark:text-zinc-300"
                            }
                          >
                            Narrative: {novaCryptoNarrativesResult.narrativeDirection}
                          </Badge>
                          <Badge variant="secondary" className="text-xs capitalize">
                            Confidence: {novaCryptoNarrativesResult.directionConfidence}
                          </Badge>
                          {novaCryptoNarrativesResult.aiGenerated && (
                            <Badge variant="outline" className="text-xs border-violet-400/60 text-violet-700 dark:text-violet-300">
                              AI summary
                            </Badge>
                          )}
                        </div>
                        <div className="rounded-md bg-cyan-50/60 dark:bg-cyan-950/25 border border-cyan-200/80 dark:border-cyan-900/50 p-3">
                          <p className="text-xs font-medium text-cyan-900 dark:text-cyan-200 mb-1">Noise &amp; headline read</p>
                          <p className="text-sm text-cyan-900/90 dark:text-cyan-100/90">{novaCryptoNarrativesResult.noiseSummary}</p>
                        </div>
                        <div className="rounded-md bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-700 p-3">
                          <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200 mb-1">Institutional positioning (CFTC TFF)</p>
                          <p className="text-sm text-zinc-700 dark:text-zinc-300">{novaCryptoNarrativesResult.institutionalNarrative}</p>
                          {novaCryptoNarrativesResult.cot && (
                            <div className="mt-3 flex flex-wrap gap-3 text-xs">
                              <a
                                href={novaCryptoNarrativesResult.cot.tradingsterUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-cyan-600 dark:text-cyan-400 hover:underline font-medium"
                              >
                                Open Tradingster breakdown
                              </a>
                              <a
                                href="https://publicreporting.cftc.gov/dataset/gpe5-46if"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-cyan-600 dark:text-cyan-400 hover:underline font-medium"
                              >
                                CFTC dataset (TFF futures only)
                              </a>
                            </div>
                          )}
                        </div>
                        {novaCryptoNarrativesResult.newsHeadlines.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-2">Sources (headlines)</p>
                            <ul className="space-y-2 max-h-60 overflow-y-auto text-sm">
                              {novaCryptoNarrativesResult.newsHeadlines.map((h, i) => (
                                <li key={`${h.link}-${i}`}>
                                  <a href={h.link} target="_blank" rel="noopener noreferrer" className="text-cyan-600 dark:text-cyan-400 hover:underline">
                                    {h.title}
                                  </a>
                                  {h.pubDate && <span className="text-xs text-muted-foreground ml-2">{h.pubDate}</span>}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <p className="text-[11px] text-muted-foreground leading-relaxed">{novaCryptoNarrativesResult.disclaimer}</p>
                      </div>
                    )}
                  </div>
                ) : (
                <div className="max-w-2xl">
                <h2 className="text-xl sm:text-2xl font-bold mb-2 bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-500 bg-clip-text text-transparent dark:from-cyan-300 dark:via-blue-300 dark:to-cyan-400">
                  Trade with Confidence using NovaStaris Advanced AI System
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Upload a chart (any timeframe) and enter your trade parameters. NovaStaris AI will analyze support/resistance, market structure, entry zone, take profit & stop loss, tailored for futures.
                </p>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="futures-chart" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Chart image (required)</label>
                    <input
                      id="futures-chart"
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      onChange={onFuturesChartChange}
                      className="block w-full text-sm text-zinc-600 dark:text-zinc-400 file:mr-3 file:rounded-md file:border-0 file:bg-cyan-50 file:px-3 file:py-2 file:text-cyan-700 dark:file:bg-cyan-950/50 dark:file:text-cyan-300"
                    />
                    {futuresChartPreview && (
                      <div className="mt-2 rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden max-h-48">
                        <img src={futuresChartPreview} alt="Chart preview" className="w-full h-auto object-contain max-h-48" />
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="futures-symbol" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Symbol (required)</label>
                      <input
                        id="futures-symbol"
                        type="text"
                        placeholder="e.g. BTC/USDC"
                        value={futuresSymbol}
                        onChange={(e) => { setFuturesSymbol(e.target.value); setFuturesAnalysisError(null); }}
                        className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="futures-margin" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Margin — amount to invest (required)</label>
                      <input
                        id="futures-margin"
                        type="number"
                        min="1"
                        step="any"
                        placeholder="e.g. 1000"
                        value={futuresMargin}
                        onChange={(e) => { setFuturesMargin(e.target.value); setFuturesAnalysisError(null); }}
                        className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="futures-leverage" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Leverage (required)</label>
                      <select
                        id="futures-leverage"
                        value={futuresLeverage}
                        onChange={(e) => setFuturesLeverage(e.target.value)}
                        className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      >
                        {[1, 2, 3, 5, 10, 20, 50, 75, 100, 125].map((x) => (
                          <option key={x} value={x}>{x}x</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="futures-direction" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Direction (optional)</label>
                      <select
                        id="futures-direction"
                        value={futuresDirection}
                        onChange={(e) => setFuturesDirection((e.target.value || "") as "long" | "short" | "")}
                        className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      >
                        <option value="">Analyze both</option>
                        <option value="long">Long</option>
                        <option value="short">Short</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="futures-chart-tf" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Chart timeframe (required)</label>
                      <input
                        id="futures-chart-tf"
                        type="text"
                        placeholder="e.g. 5m, 15m, 4h, 1D"
                        value={futuresChartTimeframe}
                        onChange={(e) => { setFuturesChartTimeframe(e.target.value); setFuturesAnalysisError(null); }}
                        className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="futures-trade-tf" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Trade timeframe (required)</label>
                      <input
                        id="futures-trade-tf"
                        type="text"
                        placeholder="e.g. Scalp, Swing, 4 hours"
                        value={futuresTradeTimeframe}
                        onChange={(e) => { setFuturesTradeTimeframe(e.target.value); setFuturesAnalysisError(null); }}
                        className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="futures-risk" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Risk amount — max loss willing to take (optional)</label>
                    <input
                      id="futures-risk"
                      type="number"
                      min="0"
                      step="any"
                      placeholder="e.g. 100"
                      value={futuresRiskAmount}
                      onChange={(e) => setFuturesRiskAmount(e.target.value)}
                      className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 items-center">
                  <Button
                    onClick={runFuturesAnalysis}
                    disabled={futuresAnalysisLoading}
                    className="bg-cyan-500 hover:bg-cyan-600 text-white dark:bg-cyan-600 dark:hover:bg-cyan-700"
                  >
                    {futuresAnalysisLoading ? "Analyzing chart…" : "Analyze with NovaStaris AI"}
                  </Button>
                </div>
                {futuresAnalysisError && (
                  <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{futuresAnalysisError}</p>
                )}
                {futuresAnalysisResult && (
                  <div className="mt-6 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 p-5">
                    <div className="flex items-center gap-4 flex-wrap">
                      <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{futuresSymbol || "—"}</span>
                      <div
                        className={`text-4xl font-bold tabular-nums ${
                          futuresAnalysisResult.score >= 76 ? "text-emerald-600 dark:text-emerald-400" :
                          futuresAnalysisResult.score >= 51 ? "text-cyan-600 dark:text-cyan-400" :
                          futuresAnalysisResult.score >= 26 ? "text-amber-600 dark:text-amber-400" :
                          "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {futuresAnalysisResult.score}
                        <span className="text-lg font-normal text-muted-foreground ml-1">/ 100</span>
                      </div>
                      <Badge
                        className={`text-sm font-bold px-3 py-1 ${
                          futuresAnalysisResult.signal === "buy"
                            ? "bg-emerald-500 text-white dark:bg-emerald-600 border-0 hover:bg-emerald-600 dark:hover:bg-emerald-700"
                            : "bg-rose-500 text-white dark:bg-rose-600 border-0 hover:bg-rose-600 dark:hover:bg-rose-700"
                        }`}
                      >
                        {futuresAnalysisResult.signal === "buy"
                          ? (futuresAnalysisResult.tradeDirection === "long" ? "BUY LONG" : futuresAnalysisResult.tradeDirection === "short" ? "BUY SHORT" : "BUY")
                          : (futuresAnalysisResult.tradeDirection === "long" ? "NO BUY (bias: Long)" : futuresAnalysisResult.tradeDirection === "short" ? "NO BUY (bias: Short)" : "NO BUY")}
                      </Badge>
                    </div>
                    {futuresAnalysisResult.recommendations && (futuresAnalysisResult.recommendations.supportResistance || futuresAnalysisResult.recommendations.marketStructure || futuresAnalysisResult.recommendations.entryZone || futuresAnalysisResult.recommendations.takeProfitPct || futuresAnalysisResult.recommendations.stopLossPct) && (
                      <div className="mt-4 rounded-lg border border-cyan-200/80 dark:border-cyan-800/80 bg-cyan-50/50 dark:bg-cyan-950/30 p-4 space-y-2 text-sm">
                        <p className="font-semibold text-cyan-800 dark:text-cyan-200">Trading levels (futures — use risk management)</p>
                        {futuresAnalysisResult.recommendations.supportResistance && <p><span className="text-muted-foreground">Support / Resistance:</span> {futuresAnalysisResult.recommendations.supportResistance}</p>}
                        {futuresAnalysisResult.recommendations.marketStructure && <p><span className="text-muted-foreground">Market structure:</span> {futuresAnalysisResult.recommendations.marketStructure}</p>}
                        {futuresAnalysisResult.recommendations.entryZone && <p><span className="text-muted-foreground">Entry zone:</span> {futuresAnalysisResult.recommendations.entryZone}</p>}
                        {futuresAnalysisResult.recommendations.takeProfitPct && <p><span className="text-emerald-600 dark:text-emerald-400">Take profit:</span> {futuresAnalysisResult.recommendations.takeProfitPct}</p>}
                        {futuresAnalysisResult.recommendations.stopLossPct && <p><span className="text-rose-600 dark:text-rose-400">Stop loss:</span> {futuresAnalysisResult.recommendations.stopLossPct}</p>}
                      </div>
                    )}
                    <ul className="mt-4 list-disc list-inside space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
                      {futuresAnalysisResult.reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                    {isOwner && (
                      <div className="mt-4 space-y-3 pt-3 border-t border-zinc-200 dark:border-zinc-600">
                        <div className="flex flex-wrap gap-2 items-center">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const { title: t, content: c } = formatFuturesAnalysisForShare(futuresAnalysisResult);
                              const full = [t, c].filter(Boolean).join("\n\n");
                              navigator.clipboard.writeText(full).then(() => {
                                setFuturesAnalysisCopied(true);
                                setTimeout(() => setFuturesAnalysisCopied(false), 2000);
                              });
                            }}
                            className="border-zinc-300 dark:border-zinc-600"
                          >
                            {futuresAnalysisCopied ? "Copied!" : <><Copy className="h-3.5 w-3.5 mr-1.5 inline" /> Copy analysis</>}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={futuresAnalysisShareLoading}
                            onClick={async () => {
                              setFuturesAnalysisShareLoading(true);
                              setFuturesAnalysisShareSuccess(false);
                              try {
                                const { title: t, content: c } = formatFuturesAnalysisForShare(futuresAnalysisResult);
                                const res = await fetch("/api/coach-calls", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ title: t, content: c }),
                                });
                                const data = await res.json();
                                if (data.success) {
                                  setFuturesAnalysisShareSuccess(true);
                                  setTimeout(() => setFuturesAnalysisShareSuccess(false), 3000);
                                } else {
                                  alert(data.error ?? "Failed to share");
                                }
                              } catch {
                                alert("Failed to share");
                              } finally {
                                setFuturesAnalysisShareLoading(false);
                              }
                            }}
                            className="border-cyan-300 dark:border-cyan-700 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-50 dark:hover:bg-cyan-950/50"
                          >
                            {futuresAnalysisShareLoading ? "Sharing…" : futuresAnalysisShareSuccess ? "Shared!" : <><Send className="h-3.5 w-3.5 mr-1.5 inline" /> Share to Coach Calls</>}
                          </Button>
                        </div>
                        <div className="pt-2 border-t border-dashed border-zinc-200 dark:border-zinc-700 space-y-2">
                          <span className="text-xs text-muted-foreground block">Was this Crypto Futures analysis accurate?</span>
                          {futuresFeedbackSent ? (
                            <span className="text-xs text-emerald-600 dark:text-emerald-400 block">Thanks — feedback recorded.</span>
                          ) : (
                            <>
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={futuresFeedbackLoading}
                                  onClick={async () => {
                                    if (!futuresSymbol.trim()) return;
                                    setFuturesFeedbackLoading(true);
                                    try {
                                      const res = await fetch("/api/admin/ai-feedback", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({
                                          contractAddress: `futures:${futuresSymbol.trim()}`,
                                          outcome: "good",
                                          score: futuresAnalysisResult.score,
                                          signal: futuresAnalysisResult.signal,
                                          note: futuresFeedbackNote.trim() || undefined,
                                        }),
                                      });
                                      const data = await res.json();
                                      if (data.success) { setFuturesFeedbackSent("good"); setFuturesFeedbackNote(""); }
                                      else alert(data.error ?? "Failed to send feedback");
                                    } catch {
                                      alert("Failed to send feedback");
                                    } finally {
                                      setFuturesFeedbackLoading(false);
                                    }
                                  }}
                                  className="text-xs border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
                                >
                                  Yes, worked well
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={futuresFeedbackLoading}
                                  onClick={async () => {
                                    if (!futuresSymbol.trim()) return;
                                    setFuturesFeedbackLoading(true);
                                    try {
                                      const res = await fetch("/api/admin/ai-feedback", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({
                                          contractAddress: `futures:${futuresSymbol.trim()}`,
                                          outcome: "bad",
                                          score: futuresAnalysisResult.score,
                                          signal: futuresAnalysisResult.signal,
                                          note: futuresFeedbackNote.trim() || undefined,
                                        }),
                                      });
                                      const data = await res.json();
                                      if (data.success) { setFuturesFeedbackSent("bad"); setFuturesFeedbackNote(""); }
                                      else alert(data.error ?? "Failed to send feedback");
                                    } catch {
                                      alert("Failed to send feedback");
                                    } finally {
                                      setFuturesFeedbackLoading(false);
                                    }
                                  }}
                                  className="text-xs border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                                >
                                  No, needs work
                                </Button>
                              </div>
                              <textarea
                                value={futuresFeedbackNote}
                                onChange={(e) => setFuturesFeedbackNote(e.target.value)}
                                placeholder="Optional note for training (what worked or what missed)…"
                                rows={2}
                                className="w-full text-xs rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                              />
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                </div>
                )}
              </div>
            ) : activeTab === "nova-connect" ? (
              <div className="mx-3 sm:mx-6 py-6 sm:py-8 max-w-5xl space-y-6">
                <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent">
                  NovaConnect ... connecting great minds.
                </h2>
                <p className="text-sm text-muted-foreground">
                  NovaConnect: the first social platform for crypto traders. Before you get started, please read and accept the community rules and presence/privacy notes.
                </p>
                {!novaConnectRulesAccepted && (
                  <div className="rounded-xl border border-emerald-300/80 dark:border-emerald-700/80 bg-emerald-50/80 dark:bg-emerald-950/40 p-4 space-y-3">
                    <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                      Read and accept NovaConnect rules
                    </p>
                    <p className="text-xs text-emerald-900 dark:text-emerald-200">
                      NovaConnect is a community space for serious traders. To protect everyone, you must agree to basic rules before you appear online or start using NovaConnect features.
                    </p>
                    <p className="text-xs text-emerald-800 dark:text-emerald-200 font-medium">
                      Privacy: Your preferred name (or the name you set) will be displayed to everyone on NovaConnect. We are not liable for any issues arising from your use of the service.
                    </p>
                    <ul className="text-xs text-emerald-900 dark:text-emerald-200 list-disc list-inside space-y-1 max-h-40 overflow-y-auto border border-emerald-200/60 dark:border-emerald-800/60 rounded-md p-2 bg-emerald-50/60 dark:bg-emerald-950/30">
                      <li>No insults, racism, hate speech, harassment, or bullying.</li>
                      <li>No spam, scams, or fake PnL screenshots.</li>
                      <li>No sharing private information (yours or others&apos;) without consent.</li>
                      <li>Respect other traders — disagree with ideas, not people.</li>
                      <li>Admins can mute, remove messages, or remove users from NovaConnect if rules are broken.</li>
                      <li>NovaConnect is not financial advice. Always do your own research.</li>
                    </ul>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="rounded border-emerald-400"
                          checked={novaConnectRulesAccepted}
                          onChange={async (e) => {
                            if (!e.target.checked) return;
                            setNovaConnectRulesAccepted(true);
                            if (typeof window !== "undefined") {
                              window.localStorage.setItem("novaConnectRulesAccepted", "1");
                            }
                            try {
                              await fetch("/api/nova-connect/profile", {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ rulesAccepted: true }),
                              });
                            } catch {
                              // ignore; UI is still optimistic
                            }
                          }}
                        />
                        <span className="text-emerald-900 dark:text-emerald-200">
                          I have read and agree to follow these rules.
                        </span>
                      </label>
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <button
                    type="button"
                    className="underline underline-offset-2 hover:no-underline"
                    onClick={() => novaConnectRulesRef.current?.scrollIntoView({ behavior: "smooth" })}
                  >
                    View community rules
                  </button>
                  <span>·</span>
                  <button
                    type="button"
                    className="underline underline-offset-2 hover:no-underline"
                    onClick={() => novaConnectPrivacyRef.current?.scrollIntoView({ behavior: "smooth" })}
                  >
                    View presence &amp; privacy
                  </button>
                </div>
                {showNicknamePrompt && (
                  <div className="rounded-xl border border-amber-300/80 dark:border-amber-700/80 bg-amber-50/80 dark:bg-amber-950/40 p-4 space-y-3">
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                      First time here?
                    </p>
                    <p className="text-xs text-amber-900 dark:text-amber-200">
                      If you don&apos;t want your real name visible to others, set a preferred name on the Account page.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button asChild size="sm" variant="outline" className="text-xs border-amber-400 text-amber-800 dark:text-amber-200">
                        <Link href="/account">Go to Account</Link>
                      </Button>
                      <button
                        type="button"
                        className="text-xs text-amber-700 dark:text-amber-300 underline"
                        onClick={dismissNicknamePrompt}
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                )}
                {novaConnectRulesAccepted && (
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)]">
                    {/* Community feed + composer */}
                    <div className="space-y-3">
                      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-900/60 p-3 space-y-2">
                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Community feed</h3>
                        <p className="text-xs text-muted-foreground">
                          Share charts, screenshots, and notes. Everyone can post here. Pro/VIP members (or users allowed by admin) can see online traders and send private messages. Profile photos from Account appear next to posts—tap a photo to view full size.
                        </p>
                      </div>
                      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white/90 dark:bg-zinc-900/70 p-3 space-y-3 min-h-[220px]">
                        <div className="space-y-2">
                          <textarea
                            value={novaConnectCommunityInput}
                            onChange={(e) => setNovaConnectCommunityInput(e.target.value)}
                            placeholder="Share a chart idea, setup, or note…"
                            rows={3}
                            className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              type="text"
                              value={novaConnectCommunityImageUrl}
                              onChange={(e) => setNovaConnectCommunityImageUrl(e.target.value)}
                              placeholder="Optional image URL (chart screenshot)"
                              className="flex-1 min-w-[180px] rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                            <Button
                              type="button"
                              size="sm"
                              onClick={async () => {
                                if (!novaConnectRulesAccepted) return;
                                const text = novaConnectCommunityInput.trim();
                                const img = novaConnectCommunityImageUrl.trim();
                                if (!text && !img) return;
                                setNovaConnectSending(true);
                                try {
                                  const res = await fetch("/api/nova-connect/messages", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ scope: "community", content: text, imageUrl: img || undefined }),
                                  });
                                  const data = await res.json();
                                  if (data.success) {
                                    setNovaConnectCommunityInput("");
                                    setNovaConnectCommunityImageUrl("");
                                    await loadNovaConnectCommunity();
                                  } else {
                                    alert(data.error ?? "Failed to post.");
                                  }
                                } catch {
                                  alert("Failed to post.");
                                } finally {
                                  setNovaConnectSending(false);
                                }
                              }}
                              disabled={novaConnectSending}
                              className="bg-emerald-500 hover:bg-emerald-600 text-white dark:bg-emerald-600 dark:hover:bg-emerald-700"
                            >
                              {novaConnectSending ? "Posting…" : "Post"}
                            </Button>
                          </div>
                          {!canUseNovaConnectPaidFeatures && (
                            <p className="text-[11px] text-amber-700 dark:text-amber-300">
                              Upgrade to Pro or VIP (or ask an admin to allow NovaConnect) to see online traders and chat with them.
                            </p>
                          )}
                        </div>
                        <div className="border-t border-zinc-200 dark:border-zinc-700 pt-3 space-y-2 max-h-[320px] overflow-y-auto">
                          {novaConnectLoading ? (
                            <p className="text-xs text-muted-foreground">Loading feed…</p>
                          ) : novaConnectError ? (
                            <p className="text-xs text-rose-600 dark:text-rose-400">{novaConnectError}</p>
                          ) : novaConnectMessages.length === 0 ? (
                            <p className="text-xs text-muted-foreground">No posts yet. Be the first to share a setup.</p>
                          ) : (
                            novaConnectMessages
                              .slice()
                              .reverse()
                              .map((m) => {
                                const myId = (session?.user as { id?: string })?.id;
                                const isAuthor = m.fromUserId === myId;
                                const isOwner = !!(session?.user as { isOwner?: boolean })?.isOwner;
                                const isCommunityRep = !!(session?.user as { novaConnectCommunityRep?: boolean })?.novaConnectCommunityRep;
                                const canDelete = isOwner || isCommunityRep || isAuthor;
                                const isEditing = novaConnectEditingId === m.id;
                                return (
                                  <div key={m.id} className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50/70 dark:bg-zinc-900/70 p-2.5 space-y-1">
                                    <div className="flex items-start gap-2.5">
                                      <NovaConnectFeedAuthorAvatar
                                        messageId={m.id}
                                        displayName={m.fromDisplayName}
                                        avatarUrl={m.fromAvatarUrl}
                                        failedIds={novaConnectFeedAvatarFailedIds}
                                        setFailedIds={setNovaConnectFeedAvatarFailedIds}
                                        setLightbox={setNovaConnectAvatarLightbox}
                                      />
                                      <div className="flex-1 min-w-0 flex items-center justify-between gap-2 flex-wrap">
                                      <span className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">{m.fromDisplayName}</span>
                                      <div className="flex items-center gap-1 shrink-0">
                                        <span className="text-[10px] text-muted-foreground">
                                          {new Date(m.createdAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                                        </span>
                                        {canDelete && (
                                          <button
                                            type="button"
                                            disabled={novaConnectDeleteLoading === m.id}
                                            onClick={async () => {
                                              if (!confirm("Delete this post?")) return;
                                              setNovaConnectDeleteLoading(m.id);
                                              try {
                                                const res = await fetch(`/api/nova-connect/messages?id=${encodeURIComponent(m.id)}`, { method: "DELETE" });
                                                const data = await res.json();
                                                if (data.success) await loadNovaConnectCommunity();
                                                else alert(data.error ?? "Failed to delete.");
                                              } catch {
                                                alert("Failed to delete.");
                                              } finally {
                                                setNovaConnectDeleteLoading(null);
                                              }
                                            }}
                                            className="text-[10px] text-rose-600 dark:text-rose-400 hover:underline disabled:opacity-50"
                                          >
                                            {novaConnectDeleteLoading === m.id ? "…" : "Delete"}
                                          </button>
                                        )}
                                        {isAuthor && !isEditing && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setNovaConnectEditingId(m.id);
                                              setNovaConnectEditingContent(m.content);
                                            }}
                                            className="text-[10px] text-cyan-600 dark:text-cyan-400 hover:underline"
                                          >
                                            Edit
                                          </button>
                                        )}
                                        {!isEditing && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setNovaConnectReplyingToId(m.id);
                                              setNovaConnectReplyContent("");
                                            }}
                                            className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline"
                                          >
                                            Reply
                                          </button>
                                        )}
                                      </div>
                                      </div>
                                    </div>
                                    {novaConnectReplyingToId === m.id && (
                                      <div className="mt-2 pl-2 border-l-2 border-emerald-300 dark:border-emerald-700 space-y-1">
                                        <textarea
                                          value={novaConnectReplyContent}
                                          onChange={(e) => setNovaConnectReplyContent(e.target.value)}
                                          placeholder="Write a reply…"
                                          rows={2}
                                          className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1 text-xs"
                                        />
                                        <div className="flex gap-2">
                                          <button
                                            type="button"
                                            disabled={novaConnectReplySending}
                                            onClick={async () => {
                                              if (!novaConnectReplyContent.trim()) return;
                                              setNovaConnectReplySending(true);
                                              try {
                                                const res = await fetch("/api/nova-connect/messages", {
                                                  method: "POST",
                                                  headers: { "Content-Type": "application/json" },
                                                  body: JSON.stringify({ scope: "community", content: novaConnectReplyContent.trim(), parentMessageId: m.id }),
                                                });
                                                const data = await res.json();
                                                if (data.success) {
                                                  setNovaConnectReplyingToId(null);
                                                  setNovaConnectReplyContent("");
                                                  await loadNovaConnectCommunity();
                                                } else alert(data.error ?? "Failed to post reply.");
                                              } catch {
                                                alert("Failed to post reply.");
                                              } finally {
                                                setNovaConnectReplySending(false);
                                              }
                                            }}
                                            className="text-xs px-2 py-1 rounded bg-emerald-500 text-white disabled:opacity-50"
                                          >
                                            {novaConnectReplySending ? "Sending…" : "Send reply"}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setNovaConnectReplyingToId(null);
                                              setNovaConnectReplyContent("");
                                            }}
                                            className="text-xs px-2 py-1 rounded border border-zinc-400 text-zinc-700 dark:text-zinc-300"
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                    {isEditing ? (
                                      <div className="space-y-1">
                                        <textarea
                                          value={novaConnectEditingContent}
                                          onChange={(e) => setNovaConnectEditingContent(e.target.value)}
                                          rows={3}
                                          className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1 text-xs"
                                        />
                                        <div className="flex gap-2">
                                          <button
                                            type="button"
                                            disabled={novaConnectEditSaving}
                                            onClick={async () => {
                                              if (!novaConnectEditingContent.trim()) return;
                                              setNovaConnectEditSaving(true);
                                              try {
                                                const res = await fetch("/api/nova-connect/messages", {
                                                  method: "PATCH",
                                                  headers: { "Content-Type": "application/json" },
                                                  body: JSON.stringify({ id: m.id, content: novaConnectEditingContent.trim() }),
                                                });
                                                const data = await res.json();
                                                if (data.success) {
                                                  setNovaConnectEditingId(null);
                                                  setNovaConnectEditingContent("");
                                                  await loadNovaConnectCommunity();
                                                } else alert(data.error ?? "Failed to save.");
                                              } catch {
                                                alert("Failed to save.");
                                              } finally {
                                                setNovaConnectEditSaving(false);
                                              }
                                            }}
                                            className="text-xs px-2 py-1 rounded bg-emerald-500 text-white disabled:opacity-50"
                                          >
                                            {novaConnectEditSaving ? "Saving…" : "Save"}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setNovaConnectEditingId(null);
                                              setNovaConnectEditingContent("");
                                            }}
                                            className="text-xs px-2 py-1 rounded border border-zinc-400 text-zinc-700 dark:text-zinc-300"
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <>
                                        {m.content && <p className="text-xs text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap">{m.content}</p>}
                                        {m.imageUrl && (
                                          <a
                                            href={m.imageUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="block mt-1 text-[11px] text-emerald-700 dark:text-emerald-300 underline underline-offset-2"
                                          >
                                            View screenshot
                                          </a>
                                        )}
                                      </>
                                    )}
                                    {(m.replies?.length ?? 0) > 0 && (
                                      <div className="mt-2 space-y-1.5 pl-2 border-l-2 border-zinc-200 dark:border-zinc-600">
                                        {m.replies!.map((r) => (
                                          <div key={r.id} className="text-[11px] flex gap-2">
                                            <NovaConnectFeedAuthorAvatar
                                              messageId={r.id}
                                              displayName={r.fromDisplayName}
                                              avatarUrl={r.fromAvatarUrl}
                                              failedIds={novaConnectFeedAvatarFailedIds}
                                              setFailedIds={setNovaConnectFeedAvatarFailedIds}
                                              setLightbox={setNovaConnectAvatarLightbox}
                                            />
                                            <div className="min-w-0 flex-1">
                                              <span className="font-semibold text-zinc-800 dark:text-zinc-200">{r.fromDisplayName}</span>
                                              <span className="text-[10px] text-muted-foreground ml-1">
                                                {new Date(r.createdAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                                              </span>
                                              {r.content && <p className="mt-0.5 text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">{r.content}</p>}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Members / DMs / profile link */}
                    <div className="space-y-3">
                      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-900/60 p-3 space-y-2">
                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Members &amp; private chat</h3>
                        <p className="text-xs text-muted-foreground">
                          Click a trader to open a private chat.
                          {novaConnectHasCustomDisplayName
                            ? " Use the Account page to change your profile picture."
                            : " Use the Account page to change your preferred name or profile picture."}
                        </p>
                        <Button asChild size="sm" variant="outline" className="text-xs">
                          <Link href="/account">Go to Account (profile &amp; preferred name)</Link>
                        </Button>
                      </div>
                      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white/90 dark:bg-zinc-900/70 p-3 space-y-2">
                        <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Online traders</h4>
                        <p className="text-[10px] text-muted-foreground -mt-1 mb-0.5">Tap a member&apos;s photo to view it full size.</p>
                        {!canUseNovaConnectPaidFeatures ? (
                          <div
                            className="relative flex flex-col items-center justify-center min-h-[140px] rounded-md bg-zinc-200/80 dark:bg-zinc-800/80 overflow-hidden"
                            role="button"
                            tabIndex={0}
                            onClick={() => alert("Upgrade to Pro or VIP to see online traders and chat with users, or ask an admin to allow NovaConnect for you.")}
                            onKeyDown={(e) => e.key === "Enter" && alert("Upgrade to Pro or VIP to see online traders and chat with users.")}
                          >
                            <div className="absolute inset-0 backdrop-blur-[6px] bg-zinc-300/50 dark:bg-zinc-700/50" aria-hidden />
                            <p className="relative z-10 text-xs text-zinc-600 dark:text-zinc-400 text-center px-3">
                              Upgrade to Pro or VIP to see online traders and chat with them.
                            </p>
                            <button type="button" className="relative z-10 mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 underline">
                              Unlock
                            </button>
                          </div>
                        ) : novaConnectUsers.length === 0 ? (
                          <p className="text-[11px] text-muted-foreground">No NovaConnect members yet.</p>
                        ) : (
                          <ul className="space-y-2 max-h-[280px] overflow-y-auto">
                            {novaConnectUsers.map((u) => {
                              const isUnread = novaConnectDmUnreadUserIds.includes(u.id);
                              const ringClass =
                                u.status === "online"
                                  ? "ring-emerald-500"
                                  : u.status === "away"
                                    ? "ring-amber-500"
                                    : u.status === "busy"
                                      ? "ring-rose-500"
                                      : "ring-zinc-500";
                              const avatarSrc =
                                u.avatarUrl && u.avatarUrl.includes("blob.vercel-storage.com")
                                  ? `/api/avatar?url=${encodeURIComponent(u.avatarUrl)}`
                                  : u.avatarUrl || "";
                              return (
                              <li key={u.id} className="flex items-center justify-between gap-2 text-xs">
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  {u.avatarUrl && !novaConnectAvatarFailedIds.has(u.id) ? (
                                    <button
                                      type="button"
                                      title="Tap to view full size"
                                      aria-label={`View ${u.displayName}'s profile picture full size`}
                                      className="relative shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-zinc-100 dark:focus-visible:ring-offset-zinc-900 cursor-zoom-in hover:opacity-95 active:scale-[0.98] transition-transform"
                                      onClick={() =>
                                        setNovaConnectAvatarLightbox({ src: avatarSrc, name: u.displayName })
                                      }
                                    >
                                      <img
                                        src={avatarSrc}
                                        alt=""
                                        className={`h-12 w-12 sm:h-14 sm:w-14 rounded-full object-cover ring-2 ${ringClass}`}
                                        onError={() => setNovaConnectAvatarFailedIds((prev) => new Set(prev).add(u.id))}
                                      />
                                    </button>
                                  ) : (
                                    <span
                                      className={`inline-flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-full text-base font-semibold ring-2 ${ringClass} ${
                                        u.status === "online"
                                          ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300"
                                          : u.status === "away"
                                            ? "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300"
                                            : u.status === "busy"
                                              ? "bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300"
                                              : "bg-zinc-300 dark:bg-zinc-600 text-zinc-600 dark:text-zinc-300"
                                      }`}
                                    >
                                      {(u.displayName || "?").charAt(0).toUpperCase()}
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setNovaConnectDmUserId(u.id);
                                      markDmAsSeenForUser(u.id);
                                      loadNovaConnectDm(u.id);
                                    }}
                                    className="flex-1 min-w-0 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg px-2 py-1.5 -my-0.5"
                                  >
                                    <span className={`block truncate flex items-center gap-1 ${isUnread ? "font-semibold text-emerald-700 dark:text-emerald-300" : "text-zinc-900 dark:text-zinc-100"}`}>
                                      {u.displayName}
                                      {u.me ? " (you)" : ""}
                                      {isUnread && !u.me && (
                                        <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 dark:bg-emerald-300 shrink-0" aria-hidden />
                                      )}
                                    </span>
                                  </button>
                                </div>
                                {!u.me && (
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      className="text-[10px] text-zinc-600 dark:text-zinc-300 underline"
                                      onClick={async (ev) => {
                                        ev.stopPropagation();
                                        const reason = window.prompt("Reason for report (required):")?.trim();
                                        if (!reason) return;
                                        try {
                                          const res = await fetch("/api/nova-connect/report", {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ reportedUserId: u.id, reason }),
                                          });
                                          const data = await res.json();
                                          if (!data.success) alert(data.error ?? "Failed to report user.");
                                        } catch {
                                          alert("Failed to report user.");
                                        }
                                      }}
                                    >
                                      Report
                                    </button>
                                    <button
                                      type="button"
                                      className="text-[10px] text-zinc-600 dark:text-zinc-300 underline"
                                      onClick={async (ev) => {
                                        ev.stopPropagation();
                                        const confirmBlock = window.confirm(`Block ${u.displayName}? You will not receive messages from this user.`);
                                        if (!confirmBlock) return;
                                        try {
                                          const res = await fetch("/api/nova-connect/block", {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ blockedUserId: u.id }),
                                          });
                                          const data = await res.json();
                                          if (!data.success) alert(data.error ?? "Failed to block user.");
                                        } catch {
                                          alert("Failed to block user.");
                                        }
                                      }}
                                    >
                                      Block
                                    </button>
                                  </div>
                                )}
                              </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                      {novaConnectDmUserId && (
                        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white/90 dark:bg-zinc-900/70 p-3 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                              Private chat
                            </h4>
                            <button
                              type="button"
                              className="text-[10px] text-muted-foreground underline"
                              onClick={() => {
                                setNovaConnectDmUserId(null);
                                setNovaConnectDmMessages([]);
                                setNovaConnectDmInput("");
                              }}
                            >
                              Close
                            </button>
                          </div>
                          <div className="border border-zinc-200 dark:border-zinc-700 rounded-md p-2 max-h-44 overflow-y-auto space-y-1.5">
                            {novaConnectDmMessages.length === 0 ? (
                              <p className="text-[11px] text-muted-foreground">No messages yet.</p>
                            ) : (
                              novaConnectDmMessages.map((m) => (
                                <div key={m.id} className="text-[11px]">
                                  <span className="font-semibold">
                                    {m.fromUserId === (session?.user as { id?: string })?.id ? "You" : m.fromDisplayName}
                                  </span>
                                  {": "}
                                  <span>{m.content}</span>
                                </div>
                              ))
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              type="text"
                              value={novaConnectDmInput}
                              onChange={(e) => setNovaConnectDmInput(e.target.value)}
                              placeholder={isPaid ? "Type a private message…" : "Upgrade to Pro or VIP to send messages."}
                              className="flex-1 min-w-[140px] rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              disabled={!isPaid}
                            />
                            <Button
                              type="button"
                              size="sm"
                              disabled={!canUseNovaConnectPaidFeatures || novaConnectDmSending}
                              onClick={async () => {
                                if (!novaConnectDmUserId || !canUseNovaConnectPaidFeatures || !novaConnectRulesAccepted) return;
                                const text = novaConnectDmInput.trim();
                                if (!text) return;
                                setNovaConnectDmSending(true);
                                try {
                                  const res = await fetch("/api/nova-connect/messages", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ scope: "dm", toUserId: novaConnectDmUserId, content: text }),
                                  });
                                  const data = await res.json();
                                  if (data.success) {
                                    setNovaConnectDmInput("");
                                    await loadNovaConnectDm(novaConnectDmUserId);
                                  } else {
                                    alert(data.error ?? "Failed to send message.");
                                  }
                                } catch {
                                  alert("Failed to send message.");
                                } finally {
                                  setNovaConnectDmSending(false);
                                }
                              }}
                              className="bg-emerald-500 hover:bg-emerald-600 text-white dark:bg-emerald-600 dark:hover:bg-emerald-700"
                            >
                              {novaConnectDmSending ? "Sending…" : "Send"}
                            </Button>
                          </div>
                        </div>
                      )}
                      <div id="nova-connect-rules" ref={novaConnectRulesRef} className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-900/60 p-3 space-y-2">
                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Community rules (summary)</h3>
                        <ul className="text-xs text-zinc-700 dark:text-zinc-300 list-disc list-inside space-y-1">
                          <li>No insults, racism, hate speech, or harassment.</li>
                          <li>No spam, scams, or fake PnL screenshots.</li>
                          <li>No sharing private information without consent.</li>
                          <li>Respect other traders — disagree with ideas, not people.</li>
                          <li>Admins can mute, remove messages, or remove users from NovaConnect if rules are broken.</li>
                        </ul>
                      </div>
                      <div id="nova-connect-privacy" ref={novaConnectPrivacyRef} className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-900/60 p-3 space-y-2">
                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Presence &amp; privacy</h3>
                        <p className="text-xs text-zinc-700 dark:text-zinc-300">
                          Your preferred name is displayed to everyone on NovaConnect. We are not liable for any issues arising from your use of the service.
                        </p>
                        <p className="text-xs text-zinc-700 dark:text-zinc-300">
                          Use the Account page to set your preferred name, profile picture, and status (online, away, busy, offline).
                          You can leave NovaConnect at any time without closing your NovaStaris account.
                        </p>
                        <p className="text-xs text-zinc-700 dark:text-zinc-300">
                          Everyone can post in the community forum. Pro/VIP members (or users allowed by admin) can see online traders and send private messages.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : activeTab === "chris-clayton" ? (
              !isOwner ? (
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                  <p className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">Owner only</p>
                  <p className="mt-2 text-sm text-muted-foreground">Online Boss Strategy is available only to the owner.</p>
                </div>
              ) : (
              <div className="mx-3 sm:mx-6 py-6 sm:py-8 max-w-3xl">
                <h2 className="text-xl sm:text-2xl font-bold mb-2 bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 bg-clip-text text-transparent dark:from-amber-300 dark:via-orange-300 dark:to-amber-400">
                  Online Boss Strategy
                </h2>
                <div className="flex flex-wrap gap-2 mb-6">
                  <button
                    type="button"
                    onClick={() => setOnlineBossSubTab("chart")}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                      onlineBossSubTab === "chart"
                        ? "bg-amber-500 text-white dark:bg-amber-600"
                        : "bg-zinc-200/80 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    }`}
                  >
                    Chart analysis (SHORT)
                  </button>
                  <button
                    type="button"
                    onClick={() => setOnlineBossSubTab("demandFib")}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                      onlineBossSubTab === "demandFib"
                        ? "bg-amber-500 text-white dark:bg-amber-600"
                        : "bg-zinc-200/80 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    }`}
                  >
                    Demand + Fib playbook (LONG)
                  </button>
                </div>

                {onlineBossSubTab === "demandFib" ? (
                  <OnlineBossDemandFibPlaybook />
                ) : (
                <>
                <p className="text-sm text-muted-foreground mb-4">
                  Upload a chart (crypto futures or gold). NovaStaris AI Agent analyzes the descending channel, key level, V-shape bounce, and outputs SHORT / No setup with entry, TP1, TP2, SL. For coach calls only — no Telegram alert.
                </p>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="chris-clayton-chart" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Chart image (required)</label>
                    <input
                      id="chris-clayton-chart"
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      onChange={onChrisClaytonChartChange}
                      className="block w-full text-sm text-zinc-600 dark:text-zinc-400 file:mr-3 file:rounded-md file:border-0 file:bg-amber-50 file:px-3 file:py-2 file:text-amber-700 dark:file:bg-amber-950/50 dark:file:text-amber-300"
                    />
                    {chrisClaytonChartPreview && (
                      <div className="mt-2 rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden max-h-48">
                        <img src={chrisClaytonChartPreview} alt="Chart preview" className="w-full h-auto object-contain max-h-48" />
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="chris-clayton-symbol" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Symbol (optional)</label>
                      <input
                        id="chris-clayton-symbol"
                        type="text"
                        placeholder="e.g. BTCUSDT, XAUUSD"
                        value={chrisClaytonSymbol}
                        onChange={(e) => { setChrisClaytonSymbol(e.target.value); setChrisClaytonError(null); }}
                        className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="chris-clayton-asset" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Asset type</label>
                      <select
                        id="chris-clayton-asset"
                        value={chrisClaytonAssetType}
                        onChange={(e) => setChrisClaytonAssetType(e.target.value as "crypto" | "gold")}
                        className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      >
                        <option value="crypto">Crypto futures</option>
                        <option value="gold">Gold</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 items-center">
                  <Button
                    onClick={runChrisClaytonAnalysis}
                    disabled={chrisClaytonLoading}
                    className="bg-amber-500 hover:bg-amber-600 text-white dark:bg-amber-600 dark:hover:bg-amber-700"
                  >
                    {chrisClaytonLoading ? "Analyzing…" : "Analyze"}
                  </Button>
                </div>
                {chrisClaytonError && (
                  <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{chrisClaytonError}</p>
                )}
                {chrisClaytonResult && (
                  <div className="mt-6 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 p-5">
                    <div className="flex items-center gap-4 flex-wrap">
                      <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{chrisClaytonSymbol || "—"}</span>
                      <Badge
                        className={`text-sm font-bold px-3 py-1 ${
                          chrisClaytonResult.signal === "SHORT"
                            ? "bg-rose-500 text-white dark:bg-rose-600 border-0 hover:bg-rose-600 dark:hover:bg-rose-700"
                            : "bg-zinc-500 text-white dark:bg-zinc-600 border-0"
                        }`}
                      >
                        {chrisClaytonResult.signal}
                      </Badge>
                      <span className="text-lg font-medium text-muted-foreground">
                        Confluence {(chrisClaytonResult.confluenceScore * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <p><span className="text-muted-foreground">Entry:</span> <span className="font-medium">{chrisClaytonResult.entry}</span></p>
                      <p><span className="text-muted-foreground">TP1:</span> <span className="text-emerald-600 dark:text-emerald-400 font-medium">{chrisClaytonResult.tp1}</span></p>
                      <p><span className="text-muted-foreground">TP2:</span> <span className="text-emerald-600 dark:text-emerald-400 font-medium">{chrisClaytonResult.tp2}</span></p>
                      <p><span className="text-muted-foreground">SL:</span> <span className="text-rose-600 dark:text-rose-400 font-medium">{chrisClaytonResult.sl}</span></p>
                    </div>
                    {chrisClaytonResult.componentScores && Object.keys(chrisClaytonResult.componentScores).length > 0 && (
                      <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-600">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Component scores</p>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(chrisClaytonResult.componentScores).map(([k, v]) => (
                            <span key={k} className="text-xs px-2 py-1 rounded bg-zinc-200/80 dark:bg-zinc-700/80 text-zinc-700 dark:text-zinc-300">
                              {k.replace(/([A-Z])/g, " $1").trim()}: {(typeof v === "number" ? v * 100 : 0).toFixed(0)}%
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {chrisClaytonResult.summary && (
                      <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">{chrisClaytonResult.summary}</p>
                    )}
                    <ul className="mt-3 list-disc list-inside space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
                      {chrisClaytonResult.reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                    <div className="mt-4 space-y-3 pt-3 border-t border-zinc-200 dark:border-zinc-600">
                      <div className="flex flex-wrap gap-2 items-center">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const { title: t, content: c } = formatChrisClaytonForShare(chrisClaytonResult);
                            const full = [t, c].filter(Boolean).join("\n\n");
                            navigator.clipboard.writeText(full).then(() => {
                              setChrisClaytonCopied(true);
                              setTimeout(() => setChrisClaytonCopied(false), 2000);
                            });
                          }}
                          className="border-zinc-300 dark:border-zinc-600"
                        >
                          {chrisClaytonCopied ? "Copied!" : <><Copy className="h-3.5 w-3.5 mr-1.5 inline" /> Copy</>}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={chrisClaytonShareLoading}
                          onClick={async () => {
                            setChrisClaytonShareLoading(true);
                            setChrisClaytonShareSuccess(false);
                            try {
                              const { title: t, content: c } = formatChrisClaytonForShare(chrisClaytonResult);
                              const res = await fetch("/api/coach-calls", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ title: t, content: c }),
                              });
                              const data = await res.json();
                              if (data.success) {
                                setChrisClaytonShareSuccess(true);
                                setTimeout(() => setChrisClaytonShareSuccess(false), 3000);
                              } else {
                                alert(data.error ?? "Failed to share");
                              }
                            } catch {
                              alert("Failed to share");
                            } finally {
                              setChrisClaytonShareLoading(false);
                            }
                          }}
                          className="border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/50"
                        >
                          {chrisClaytonShareLoading ? "Sharing…" : chrisClaytonShareSuccess ? "Shared!" : <><Send className="h-3.5 w-3.5 mr-1.5 inline" /> Share to Coach Calls</>}
                        </Button>
                      </div>
                      <div className="pt-2 border-t border-dashed border-zinc-200 dark:border-zinc-700 space-y-2">
                        <span className="text-xs text-muted-foreground block">Was this Online Boss Strategy signal accurate?</span>
                        {onlineBossFeedbackSent ? (
                          <span className="text-xs text-emerald-600 dark:text-emerald-400 block">Thanks — feedback recorded.</span>
                        ) : (
                          <>
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={onlineBossFeedbackLoading}
                                onClick={async () => {
                                  const key = chrisClaytonSymbol.trim() || "chart";
                                  setOnlineBossFeedbackLoading(true);
                                  try {
                                    const res = await fetch("/api/admin/ai-feedback", {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({
                                        contractAddress: `online-boss:${key}`,
                                        outcome: "good",
                                        note: onlineBossFeedbackNote.trim() || undefined,
                                      }),
                                    });
                                    const data = await res.json();
                                    if (data.success) { setOnlineBossFeedbackSent("good"); setOnlineBossFeedbackNote(""); }
                                    else alert(data.error ?? "Failed to send feedback");
                                  } catch {
                                    alert("Failed to send feedback");
                                  } finally {
                                    setOnlineBossFeedbackLoading(false);
                                  }
                                }}
                                className="text-xs border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
                              >
                                Yes, worked well
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={onlineBossFeedbackLoading}
                                onClick={async () => {
                                  const key = chrisClaytonSymbol.trim() || "chart";
                                  setOnlineBossFeedbackLoading(true);
                                  try {
                                    const res = await fetch("/api/admin/ai-feedback", {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({
                                        contractAddress: `online-boss:${key}`,
                                        outcome: "bad",
                                        note: onlineBossFeedbackNote.trim() || undefined,
                                      }),
                                    });
                                    const data = await res.json();
                                    if (data.success) { setOnlineBossFeedbackSent("bad"); setOnlineBossFeedbackNote(""); }
                                    else alert(data.error ?? "Failed to send feedback");
                                  } catch {
                                    alert("Failed to send feedback");
                                  } finally {
                                    setOnlineBossFeedbackLoading(false);
                                  }
                                }}
                                className="text-xs border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                              >
                                No, needs work
                              </Button>
                            </div>
                            <textarea
                              value={onlineBossFeedbackNote}
                              onChange={(e) => setOnlineBossFeedbackNote(e.target.value)}
                              placeholder="Optional note for training (what worked or what missed)…"
                              rows={2}
                              className="w-full text-xs rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                            />
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                </>
                )}
              </div>
              )
            ) : activeTab === "narratives" ? (
              <div className="mx-3 sm:mx-6 py-6 sm:py-8">
                <NarrativesPanel />
              </div>
            ) : activeTab === "trading-bot" ? (
              (() => {
                const onDemand = !!(session?.user as { tradingBotOnDemand?: boolean } | undefined)?.tradingBotOnDemand;
                const canAccessTradingBot = isOwner || (isVip && onDemand);
                return !canAccessTradingBot ? (
                <div className="flex flex-col items-center justify-center py-20 px-6 text-center max-w-lg mx-auto">
                  <div className="rounded-2xl border border-amber-200/80 dark:border-amber-800/80 bg-gradient-to-b from-amber-50/80 to-white dark:from-amber-950/40 dark:to-zinc-900/80 p-8 shadow-lg">
                    <div className="mx-auto w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center mb-5">
                      <svg className="w-7 h-7 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-100">
                      NovaStaris AI Trading Bots — On demand
                    </h2>
                    <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                      The <strong className="text-zinc-700 dark:text-zinc-300">Crypto Futures Trading Bot</strong> (Blofin) is available as an <strong className="text-zinc-700 dark:text-zinc-300">on demand</strong> service. Access requires <strong className="text-amber-700 dark:text-amber-400">VIP</strong> plus <strong className="text-amber-700 dark:text-amber-400">On demand</strong>.
                    </p>
                    <p className="mt-4 text-sm text-muted-foreground">
                      Contact us to upgrade and get access to configurable bots, risk settings, and live or demo trading. Wallet tracking (meme coins + Top Leverage Traders) is under the Wallet Tracker tab.
                    </p>
                    <a
                      href="/support?subject=Trading%20Bot%20access%20request"
                      className="mt-6 inline-flex items-center justify-center rounded-lg bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-700 text-white font-medium px-5 py-2.5 text-sm transition-colors"
                    >
                      Contact for access
                    </a>
                  </div>
                </div>
                ) : (
                <div className="mx-3 sm:mx-6 mt-4 mb-3">
                  <p className="text-sm text-muted-foreground mb-3">Blofin futures bot: configure symbol, leverage, TP/SL; run demo or live. VIP + On demand.</p>
                  <TradingBotPanel mode="futures-only" />
                </div>
                );
              })()
            ) : activeTab === "polymarket-bot" ? (
              <div className="mx-3 sm:mx-6 mt-4 mb-3">
                <p className="text-sm text-muted-foreground mb-3">Nova Polymarket Bot as a standalone workspace.</p>
                <TradingBotPanel mode="polymarket-only" />
              </div>
            ) : activeTab === "prop-firm-bot" ? (
              (() => {
                const propFirmOnDemand = !!(session?.user as { propFirmBotOnDemand?: boolean } | undefined)?.propFirmBotOnDemand;
                const canAccessPropFirm = isOwner || (isVip && propFirmOnDemand);
                return !canAccessPropFirm ? (
                  <div className="flex flex-col items-center justify-center py-20 px-6 text-center max-w-lg mx-auto">
                    <div className="rounded-2xl border border-amber-200/80 dark:border-amber-800/80 bg-gradient-to-b from-amber-50/80 to-white dark:from-amber-950/40 dark:to-zinc-900/80 p-8 shadow-lg">
                      <div className="mx-auto w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center mb-5">
                        <Flame className="w-7 h-7 text-amber-600 dark:text-amber-400 animate-flame-flicker" aria-hidden />
                      </div>
                      <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-100">Nova Prop Firm Bot — On demand</h2>
                      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                        Prop-firm style challenge guardrails (Topstep-like profiles) are available for <strong className="text-amber-700 dark:text-amber-400">VIP</strong> subscribers when <strong className="text-amber-700 dark:text-amber-400">Nova Prop Firm Bot</strong> is enabled on your account.
                      </p>
                      <p className="mt-4 text-sm text-muted-foreground">Sign in with VIP and ask your admin to turn on access, or contact us to upgrade.</p>
                      <a
                        href="/support?subject=Nova%20Prop%20Firm%20Bot%20access%20request"
                        className="mt-6 inline-flex items-center justify-center rounded-lg bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-700 text-white font-medium px-5 py-2.5 text-sm transition-colors"
                      >
                        Contact for access
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="mx-3 sm:mx-6 mt-4 mb-3">
                    <p className="text-sm text-muted-foreground mb-3">
                      <Flame className="inline-block h-4 w-4 mr-1 flame-hot-tab -mt-0.5 text-amber-600 dark:text-amber-400" aria-hidden />
                      Nova Prop Firm Bot: discipline and rule guardrails for prop-style challenges. VIP on demand.
                    </p>
                    <PropFirmBotPanel />
                  </div>
                );
              })()
            ) : activeTab === "nova-forecast" ? (
              <div className="mx-6 py-6">
                <Tabs value={novaForecastSubTab} onValueChange={(v) => setNovaForecastSubTab(v as "agent" | "nova-smart" | "nova-q" | "nova-radar")} className="space-y-4">
                  <TabsList className="bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700/80 p-1 rounded-lg flex-wrap h-auto gap-1">
                    <TabsTrigger value="agent" className="rounded-md px-3 py-1.5 text-sm font-medium data-[state=inactive]:bg-transparent data-[state=inactive]:text-zinc-700 dark:data-[state=inactive]:text-zinc-300 data-[state=active]:bg-violet-500 data-[state=active]:text-white dark:data-[state=active]:bg-violet-600">
                      NovaForecast Agent
                    </TabsTrigger>
                    <TabsTrigger value="nova-smart" className="rounded-md px-3 py-1.5 text-sm font-medium data-[state=inactive]:bg-transparent data-[state=inactive]:text-zinc-700 dark:data-[state=inactive]:text-zinc-300 data-[state=active]:bg-violet-500 data-[state=active]:text-white dark:data-[state=active]:bg-violet-600">
                      NovaSmart Analysis
                    </TabsTrigger>
                    <TabsTrigger value="nova-q" className="rounded-md px-3 py-1.5 text-sm font-medium data-[state=inactive]:bg-transparent data-[state=inactive]:text-zinc-700 dark:data-[state=inactive]:text-zinc-300 data-[state=active]:bg-violet-500 data-[state=active]:text-white dark:data-[state=active]:bg-violet-600">
                      NovaQ
                    </TabsTrigger>
                    <TabsTrigger value="nova-radar" className="rounded-md px-3 py-1.5 text-sm font-medium data-[state=inactive]:bg-transparent data-[state=inactive]:text-zinc-700 dark:data-[state=inactive]:text-zinc-300 data-[state=active]:bg-violet-500 data-[state=active]:text-white dark:data-[state=active]:bg-violet-600">
                      NovaRadar
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="agent" className="mt-0">
                    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                        <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">NovaForecast Agent</h2>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">High / low for:</span>
                          <select
                            value={novaForecastRange}
                            onChange={(e) => {
                              const v = e.target.value;
                              setNovaForecastRange(v);
                              fetchNovaForecast(
                                novaForecastCustomSymbols.trim() ? novaForecastCustomSymbols.split(/[\s,]+/).map((s) => s.trim().toUpperCase()).filter(Boolean) : undefined,
                                v
                              );
                            }}
                            className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200"
                          >
                            <option value="15m">Last 15 mins</option>
                            <option value="1h">1 hour</option>
                            <option value="2h">2 hours</option>
                            <option value="4h">4 hours</option>
                            <option value="6h">6 hours</option>
                            <option value="10h">10 hours</option>
                            <option value="12h">12 hours</option>
                            <option value="24h">24 hours</option>
                            <option value="48h">48 hours</option>
                            <option value="1w">1 week</option>
                            <option value="2w">2 weeks</option>
                            <option value="3w">3 weeks</option>
                            <option value="4w">4 weeks</option>
                            <option value="5w">5 weeks</option>
                            <option value="6w">6 weeks</option>
                          </select>
                          <input
                            type="text"
                            placeholder="Custom symbols (e.g. INJ, SUI, TIA)"
                            value={novaForecastCustomSymbols}
                            onChange={(e) => setNovaForecastCustomSymbols(e.target.value)}
                            className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 w-48 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-500"
                          />
                          <Button variant="outline" size="sm" onClick={() => fetchNovaForecast(novaForecastCustomSymbols.trim() ? novaForecastCustomSymbols.split(/[\s,]+/).map((s) => s.trim().toUpperCase()).filter(Boolean) : undefined)} disabled={novaForecastLoading}>
                            {novaForecastCustomSymbols.trim() ? "Forecast custom" : "Refresh"}
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">High = short entry zone, low = long entry zone for the selected range. Default: 2 weeks. Top alts by default; add symbols for others (e.g. INJ, SUI).</p>
                      <p className="text-xs text-muted-foreground mb-3">
                        <strong className="text-zinc-700 dark:text-zinc-300">Insight meanings:</strong> <span className="text-rose-600 dark:text-rose-400">Bias: short on retest of high</span> = price is above range mid—look to short when price rallies to the high. <span className="text-emerald-600 dark:text-emerald-400">Bias: long on retest of low</span> = price is below range mid—look to long when price pulls back to the low.
                      </p>
                      {novaForecastError && (
                        <p className="text-sm text-rose-600 dark:text-rose-400 mb-3">{novaForecastError}</p>
                      )}
                      {novaForecastLoading && novaForecastItems.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Loading…</p>
                      ) : novaForecastItems.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No forecasts yet. Choose a range, hit Refresh, or enter symbols above.</p>
                      ) : (
                        <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs">Symbol</TableHead>
                                <TableHead className="text-right text-xs">High ({novaForecastRangeLabel})</TableHead>
                                <TableHead className="text-right text-xs">Low ({novaForecastRangeLabel})</TableHead>
                                <TableHead className="text-right text-xs">Short entry</TableHead>
                                <TableHead className="text-right text-xs">Long entry</TableHead>
                                <TableHead className="text-right text-xs">Price</TableHead>
                                <TableHead className="text-left text-xs">Insight</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {novaForecastItems.map((f, i) => (
                                <TableRow key={`${f.symbol}-${i}`}>
                                  <TableCell className="font-mono text-xs font-medium">{f.symbol}</TableCell>
                                  <TableCell className="text-right font-mono text-xs">${f.high > 0 ? f.high.toLocaleString(undefined, { maximumFractionDigits: 4, minimumFractionDigits: 2 }) : "—"}</TableCell>
                                  <TableCell className="text-right font-mono text-xs">${f.low > 0 ? f.low.toLocaleString(undefined, { maximumFractionDigits: 4, minimumFractionDigits: 2 }) : "—"}</TableCell>
                                  <TableCell className="text-right font-mono text-xs text-rose-600 dark:text-rose-400">${f.shortEntry > 0 ? f.shortEntry.toLocaleString(undefined, { maximumFractionDigits: 4, minimumFractionDigits: 2 }) : "—"}</TableCell>
                                  <TableCell className="text-right font-mono text-xs text-emerald-600 dark:text-emerald-400">${f.longEntry > 0 ? f.longEntry.toLocaleString(undefined, { maximumFractionDigits: 4, minimumFractionDigits: 2 }) : "—"}</TableCell>
                                  <TableCell className="text-right font-mono text-xs">{f.currentPrice != null ? "$" + f.currentPrice.toLocaleString(undefined, { maximumFractionDigits: 4, minimumFractionDigits: 2 }) : "—"}</TableCell>
                                  <TableCell className="text-left text-xs text-muted-foreground max-w-xs">{f.insight}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                  <TabsContent value="nova-smart" className="mt-0">
                    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
                      <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-2">NovaSmart Analysis</h2>
                      <p className="text-xs text-muted-foreground mb-4">Compare timeframes to see high/low per period, smart short/long entries, and whether to scalp (quick profit) or swing (hold for bigger move). Enter any symbol(s)—BTC, BTC/USDT, or ETH all work (pairs are normalized to the base symbol).</p>
                      <div className="flex flex-wrap items-center gap-4 mb-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">Timeframes:</span>
                          {["5m", "15m", "30m", "1h", "2h", "4h", "6h", "10h", "12h", "24h", "48h", "72h", "1w", "2w", "3w", "4w", "5w", "6w", "52w", "104w"].map((tf) => (
                            <label key={tf} className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={novaSmartTimeframes.includes(tf)}
                                onChange={() => {
                          const order = ["5m", "15m", "30m", "1h", "2h", "4h", "6h", "10h", "12h", "24h", "48h", "72h", "1w", "2w", "3w", "4w", "5w", "6w", "52w", "104w"];
                          setNovaSmartTimeframes((prev) => {
                            const next = prev.includes(tf) ? prev.filter((t) => t !== tf) : [...prev, tf];
                            return next.sort((a, b) => order.indexOf(a) - order.indexOf(b));
                          });
                        }}
                                className="rounded border-zinc-400 dark:border-zinc-500"
                              />
                              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{tf}</span>
                            </label>
                          ))}
                        </div>
                        <input
                          type="text"
                          placeholder="Symbol(s) e.g. BTC, ETH or INJ, SUI (optional; default: BTC, ETH, SOL)"
                          value={novaSmartCustomSymbol}
                          onChange={(e) => setNovaSmartCustomSymbol(e.target.value)}
                          className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 w-64 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-500"
                        />
                        <Button onClick={fetchNovaSmart} disabled={novaSmartLoading || novaSmartTimeframes.length === 0}>
                          {novaSmartLoading ? "Running…" : "Run NovaSmart"}
                        </Button>
                      </div>
                      {novaSmartTimeframes.length === 0 && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">Select at least one timeframe.</p>
                      )}
                      {novaSmartError && (
                        <p className="text-sm text-rose-600 dark:text-rose-400 mb-3">{novaSmartError}</p>
                      )}
                      {novaSmartResults.length === 0 && !novaSmartLoading && !novaSmartError && (
                        <p className="text-xs text-muted-foreground">Select timeframes, optionally enter symbol(s), then click Run NovaSmart.</p>
                      )}
                      {novaSmartResults.length > 0 && (
                        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
                          {novaSmartResults.map((r, idx) => (
                            <Card key={`${r.symbol}-${idx}`} className="border-zinc-200 dark:border-zinc-700">
                              <CardHeader className="py-3">
                                <CardTitle className="text-base font-mono">{r.symbol}</CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-3 text-sm">
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                  <div>
                                    <span className="text-muted-foreground">Smart short entry</span>
                                    <p className="font-mono text-rose-600 dark:text-rose-400">${r.smartShortEntry > 0 ? r.smartShortEntry.toLocaleString(undefined, { maximumFractionDigits: 4, minimumFractionDigits: 2 }) : "—"}</p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Smart long entry</span>
                                    <p className="font-mono text-emerald-600 dark:text-emerald-400">${r.smartLongEntry > 0 ? r.smartLongEntry.toLocaleString(undefined, { maximumFractionDigits: 4, minimumFractionDigits: 2 }) : "—"}</p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Current price</span>
                                    <p className="font-mono">{r.currentPrice != null ? "$" + r.currentPrice.toLocaleString(undefined, { maximumFractionDigits: 4, minimumFractionDigits: 2 }) : "—"}</p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Strategy</span>
                                    <p><Badge variant={r.strategy === "scalp" ? "default" : r.strategy === "swing" ? "secondary" : "outline"} className="capitalize">{r.strategy}</Badge></p>
                                  </div>
                                </div>
                                {r.timeframes.length > 0 && (
                                  <div>
                                    <span className="text-muted-foreground block mb-1">High / low per timeframe</span>
                                    <div className="flex flex-wrap gap-2">
                                      {r.timeframes.map((t) => (
                                        <span key={t.id} className="text-xs font-mono px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800"> {t.label}: H ${t.high.toLocaleString(undefined, { maximumFractionDigits: 4 })} / L ${t.low.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {(r.suggestedLongEntry > 0 || r.suggestedShortEntry > 0) && (
                                  <div className="rounded-md bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800 p-2">
                                    <span className="text-xs font-medium text-violet-800 dark:text-violet-200 block mb-1">Suggested entry & exit (for {r.strategy})</span>
                                    <p className="text-xs text-violet-700 dark:text-violet-300">{r.entryExitNote}</p>
                                    <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                                      <div><span className="text-muted-foreground">Long:</span> entry ${r.suggestedLongEntry > 0 ? r.suggestedLongEntry.toLocaleString(undefined, { maximumFractionDigits: 4 }) : "—"} → exit ${r.suggestedLongExit > 0 ? r.suggestedLongExit.toLocaleString(undefined, { maximumFractionDigits: 4 }) : "—"}</div>
                                      <div><span className="text-muted-foreground">Short:</span> entry ${r.suggestedShortEntry > 0 ? r.suggestedShortEntry.toLocaleString(undefined, { maximumFractionDigits: 4 }) : "—"} → exit ${r.suggestedShortExit > 0 ? r.suggestedShortExit.toLocaleString(undefined, { maximumFractionDigits: 4 }) : "—"}</div>
                                    </div>
                                  </div>
                                )}
                                {r.recommendationNote && (
                                  <div className={`rounded-md border p-2 text-xs ${r.recommendedDirection === "long" ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800" : r.recommendedDirection === "short" ? "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800" : "bg-zinc-100 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700"}`}>
                                    <span className={`font-medium block mb-1 ${r.recommendedDirection === "long" ? "text-emerald-800 dark:text-emerald-200" : r.recommendedDirection === "short" ? "text-rose-800 dark:text-rose-200" : "text-zinc-700 dark:text-zinc-300"}`}>
                                      Best entry: {r.recommendedDirection === "long" ? "Long" : r.recommendedDirection === "short" ? "Short" : "Neutral"}
                                    </span>
                                    <p className={r.recommendedDirection === "long" ? "text-emerald-700 dark:text-emerald-300" : r.recommendedDirection === "short" ? "text-rose-700 dark:text-rose-300" : "text-muted-foreground"}>{r.recommendationNote}</p>
                                  </div>
                                )}
                                <p className="text-xs text-muted-foreground">{r.strategyNote}</p>
                                {isOwner && (
                                  <div className="flex items-center gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-700">
                                    <span className="text-xs text-muted-foreground">Did it work?</span>
                                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={async () => { await submitNovaSmartFeedback(r.symbol, r.strategy, true); setNovaSmartFeedbackSent((prev) => new Set(prev).add(`${r.symbol}-${r.strategy}`)); }} disabled={novaSmartFeedbackSent.has(`${r.symbol}-${r.strategy}`)}>Yes</Button>
                                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={async () => { await submitNovaSmartFeedback(r.symbol, r.strategy, false); setNovaSmartFeedbackSent((prev) => new Set(prev).add(`${r.symbol}-${r.strategy}`)); }} disabled={novaSmartFeedbackSent.has(`${r.symbol}-${r.strategy}`)}>No</Button>
                                    {novaSmartFeedbackSent.has(`${r.symbol}-${r.strategy}`) && <span className="text-xs text-emerald-600 dark:text-emerald-400">Thanks</span>}
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                  </TabsContent>
                  <TabsContent value="nova-q" className="mt-0">
                    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
                      <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-2">NovaQ (NovaIntelligence)</h2>
                      <p className="text-xs text-muted-foreground mb-4">Select timeframe(s), enter a contract symbol (for example BTC), then run NovaQ to get support/resistance levels and current market direction from market structure.</p>
                      <div className="flex flex-wrap items-center gap-4 mb-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">Timeframes:</span>
                          {["5m", "15m", "30m", "1h", "2h", "4h", "6h", "10h", "12h", "24h", "48h", "72h", "1w", "2w", "3w", "4w", "5w", "6w", "52w", "104w"].map((tf) => (
                            <label key={`nova-q-${tf}`} className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={novaQTimeframes.includes(tf)}
                                onChange={() => {
                                  const order = ["5m", "15m", "30m", "1h", "2h", "4h", "6h", "10h", "12h", "24h", "48h", "72h", "1w", "2w", "3w", "4w", "5w", "6w", "52w", "104w"];
                                  setNovaQTimeframes((prev) => {
                                    const next = prev.includes(tf) ? prev.filter((t) => t !== tf) : [...prev, tf];
                                    return next.sort((a, b) => order.indexOf(a) - order.indexOf(b));
                                  });
                                }}
                                className="rounded border-zinc-400 dark:border-zinc-500"
                              />
                              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{tf}</span>
                            </label>
                          ))}
                        </div>
                        <input
                          type="text"
                          placeholder="Contract symbol e.g. BTC"
                          value={novaQSymbol}
                          onChange={(e) => setNovaQSymbol(e.target.value.toUpperCase())}
                          className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 w-56 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-500"
                        />
                        <Button onClick={fetchNovaQ} disabled={novaQLoading || novaQTimeframes.length === 0 || !novaQSymbol.trim()}>
                          {novaQLoading ? "Running…" : "Run NovaQ"}
                        </Button>
                      </div>
                      {novaQTimeframes.length === 0 && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">Select at least one timeframe.</p>
                      )}
                      {novaQError && (
                        <p className="text-sm text-rose-600 dark:text-rose-400 mb-3">{novaQError}</p>
                      )}
                      {!novaQLoading && !novaQError && !novaQResult && (
                        <p className="text-xs text-muted-foreground">Choose timeframe(s), enter a symbol, then click Run NovaQ.</p>
                      )}
                      {novaQResult && (
                        <div className="space-y-4">
                          <div className="rounded-md border border-zinc-200 dark:border-zinc-700 p-3 bg-zinc-50/60 dark:bg-zinc-900/30">
                            <div className="flex flex-wrap items-center gap-3">
                              <span className="font-mono text-sm font-semibold text-zinc-800 dark:text-zinc-200">{novaQResult.symbol}</span>
                              <span className="text-xs text-muted-foreground">Price: {novaQResult.currentPrice != null ? `$${novaQResult.currentPrice.toLocaleString(undefined, { maximumFractionDigits: 4, minimumFractionDigits: 2 })}` : "—"}</span>
                              <Badge
                                variant="outline"
                                className={
                                  novaQResult.marketDirection === "bullish"
                                    ? "border-emerald-500/60 text-emerald-700 dark:text-emerald-300"
                                    : novaQResult.marketDirection === "bearish"
                                      ? "border-rose-500/60 text-rose-700 dark:text-rose-300"
                                      : "border-zinc-400/60 text-zinc-700 dark:text-zinc-300"
                                }
                              >
                                Market direction: {novaQResult.marketDirection}
                              </Badge>
                            </div>
                            <p className="mt-2 text-xs text-muted-foreground">
                              Direction guide: <span className="text-emerald-600 dark:text-emerald-400">bullish</span> means closes trend higher across selected timeframes, <span className="text-rose-600 dark:text-rose-400">bearish</span> means closes trend lower, and <span className="text-zinc-600 dark:text-zinc-300">sideways</span> means mixed or flat structure.
                            </p>
                          </div>
                          {novaQResult.timeframes.length === 0 ? (
                            <p className="text-xs text-muted-foreground">No timeframe data returned. Try another symbol or timeframe mix.</p>
                          ) : (
                            <div className="overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="text-xs">Timeframe</TableHead>
                                    <TableHead className="text-right text-xs">Support</TableHead>
                                    <TableHead className="text-right text-xs">Resistance</TableHead>
                                    <TableHead className="text-left text-xs">Direction</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {novaQResult.timeframes.map((tf) => (
                                    <TableRow key={`nova-q-row-${tf.id}`}>
                                      <TableCell className="text-xs font-medium">{tf.label}</TableCell>
                                      <TableCell className="text-right font-mono text-xs text-emerald-600 dark:text-emerald-400">${tf.support.toLocaleString(undefined, { maximumFractionDigits: 4, minimumFractionDigits: 2 })}</TableCell>
                                      <TableCell className="text-right font-mono text-xs text-rose-600 dark:text-rose-400">${tf.resistance.toLocaleString(undefined, { maximumFractionDigits: 4, minimumFractionDigits: 2 })}</TableCell>
                                      <TableCell className="text-xs">
                                        <Badge variant="outline" className={tf.direction === "bullish" ? "border-emerald-500/60 text-emerald-700 dark:text-emerald-300" : tf.direction === "bearish" ? "border-rose-500/60 text-rose-700 dark:text-rose-300" : "border-zinc-400/60 text-zinc-700 dark:text-zinc-300"}>
                                          {tf.direction}
                                        </Badge>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </TabsContent>
                  <TabsContent value="nova-radar" className="mt-0">
                    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
                      <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-2">NovaRadar (limit orders)</h2>
                      <p className="text-xs text-muted-foreground mb-4">
                        VIP only. Pick a perp contract, your limit price, and Long or Short. NovaRadar reads market structure (multi-timeframe), trend, and recent volatility to say whether the level looks realistic, whether price likely needs to rally or dip to get there, and an illustrative date band—not a guarantee.
                      </p>
                      <div className="flex flex-wrap items-end gap-3 mb-4">
                        <div>
                          <label className="text-xs text-muted-foreground block mb-1">Contract</label>
                          <input
                            type="text"
                            placeholder="e.g. BTC"
                            value={novaRadarSymbol}
                            onChange={(e) => setNovaRadarSymbol(e.target.value.toUpperCase())}
                            className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 w-28 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-500"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground block mb-1">Limit price ($)</label>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="e.g. 67000"
                            value={novaRadarTarget}
                            onChange={(e) => setNovaRadarTarget(e.target.value)}
                            className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 w-36 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-500"
                          />
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground block mb-1">Side</span>
                          <div className="flex rounded-md border border-zinc-300 dark:border-zinc-600 overflow-hidden">
                            <button
                              type="button"
                              onClick={() => setNovaRadarSide("long")}
                              className={`px-3 py-1.5 text-sm font-medium ${novaRadarSide === "long" ? "bg-emerald-500 text-white dark:bg-emerald-600" : "bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"}`}
                            >
                              Long
                            </button>
                            <button
                              type="button"
                              onClick={() => setNovaRadarSide("short")}
                              className={`px-3 py-1.5 text-sm font-medium ${novaRadarSide === "short" ? "bg-rose-500 text-white dark:bg-rose-600" : "bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"}`}
                            >
                              Short
                            </button>
                          </div>
                        </div>
                        <Button onClick={fetchNovaRadar} disabled={novaRadarLoading || !novaRadarSymbol.trim()}>
                          {novaRadarLoading ? "Running…" : "Run NovaRadar"}
                        </Button>
                      </div>
                      {novaRadarError && (
                        <p className="text-sm text-rose-600 dark:text-rose-400 mb-3">{novaRadarError}</p>
                      )}
                      {!novaRadarLoading && !novaRadarError && !novaRadarResult && (
                        <p className="text-xs text-muted-foreground">Enter contract, limit price, side, then Run NovaRadar. Unrealistic levels are flagged immediately.</p>
                      )}
                      {novaRadarResult && (
                        <div className="space-y-4">
                          <div className="rounded-md border border-zinc-200 dark:border-zinc-700 p-3 bg-zinc-50/60 dark:bg-zinc-900/30">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <span className="font-mono text-sm font-semibold">{novaRadarResult.symbol}</span>
                              <Badge variant="outline" className={novaRadarResult.side === "long" ? "border-emerald-500/60 text-emerald-700 dark:text-emerald-300" : "border-rose-500/60 text-rose-700 dark:text-rose-300"}>
                                {novaRadarResult.side === "long" ? "Long limit" : "Short limit"}
                              </Badge>
                              <Badge
                                variant="outline"
                                className={
                                  novaRadarResult.realism === "unrealistic"
                                    ? "border-rose-600/80 text-rose-800 dark:text-rose-200"
                                    : novaRadarResult.realism === "stretched"
                                      ? "border-amber-500/60 text-amber-800 dark:text-amber-200"
                                      : "border-emerald-500/60 text-emerald-800 dark:text-emerald-200"
                                }
                              >
                                {novaRadarResult.realism === "unrealistic" ? "Unrealistic" : novaRadarResult.realism === "stretched" ? "Stretched" : "Plausible"}
                              </Badge>
                            </div>
                            <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">{novaRadarResult.summary}</p>
                          </div>
                          {novaRadarResult.caveats.length > 0 && (
                            <div className="rounded-md border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/30 p-3">
                              <p className="text-xs font-medium text-amber-900 dark:text-amber-200 mb-1">Flags</p>
                              <ul className="text-xs text-amber-900/90 dark:text-amber-100/90 list-disc pl-4 space-y-1">
                                {novaRadarResult.caveats.map((c) => (
                                  <li key={c}>{c}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                            <div className="rounded-md border border-zinc-200 dark:border-zinc-700 p-3">
                              <span className="text-xs text-muted-foreground">Spot</span>
                              <p className="font-mono">${novaRadarResult.currentPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })}</p>
                              <span className="text-xs text-muted-foreground mt-2 block">Limit</span>
                              <p className="font-mono">${novaRadarResult.targetPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })}</p>
                            </div>
                            <div className="rounded-md border border-zinc-200 dark:border-zinc-700 p-3">
                              <span className="text-xs text-muted-foreground">Path vs spot</span>
                              <p className="capitalize">{novaRadarResult.pricePath === "at_target" ? "Already near level" : novaRadarResult.pricePath === "up" ? "Needs higher prices" : "Needs lower prices"}</p>
                              <span className="text-xs text-muted-foreground mt-2 block">Structure vs path</span>
                              <p className="capitalize">{novaRadarResult.structureAlignment.replace("_", " ")}</p>
                            </div>
                          </div>
                          {novaRadarResult.estimatedReachDateEarly && novaRadarResult.estimatedReachDateLate && novaRadarResult.optimisticDays != null && novaRadarResult.pessimisticDays != null && (
                            <div className="rounded-md border border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/30 p-3">
                              <p className="text-xs font-medium text-violet-900 dark:text-violet-200 mb-1">Illustrative date band</p>
                              <p className="text-sm font-mono text-violet-800 dark:text-violet-100">
                                {novaRadarResult.estimatedReachDateEarly} → {novaRadarResult.estimatedReachDateLate}{" "}
                                <span className="text-xs font-sans text-muted-foreground">(~{novaRadarResult.optimisticDays}–{novaRadarResult.pessimisticDays} days)</span>
                              </p>
                            </div>
                          )}
                          {novaRadarResult.range52w && (
                            <p className="text-xs text-muted-foreground">
                              ~1y range (loaded history): ${novaRadarResult.range52w.low.toLocaleString(undefined, { maximumFractionDigits: 4 })} – ${novaRadarResult.range52w.high.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                            </p>
                          )}
                          {novaRadarResult.structureTimeframes.length > 0 && (
                            <div className="overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="text-xs">TF</TableHead>
                                    <TableHead className="text-right text-xs">Support</TableHead>
                                    <TableHead className="text-right text-xs">Resistance</TableHead>
                                    <TableHead className="text-left text-xs">Bias</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {novaRadarResult.structureTimeframes.map((tf) => (
                                    <TableRow key={tf.id}>
                                      <TableCell className="text-xs">{tf.label}</TableCell>
                                      <TableCell className="text-right font-mono text-xs text-emerald-600 dark:text-emerald-400">${tf.support.toLocaleString(undefined, { maximumFractionDigits: 4 })}</TableCell>
                                      <TableCell className="text-right font-mono text-xs text-rose-600 dark:text-rose-400">${tf.resistance.toLocaleString(undefined, { maximumFractionDigits: 4 })}</TableCell>
                                      <TableCell className="text-xs capitalize">{tf.direction}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          )}
                          <p className="text-[11px] text-muted-foreground leading-relaxed border-t border-zinc-200 dark:border-zinc-700 pt-3">{novaRadarResult.disclaimer}</p>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            ) : activeTab === "nova-plus" ? (
              <div className="mx-6 py-6">
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
                  <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-2">Nova+ Risk Management</h2>
                  <p className="text-xs text-muted-foreground mb-4">
                    Enter contract, optional account amount, optional risk % per trade (defaults to 1% if left blank), optional target $ profit at take-profit, leverage, and timeframe. Default size uses your risk % of account at the stop; target profit sizes toward a $ gain at TP (capped by that risk budget when account is set).
                  </p>
                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    <input
                      type="text"
                      placeholder="Contract symbol e.g. BTC"
                      value={novaPlusSymbol}
                      onChange={(e) => setNovaPlusSymbol(e.target.value.toUpperCase())}
                      className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 w-56 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-500"
                    />
                    <input
                      type="number"
                      placeholder="Account amount (optional)"
                      value={novaPlusAmount}
                      onChange={(e) => setNovaPlusAmount(e.target.value)}
                      className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 w-56 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-500"
                    />
                    <input
                      type="number"
                      min={0.01}
                      max={50}
                      step={0.01}
                      placeholder="Risk % per trade (optional, default 1)"
                      value={novaPlusRiskPct}
                      onChange={(e) => setNovaPlusRiskPct(e.target.value)}
                      className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 w-52 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-500"
                      title="Optional. Fraction of account at risk to the stop for default sizing. Leave blank for 1%."
                    />
                    <input
                      type="number"
                      min={0.01}
                      step={0.01}
                      placeholder="Target $ profit at TP (optional)"
                      value={novaPlusTargetProfit}
                      onChange={(e) => setNovaPlusTargetProfit(e.target.value)}
                      className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 w-52 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-500"
                      title="Optional. Sizes position so profit at the suggested take-profit ≈ this amount (capped by your risk % to the stop if account is set)."
                    />
                    <input
                      type="number"
                      min={1}
                      max={125}
                      step={1}
                      placeholder="Leverage (optional)"
                      value={novaPlusLeverage}
                      onChange={(e) => setNovaPlusLeverage(e.target.value)}
                      className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 w-44 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-500"
                      title="Optional. Used to estimate margin and return on margin (ROE%). 1–125×."
                    />
                    <select
                      value={novaPlusTimeframe}
                      onChange={(e) => setNovaPlusTimeframe(e.target.value)}
                      className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200"
                    >
                      {["15m", "1h", "2h", "4h", "6h", "12h", "24h", "48h", "72h", "1w", "2w", "4w", "52w", "104w"].map((tf) => (
                        <option key={`nova-plus-${tf}`} value={tf}>{tf}</option>
                      ))}
                    </select>
                    <Button onClick={fetchNovaPlus} disabled={novaPlusLoading || !novaPlusSymbol.trim()}>
                      {novaPlusLoading ? "Running…" : "Run Nova+"}
                    </Button>
                  </div>
                  {novaPlusError && (
                    <p className="text-sm text-rose-600 dark:text-rose-400 mb-3">{novaPlusError}</p>
                  )}
                  {!novaPlusLoading && !novaPlusError && !novaPlusResult && (
                    <p className="text-xs text-muted-foreground">Enter symbol and timeframe, then click Run Nova+.</p>
                  )}
                  {novaPlusResult && (() => {
                    const inferredSetup: "long" | "short" =
                      novaPlusResult.tradeSetup ??
                      (novaPlusResult.recommendedTakeProfit > novaPlusResult.recommendedEntry &&
                      novaPlusResult.recommendedStopLoss < novaPlusResult.recommendedEntry
                        ? "long"
                        : novaPlusResult.recommendedTakeProfit < novaPlusResult.recommendedEntry &&
                            novaPlusResult.recommendedStopLoss > novaPlusResult.recommendedEntry
                          ? "short"
                          : novaPlusResult.recommendedTakeProfit >= novaPlusResult.recommendedEntry
                            ? "long"
                            : "short");
                    return (
                    <div className="space-y-4">
                      <div className="rounded-md border border-zinc-200 dark:border-zinc-700 p-3 bg-zinc-50/60 dark:bg-zinc-900/30">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="font-mono text-sm font-semibold text-zinc-800 dark:text-zinc-200">{novaPlusResult.symbol}</span>
                          <Badge variant="outline">TF: {novaPlusResult.timeframeLabel}</Badge>
                          <span className="text-xs text-muted-foreground">Price: ${novaPlusResult.currentPrice.toLocaleString(undefined, { maximumFractionDigits: 4, minimumFractionDigits: 2 })}</span>
                          <Badge variant="outline" className={novaPlusResult.bias === "long" ? "border-emerald-500/60 text-emerald-700 dark:text-emerald-300" : novaPlusResult.bias === "short" ? "border-rose-500/60 text-rose-700 dark:text-rose-300" : "border-zinc-400/60 text-zinc-700 dark:text-zinc-300"}>
                            Structure bias: {novaPlusResult.bias}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={
                              inferredSetup === "long"
                                ? "border-emerald-600/70 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 font-medium"
                                : "border-rose-600/70 bg-rose-500/10 text-rose-800 dark:text-rose-200 font-medium"
                            }
                          >
                            Trade table: {inferredSetup === "long" ? "Long (buy)" : "Short (sell)"}
                          </Badge>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">{novaPlusResult.analysis}</p>
                        {novaPlusResult.tradeLevelsContext && (
                          <p className="mt-2 text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed border-t border-zinc-200/80 dark:border-zinc-600/80 pt-2">
                            {novaPlusResult.tradeLevelsContext}
                          </p>
                        )}
                        {novaPlusResult.tradeSetupSummary ? (
                          <p className="mt-2 text-xs text-zinc-700 dark:text-zinc-200 border-t border-zinc-200/80 dark:border-zinc-600/80 pt-2">
                            {novaPlusResult.tradeSetupSummary}
                          </p>
                        ) : (
                          <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400 border-t border-zinc-200/80 dark:border-zinc-600/80 pt-2">
                            {inferredSetup === "long"
                              ? "How to read: stop is below entry and target is above → long (buy) idea."
                              : "How to read: stop is above entry and target is below → short (sell) idea."}
                          </p>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="rounded-md border border-zinc-200 dark:border-zinc-700 p-3">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <h3 className="text-sm font-semibold">Trade Levels</h3>
                            <span
                              className={
                                inferredSetup === "long"
                                  ? "text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300"
                                  : "text-[11px] font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300"
                              }
                            >
                              {inferredSetup === "long" ? "Long setup" : "Short setup"}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">
                            Red = stop (invalidation). Green = profit target. Numbers describe a {inferredSetup === "long" ? "long" : "short"} position at entry.
                          </p>
                          <p className="text-xs">Entry: <span className="font-mono">${novaPlusResult.recommendedEntry.toLocaleString(undefined, { maximumFractionDigits: 4, minimumFractionDigits: 2 })}</span></p>
                          <p className="text-xs">
                            Stop (structure / invalidation):{" "}
                            <span className="font-mono text-rose-600 dark:text-rose-400">
                              ${novaPlusResult.recommendedStopLoss.toLocaleString(undefined, { maximumFractionDigits: 4, minimumFractionDigits: 2 })}
                            </span>{" "}
                            <span className="text-muted-foreground">
                              ({novaPlusResult.stopLossDistancePct.toFixed(2)}% price move from entry — not account risk %)
                            </span>
                          </p>
                          <p className="text-xs">Take profit: <span className="font-mono text-emerald-600 dark:text-emerald-400">${novaPlusResult.recommendedTakeProfit.toLocaleString(undefined, { maximumFractionDigits: 4, minimumFractionDigits: 2 })}</span></p>
                          {novaPlusResult.userInputAlignedLevels &&
                            (novaPlusResult.userInputAlignedLevels.stopForFullRiskBudget != null ||
                              novaPlusResult.userInputAlignedLevels.takeProfitForTargetUsd != null) && (
                              <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-600 space-y-1">
                                <p className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-200">
                                  Your inputs at the suggested size (dollar math)
                                </p>
                                <p className="text-[11px] text-muted-foreground leading-relaxed">{novaPlusResult.userInputAlignedLevels.note}</p>
                                {novaPlusResult.userInputAlignedLevels.stopForFullRiskBudget != null && (
                                  <p className="text-xs">
                                    Stop if full {novaPlusResult.riskManagement.maxRiskPctPerTrade}% risk budget:{" "}
                                    <span className="font-mono text-rose-600 dark:text-rose-400">
                                      $
                                      {novaPlusResult.userInputAlignedLevels.stopForFullRiskBudget.toLocaleString(undefined, {
                                        maximumFractionDigits: 4,
                                        minimumFractionDigits: 2,
                                      })}
                                    </span>
                                    {novaPlusResult.userInputAlignedLevels.stopPctFromEntry != null && (
                                      <span className="text-muted-foreground text-[11px]">
                                        {" "}
                                        ({novaPlusResult.userInputAlignedLevels.stopPctFromEntry.toFixed(2)}% from entry)
                                      </span>
                                    )}
                                  </p>
                                )}
                                {novaPlusResult.userInputAlignedLevels.takeProfitForTargetUsd != null && (
                                  <p className="text-xs">
                                    TP for your target $ profit:{" "}
                                    <span className="font-mono text-emerald-600 dark:text-emerald-400">
                                      $
                                      {novaPlusResult.userInputAlignedLevels.takeProfitForTargetUsd.toLocaleString(undefined, {
                                        maximumFractionDigits: 4,
                                        minimumFractionDigits: 2,
                                      })}
                                    </span>
                                    {novaPlusResult.userInputAlignedLevels.takeProfitPctFromEntry != null && (
                                      <span className="text-muted-foreground text-[11px]">
                                        {" "}
                                        ({novaPlusResult.userInputAlignedLevels.takeProfitPctFromEntry.toFixed(2)}% from entry)
                                      </span>
                                    )}
                                  </p>
                                )}
                              </div>
                            )}
                          <p className="text-xs">
                            R:R{" "}
                            <span className="font-mono" title="Risk:reward — see note below">
                              {novaPlusResult.riskReward.toFixed(2)}×
                            </span>
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
                            {novaPlusResult.riskRewardExplained ??
                              `Risk:reward compares distance to target vs distance to stop. ${novaPlusResult.riskReward.toFixed(2)}× means the target is about ${novaPlusResult.riskReward.toFixed(2)}× as far as the stop—roughly $${novaPlusResult.riskReward.toFixed(2)} of reward per $1.00 risked to the stop if both distances played out in proportion.`}
                          </p>
                        </div>
                        <div className="rounded-md border border-zinc-200 dark:border-zinc-700 p-3">
                          <h3 className="text-sm font-semibold mb-2">Risk Management</h3>
                          <p className="text-xs">Max risk/trade (plan): {novaPlusResult.riskManagement.maxRiskPctPerTrade}% of account</p>
                          {novaPlusResult.riskManagement.riskCapUsd != null && (
                            <p className="text-xs text-muted-foreground">
                              {novaPlusResult.riskManagement.maxRiskPctPerTrade}% risk budget:{" "}
                              <span className="font-mono">${novaPlusResult.riskManagement.riskCapUsd.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}</span>
                            </p>
                          )}
                          <p className="text-xs">
                            Est. $ if stop hits (this size):{" "}
                            {novaPlusResult.riskManagement.suggestedRiskAmount != null ? (
                              <span className="font-mono">
                                ${novaPlusResult.riskManagement.suggestedRiskAmount.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}
                              </span>
                            ) : (
                              "Enter account and/or target profit at TP"
                            )}
                            {novaPlusResult.riskManagement.accountAmount != null &&
                              novaPlusResult.riskManagement.suggestedRiskAmount != null && (
                                <span className="text-muted-foreground">
                                  {" "}
                                  (
                                  {(
                                    (novaPlusResult.riskManagement.suggestedRiskAmount / novaPlusResult.riskManagement.accountAmount) *
                                    100
                                  ).toFixed(2)}
                                  % of account)
                                </span>
                              )}
                          </p>
                          <p className="text-xs">
                            Suggested position size:{" "}
                            {novaPlusResult.riskManagement.suggestedPositionSize != null
                              ? `${novaPlusResult.riskManagement.suggestedPositionSize.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${novaPlusResult.symbol}`
                              : "Enter account and/or target profit at TP"}
                          </p>
                          {novaPlusResult.riskManagement.sizingNote && (
                            <p className="text-[11px] text-cyan-800/90 dark:text-cyan-200/90 mt-1 leading-relaxed">
                              {novaPlusResult.riskManagement.sizingNote}
                            </p>
                          )}
                          {novaPlusResult.pnlPreview ? (
                            <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-600 space-y-1">
                              <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200">Est. P&amp;L (this size, excl. fees)</p>
                              <p className="text-xs">
                                If take profit:{" "}
                                <span className="font-mono text-emerald-600 dark:text-emerald-400">
                                  +${novaPlusResult.pnlPreview.profitIfTakeProfitUsd.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}
                                </span>
                              </p>
                              <p className="text-xs">
                                If stop loss:{" "}
                                <span className="font-mono text-rose-600 dark:text-rose-400">
                                  −${novaPlusResult.pnlPreview.lossIfStopUsd.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}
                                </span>
                              </p>
                              <p className="text-xs">
                                Position notional (size × price):{" "}
                                <span className="font-mono">
                                  ≈ ${novaPlusResult.pnlPreview.notionalUsd.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}
                                </span>
                              </p>
                              {novaPlusResult.pnlPreview.notionalFromSizingExplanation && (
                                <p className="text-[11px] text-muted-foreground leading-relaxed">
                                  {novaPlusResult.pnlPreview.notionalFromSizingExplanation}
                                </p>
                              )}
                              {novaPlusResult.pnlPreview.theoreticalMaxNotionalIfFullAccountUsd != null &&
                                novaPlusResult.riskManagement.accountAmount != null && (
                                  <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                    Compare: if you used the <strong>entire</strong> ${novaPlusResult.riskManagement.accountAmount.toLocaleString()} account as
                                    margin at {novaPlusResult.pnlPreview.leverage}×, theoretical exposure cap is ≈{" "}
                                    <span className="font-mono">
                                      $
                                      {novaPlusResult.pnlPreview.theoreticalMaxNotionalIfFullAccountUsd.toLocaleString(undefined, {
                                        maximumFractionDigits: 0,
                                      })}
                                    </span>
                                    . This trade is sized from your 1% stop risk, so actual notional is lower.
                                  </p>
                                )}
                              {novaPlusResult.pnlPreview.leverage != null && novaPlusResult.pnlPreview.estimatedMarginUsd != null ? (
                                <>
                                  <p className="text-xs">
                                    Est. margin ({novaPlusResult.pnlPreview.leverage}×):{" "}
                                    <span className="font-mono">${novaPlusResult.pnlPreview.estimatedMarginUsd.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}</span>
                                    {novaPlusResult.pnlPreview.marginPctOfAccount != null && (
                                      <span className="text-muted-foreground">
                                        {" "}
                                        (~{novaPlusResult.pnlPreview.marginPctOfAccount.toFixed(1)}% of account)
                                      </span>
                                    )}
                                  </p>
                                  {novaPlusResult.pnlPreview.estimatedLiquidationPx != null &&
                                    novaPlusResult.pnlPreview.liquidationDistanceFromEntryPct != null && (
                                      <p className="text-xs">
                                        Est. liquidation (isolated approx.):{" "}
                                        <span className="font-mono text-amber-700 dark:text-amber-300">
                                          $
                                          {novaPlusResult.pnlPreview.estimatedLiquidationPx.toLocaleString(undefined, {
                                            maximumFractionDigits: 2,
                                            minimumFractionDigits: 2,
                                          })}
                                        </span>
                                        <span className="text-muted-foreground">
                                          {" "}
                                          ({novaPlusResult.pnlPreview.liquidationDistanceFromEntryPct >= 0 ? "+" : ""}
                                          {novaPlusResult.pnlPreview.liquidationDistanceFromEntryPct.toFixed(2)}% from entry)
                                        </span>
                                      </p>
                                    )}
                                  {novaPlusResult.pnlPreview.estimatedLiquidationPx == null && (
                                    <p className="text-[11px] text-muted-foreground">
                                      Est. liquidation not computed for this shape—use your exchange&apos;s risk tab for exact liq.
                                    </p>
                                  )}
                                  {novaPlusResult.pnlPreview.liquidationDisclaimer && (
                                    <p className="text-[11px] text-muted-foreground">{novaPlusResult.pnlPreview.liquidationDisclaimer}</p>
                                  )}
                                  {novaPlusResult.pnlPreview.returnOnMarginIfTpPct != null && (
                                    <p className="text-xs">
                                      ROE if TP:{" "}
                                      <span className="font-mono text-emerald-600 dark:text-emerald-400">
                                        +{novaPlusResult.pnlPreview.returnOnMarginIfTpPct.toFixed(1)}%
                                      </span>
                                    </p>
                                  )}
                                  {novaPlusResult.pnlPreview.returnOnMarginIfSlPct != null && (
                                    <p className="text-xs">
                                      ROE if stop:{" "}
                                      <span className="font-mono text-rose-600 dark:text-rose-400">
                                        {novaPlusResult.pnlPreview.returnOnMarginIfSlPct.toFixed(1)}%
                                      </span>
                                    </p>
                                  )}
                                </>
                              ) : (
                                <p className="text-[11px] text-muted-foreground">Add leverage to see est. margin, approximate liquidation, and ROE% on margin.</p>
                              )}
                              <p className="text-[11px] text-muted-foreground mt-1">{novaPlusResult.pnlPreview.note}</p>
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground mt-2">Enter account amount to see estimated $ profit at TP and $ loss at stop for the suggested size.</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-2">{novaPlusResult.riskManagement.note}</p>
                        </div>
                      </div>
                      <div className="rounded-md border border-zinc-200 dark:border-zinc-700 p-3">
                        <h3 className="text-sm font-semibold mb-2">Market Structure + Order Book</h3>
                        <p className="text-xs">Structure trend: <span className="capitalize">{novaPlusResult.marketDirection}</span></p>
                        <p className="text-xs">Range: low <span className="font-mono">${novaPlusResult.levels.rangeLow.toLocaleString(undefined, { maximumFractionDigits: 4, minimumFractionDigits: 2 })}</span> / high <span className="font-mono">${novaPlusResult.levels.rangeHigh.toLocaleString(undefined, { maximumFractionDigits: 4, minimumFractionDigits: 2 })}</span></p>
                        <p className="text-xs">Wall bias: <span className="capitalize">{novaPlusResult.orderBook.wallBias.replace("_", " ")}</span></p>
                        <p className="text-xs">Strongest bid wall: {novaPlusResult.orderBook.strongestBidWall ? `$${novaPlusResult.orderBook.strongestBidWall.px.toLocaleString(undefined, { maximumFractionDigits: 4 })} (size ${novaPlusResult.orderBook.strongestBidWall.sz.toLocaleString(undefined, { maximumFractionDigits: 2 })})` : "N/A"}</p>
                        <p className="text-xs">Strongest ask wall: {novaPlusResult.orderBook.strongestAskWall ? `$${novaPlusResult.orderBook.strongestAskWall.px.toLocaleString(undefined, { maximumFractionDigits: 4 })} (size ${novaPlusResult.orderBook.strongestAskWall.sz.toLocaleString(undefined, { maximumFractionDigits: 2 })})` : "N/A"}</p>
                      </div>
                    </div>
                  ); })()}
                </div>
              </div>
            ) : activeTab === "nova-investment" ? (
              <NovaInvestmentAgentPanel isOwner={isOwner} />
            ) : activeTab === "coach-calls" ? (
              <CoachCallsPanel isOwner={isOwner} isVip={isVip} />
            ) : activeTab === "wallets" ? (
              <div className="px-3 sm:px-6 pt-2 space-y-6">
                <Tabs value={walletTrackerView} onValueChange={(v) => setWalletTrackerView(v as WalletTrackerView)} className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <TabsList className="bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700/80 p-1 rounded-lg">
                      <TabsTrigger value="meme" className="rounded-md px-3 py-1.5 text-sm font-medium data-[state=inactive]:bg-transparent data-[state=inactive]:text-zinc-700 dark:data-[state=inactive]:text-zinc-300 data-[state=active]:bg-cyan-500 data-[state=active]:text-white dark:data-[state=active]:bg-cyan-600">
                        Meme Coins Traders
                      </TabsTrigger>
                      <TabsTrigger value="leverage" className="rounded-md px-3 py-1.5 text-sm font-medium data-[state=inactive]:bg-transparent data-[state=inactive]:text-zinc-700 dark:data-[state=inactive]:text-zinc-300 data-[state=active]:bg-amber-500 data-[state=active]:text-white dark:data-[state=active]:bg-amber-600">
                        Top Leverage Traders
                      </TabsTrigger>
                    </TabsList>
                    <span className="text-xs text-muted-foreground">
                      {walletTrackerView === "meme" && "When 3+ tracked wallets buy same token → alert. First-buy alerts (owner)."}
                    </span>
                  </div>
                  <TabsContent value="meme" className="mt-0 space-y-4">
                {!canAccessMemeCoinsTraderEffective ? (
                  <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                    <p className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">On-demand access required</p>
                    <p className="mt-2 text-sm text-muted-foreground max-w-md">
                      Mem Coins Traders (Wallet Tracker → Meme) is VIP on-demand. Request access and an admin will enable it for your account.
                    </p>
                    <Button
                      asChild
                      className="mt-6 bg-amber-500 hover:bg-amber-600 text-white dark:bg-amber-600 dark:hover:bg-amber-700"
                    >
                      <Link href="/support?subject=Mem%20Coins%20Trader%20access%20request">Contact for access</Link>
                    </Button>
                  </div>
                ) : (
                  <>
                <details className="mx-0 mt-0 mb-2 rounded-lg border border-zinc-200/80 dark:border-zinc-700/80 bg-zinc-50/80 dark:bg-zinc-800/50">
                  <summary className="cursor-pointer px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Wallets we track ({trackedWallets.length})
                  </summary>
                  <div className="px-4 pb-3 pt-1 flex flex-wrap gap-2">
                    {trackedWallets.length === 0 ? (
                      <span className="text-xs text-muted-foreground">
                        When {alertMinBuyers}+ tracked wallets buy the same coin, it appears here. Configure tracked wallets in settings.
                      </span>
                    ) : (
                      trackedWallets.map((w) => (
                        <a
                          key={w.address}
                          href={`https://solscan.io/account/${w.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs px-2 py-1 rounded bg-zinc-200/80 dark:bg-zinc-700/80 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 text-zinc-700 dark:text-zinc-300 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors"
                        >
                          {w.label ? `${w.label}: ` : ""}
                          {w.address.slice(0, 4)}…{w.address.slice(-4)}
                        </a>
                      ))
                    )}
                  </div>
                </details>
                <details className="mx-0 mt-2 mb-2 rounded-lg border border-zinc-200/80 dark:border-zinc-700/80 bg-zinc-50/80 dark:bg-zinc-800/50" open>
                  <summary className="cursor-pointer px-4 py-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-between gap-2">
                    <span>
                      Live trades from tracked wallets (meme)
                      {walletTrades.length > 0 && <span className="ml-2 text-xs font-normal text-muted-foreground">({walletTrades.length} in last 24h)</span>}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); fetchWalletTrades(); }}
                      disabled={walletTradesLoading}
                      className="shrink-0 border-zinc-200 dark:border-zinc-700"
                    >
                      {walletTradesLoading ? "Loading…" : "Refresh"}
                    </Button>
                  </summary>
                  <div className="px-4 pb-4 pt-1">
                    {!liveTradesEnabled ? (
                      <p className="text-sm text-muted-foreground py-4">
                        Live trades are paused to save API usage. Alerts above still run when {alertMinBuyers}+ tracked wallets buy the same token.
                        {isOwner && " Click \"Resume live trades\" to fetch again."}
                      </p>
                    ) : walletTradesError ? (
                      <div className="text-sm py-4 space-y-1">
                        <p className="font-medium text-amber-700 dark:text-amber-400">{walletTradesError}</p>
                        <p className="text-xs text-muted-foreground">Live trades need: feature flag ON (Nova Admin → Feature flags), VIP subscription, and at least one of Moralis/Helius/Birdeye API keys set on the server.</p>
                      </div>
                    ) : walletTradesLoading && walletTrades.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4">Loading trades…</p>
                    ) : walletTrades.length === 0 ? (
                      <div className="text-sm text-muted-foreground py-4 space-y-1">
                        <p>No recent swaps from tracked wallets. Try again later or refresh.</p>
                        <p className="text-xs">Live trades use Moralis/Helius/Birdeye; ensure &quot;Live trades (Wallet Tracker)&quot; is ON in Nova Admin → Feature flags. Requires VIP.</p>
                      </div>
                    ) : (
                      <ul className="space-y-2 max-h-[380px] overflow-y-auto">
                        {walletTrades.slice(0, 60).map((t, i) => (
                          <li key={`${t.walletAddress}-${t.mint}-${t.timestamp}-${i}`} className="rounded-lg border border-zinc-200/80 dark:border-zinc-700/80 bg-white dark:bg-zinc-900/80 px-3 py-2 flex items-center justify-between gap-2 text-sm">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-zinc-900 dark:text-zinc-100">{t.symbol}</span>
                                {t.side && (
                                  <span
                                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                                      t.side === "buy"
                                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                        : "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                                    }`}
                                  >
                                    {t.side === "buy" ? "Buy" : "Sell"}
                                  </span>
                                )}
                              </div>
                              <span className="text-muted-foreground truncate">{t.name}</span>
                              <span className="text-xs text-muted-foreground mt-0.5 block">· {t.walletLabel}</span>
                            </div>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {new Date(t.timestamp).toLocaleString("en-CA", { timeZone: "America/Toronto" })}
                            </span>
                            <div className="flex gap-1.5 shrink-0">
                              <a href={t.dexUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:underline">Dex</a>
                              <a href={t.txUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:underline">Tx</a>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </details>
                <div className="rounded-lg border border-zinc-200/80 dark:border-zinc-700/80 bg-zinc-50/80 dark:bg-zinc-800/50 p-3">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 block mb-2">Configure alerts</label>
                  <p className="text-xs text-muted-foreground mb-2">Choose how many tracked wallets must buy the same token to trigger an alert (e.g. 2, 3, 4, or 5).</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">Alert when</span>
                    <select
                      value={alertMinBuyers}
                      onChange={async (e) => {
                        const val = Number(e.target.value);
                        if (![2, 3, 4, 5].includes(val)) return;
                        setAlertThresholdSaving(true);
                        try {
                          const r = await fetch("/api/user/wallet-tracker-settings", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ minBuyers: val }),
                          });
                          const data = await r.json();
                          if (data.success) {
                            setAlertMinBuyers(val);
                          }
                        } finally {
                          setAlertThresholdSaving(false);
                        }
                      }}
                      disabled={alertThresholdSaving}
                      className="text-sm border border-zinc-300 dark:border-zinc-600 rounded px-2 py-1.5 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                    >
                      {[2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">tracked wallets buy same token</span>
                    {alertThresholdSaving && <span className="text-xs text-muted-foreground">Saving…</span>}
                  </div>
                </div>
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3">
                  <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">Your meme coin wallets (max 5)</h3>
                  <p className="text-xs text-muted-foreground mb-2">Add Solana or BSC wallet addresses. First-buy alerts for these wallets appear in-app only.</p>
                  {userMemeCoinWallets.length < 5 && (
                    <form
                      className="flex flex-wrap gap-2 mb-2"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const form = e.currentTarget;
                        const addr = (form.querySelector('input[name="meme-address"]') as HTMLInputElement)?.value?.trim();
                        const label = (form.querySelector('input[name="meme-label"]') as HTMLInputElement)?.value?.trim() || undefined;
                        const chain = (form.querySelector('select[name="meme-chain"]') as HTMLSelectElement)?.value || "solana";
                        if (!addr) return;
                        try {
                          const res = await fetch("/api/user/meme-coin-wallets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address: addr, label, chain }) });
                          const data = await res.json();
                          if (data.success) { setUserMemeCoinWallets(data.wallets ?? []); (form.querySelector('input[name="meme-address"]') as HTMLInputElement).value = ""; (form.querySelector('input[name="meme-label"]') as HTMLInputElement).value = ""; }
                        } catch {}
                      }}
                    >
                      <input name="meme-address" placeholder="Wallet address" className="font-mono text-sm border border-zinc-300 dark:border-zinc-600 rounded px-2 py-1.5 bg-white dark:bg-zinc-800 w-52" />
                      <input name="meme-label" placeholder="Label (optional)" className="text-sm border border-zinc-300 dark:border-zinc-600 rounded px-2 py-1.5 bg-white dark:bg-zinc-800 w-28" />
                      <select name="meme-chain" className="text-sm border border-zinc-300 dark:border-zinc-600 rounded px-2 py-1.5 bg-white dark:bg-zinc-800">
                        <option value="solana">Solana</option>
                        <option value="bsc">BSC</option>
                      </select>
                      <Button type="submit" size="sm">Add</Button>
                    </form>
                  )}
                  {userMemeCoinWallets.length > 0 && (
                    <ul className="text-xs space-y-1">
                      {userMemeCoinWallets.map((w) => (
                        <li key={w.id} className="flex items-center gap-2">
                          <span className="font-mono">{w.label ?? `${w.address.slice(0, 6)}…${w.address.slice(-4)}`}</span>
                          <span className="text-muted-foreground">({w.chain})</span>
                          <button type="button" onClick={async () => { await fetch("/api/user/meme-coin-wallets?address=" + encodeURIComponent(w.address), { method: "DELETE" }); fetchUserMemeCoinWallets(); fetchUserMemeCoinAlerts(); }} className="text-rose-600 dark:text-rose-400 hover:underline">Remove</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {userMemeCoinAlerts.length > 0 && (
                  <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3">
                    <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Your first-buy alerts (in-app)</h4>
                    <p className="text-xs text-muted-foreground mb-2">When one of your tracked wallets buys a token for the first time, it appears here.</p>
                    <ul className="space-y-1.5 max-h-48 overflow-y-auto">
                      {userMemeCoinAlerts.map((a) => (
                        <li key={a.id} className="text-xs flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="text-muted-foreground shrink-0">{new Date(a.createdAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}</span>
                          <span className="font-mono text-cyan-600 dark:text-cyan-400">{a.symbol ?? "—"}</span>
                          <span className="text-muted-foreground">({a.walletAddress.slice(0, 4)}…{a.walletAddress.slice(-4)})</span>
                          <a href={`https://dexscreener.com/solana/${a.contractAddress}`} target="_blank" rel="noopener noreferrer" className="text-cyan-600 dark:text-cyan-400 hover:underline">Dex</a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {isOwner && (
                  <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/30 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                      <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                        First buy alerts (owner only)
                      </h3>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={firstBuyEnabled}
                          onClick={async () => {
                            setFirstBuyToggling(true);
                            try {
                              const res = await fetch("/api/admin/feature-flags", {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ key: "owner_first_buy_alerts", enabled: !firstBuyEnabled }),
                              });
                              const data = await res.json();
                              if (data.success && typeof data.flags?.owner_first_buy_alerts === "boolean") {
                                setFirstBuyEnabled(data.flags.owner_first_buy_alerts);
                                const r = await fetch("/api/wallet-tracker/first-buy");
                                const d = await r.json();
                                if (d.success) setFirstBuyAlerts(d.recentAlerts ?? []);
                              }
                            } finally {
                              setFirstBuyToggling(false);
                            }
                          }}
                          disabled={firstBuyToggling}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 ${firstBuyEnabled ? "bg-cyan-500" : "bg-zinc-200 dark:bg-zinc-700"}`}
                        >
                          <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${firstBuyEnabled ? "translate-x-5" : "translate-x-1"}`} />
                        </button>
                        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                          {firstBuyToggling ? "…" : firstBuyEnabled ? "ON" : "OFF"}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                      Notify in-app and Telegram the first time a tracked wallet buys a coin. No repeat alerts for same wallet+token. Rules: Nova Admin → Wallet Tracker.
                    </p>
                    {firstBuyEnabled && firstBuyAlerts.length > 0 && (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-zinc-200/80 dark:border-zinc-800/80 hover:bg-transparent">
                              <TableHead className="font-semibold text-zinc-700 dark:text-zinc-300">Wallet</TableHead>
                              <TableHead className="font-semibold text-zinc-700 dark:text-zinc-300">Coin</TableHead>
                              <TableHead className="text-right font-semibold text-zinc-700 dark:text-zinc-300">Liquidity</TableHead>
                              <TableHead className="text-right font-semibold text-zinc-700 dark:text-zinc-300">Alerted</TableHead>
                              <TableHead className="text-right font-semibold text-zinc-700 dark:text-zinc-300">Links</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {firstBuyAlerts.map((a) => (
                              <TableRow key={`${a.walletAddress}-${a.contractAddress}`} className="border-zinc-200/60 dark:border-zinc-800/60">
                                <TableCell className="text-xs font-mono text-zinc-700 dark:text-zinc-300 max-w-[120px] truncate" title={a.walletAddress}>
                                  {a.walletLabel ?? `${a.walletAddress.slice(0, 4)}…${a.walletAddress.slice(-4)}`}
                                </TableCell>
                                <TableCell className="font-medium text-zinc-900 dark:text-zinc-100">{a.symbol}</TableCell>
                                <TableCell className="text-right tabular-nums text-muted-foreground">{formatLiq(a.liquidity ?? null)}</TableCell>
                                <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                                  {a.sentAt ? new Date(a.sentAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" }) : "—"}
                                </TableCell>
                                <TableCell className="text-right">
                                  <a href={`https://dexscreener.com/solana/${a.contractAddress}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/50">Dex</a>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                    {firstBuyEnabled && firstBuyAlerts.length === 0 && (
                      <p className="text-xs text-muted-foreground">No first-buy alerts in the last 48h. Alerts appear here and in Telegram when a tracked wallet buys a token for the first time.</p>
                    )}
                  </div>
                )}

                {walletAlerts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground text-sm text-center px-6">
                    <p className="font-semibold text-zinc-700 dark:text-zinc-300">No wallet alerts yet.</p>
                    <p className="mt-2">
                      When {alertMinBuyers}+ tracked wallets buy the same token, alerts appear here and are sent to Telegram.
                    </p>
                  </div>
                ) : (
                <div>
                  <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">
                    Alerts — {alertMinBuyers}+ tracked wallets bought same token
                  </h3>
                <Table>
                  <TableHeader>
                    <TableRow className="border-zinc-200/80 dark:border-zinc-800/80 hover:bg-transparent">
                      <TableHead className="font-semibold text-zinc-700 dark:text-zinc-300">Coin</TableHead>
                      <TableHead className="text-right font-semibold text-zinc-700 dark:text-zinc-300">Buyers</TableHead>
                      <TableHead className="text-right font-semibold text-zinc-700 dark:text-zinc-300">Liquidity</TableHead>
                      <TableHead className="text-right font-semibold text-zinc-700 dark:text-zinc-300">Price</TableHead>
                      <TableHead className="font-semibold text-zinc-700 dark:text-zinc-300">Who bought</TableHead>
                      <TableHead className="text-right font-semibold text-zinc-700 dark:text-zinc-300">Bought</TableHead>
                      <TableHead className="text-right font-semibold text-zinc-700 dark:text-zinc-300">Links</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {walletAlerts.map((a) => (
                      <TableRow key={a.contractAddress} className="border-zinc-200/60 dark:border-zinc-800/60 transition-colors hover:bg-cyan-50/40 dark:hover:bg-cyan-950/20">
                        <TableCell className="font-semibold text-zinc-900 dark:text-zinc-100">{a.symbol}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary" className="bg-cyan-100 dark:bg-cyan-900/50 text-cyan-800 dark:text-cyan-200 border-0 font-semibold">{a.buyerCount}</Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">{formatLiq(a.liquidity ?? null)}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{formatPrice(a.priceUSD ?? null)}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                          {a.buyers.slice(0, 5).map((b) => (b.label ? b.label : `${b.address.slice(0, 4)}…${b.address.slice(-4)}`)).join(", ")}
                          {a.buyers.length > 5 && ` +${a.buyers.length - 5}`}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-xs text-muted-foreground whitespace-nowrap">
                          {a.latestBuyAt ? new Date(a.latestBuyAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "medium" }) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            <a href={`https://dexscreener.com/solana/${a.contractAddress}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/50">Dex</a>
                            <a href={`https://pump.fun/coin/${a.contractAddress}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/50">Pump</a>
                            <a href={`https://gmgn.ai/sol/token/${encodeURIComponent(a.contractAddress)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/50">GMGN</a>
                            <a href={`https://t.me/maestro?start=${encodeURIComponent(a.contractAddress)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/50" title="Maestro">Maestro</a>
                            {isPaid && (
                              <a href={`https://t.me/ttf_sol_bot?start=${encodeURIComponent(a.contractAddress)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/50" title="TTF Telegram">TTF</a>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
                )}
                  </>
                )}
                  </TabsContent>
                  <TabsContent value="leverage" className="mt-0 space-y-4">
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      <strong>Global Top Traders (NovaStaris)</strong> — Curated list from NovaStaris. You can also add your own traders below.
                    </p>
                    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3">
                      <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">My traders</h3>
                      <p className="text-xs text-muted-foreground mb-2">Add your own 0x addresses to track alongside NovaStaris Global Top Traders.</p>
                      <details className="mb-2">
                        <summary className="cursor-pointer text-sm font-medium text-cyan-600 dark:text-cyan-400 hover:underline">Add my own traders</summary>
                        <form
                          className="flex flex-wrap gap-2 mt-2"
                          onSubmit={async (e) => {
                            e.preventDefault();
                            const form = e.currentTarget;
                            const addr = (form.querySelector('input[name="leverage-address"]') as HTMLInputElement)?.value?.trim();
                            const nickname = (form.querySelector('input[name="leverage-nickname"]') as HTMLInputElement)?.value?.trim() || undefined;
                            if (!addr) return;
                            try {
                              const res = await fetch("/api/user/leverage-wallets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address: addr, nickname }) });
                              const data = await res.json();
                              if (data.success) {
                                setUserLeverageWallets(data.wallets ?? []);
                                (form.querySelector('input[name="leverage-address"]') as HTMLInputElement).value = "";
                                (form.querySelector('input[name="leverage-nickname"]') as HTMLInputElement).value = "";
                                fetchTopTraders();
                              }
                            } catch {}
                          }}
                        >
                          <input name="leverage-address" placeholder="0x… address" className="font-mono text-sm border border-zinc-300 dark:border-zinc-600 rounded px-2 py-1.5 bg-white dark:bg-zinc-800 w-52" />
                          <input name="leverage-nickname" placeholder="Nickname (optional)" className="text-sm border border-zinc-300 dark:border-zinc-600 rounded px-2 py-1.5 bg-white dark:bg-zinc-800 w-28" />
                          <Button type="submit" size="sm">Add</Button>
                        </form>
                      </details>
                      {userLeverageWallets.length > 0 && (
                        <ul className="text-xs space-y-1 mt-2">
                          {userLeverageWallets.map((w) => (
                            <li key={w.id} className="flex items-center gap-2">
                              <span className="font-mono text-muted-foreground">{w.nickname ?? `${w.address.slice(0, 6)}…${w.address.slice(-4)}`}</span>
                              <button type="button" onClick={async () => { await fetch("/api/user/leverage-wallets?address=" + encodeURIComponent(w.address), { method: "DELETE" }); fetchUserLeverageWallets(); fetchTopTraders(); }} className="text-rose-600 dark:text-rose-400 hover:underline">Remove</button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    {topTradersData.length > 0 && (
                      <details className="rounded-lg border border-zinc-200/80 dark:border-zinc-700/80 bg-zinc-50/80 dark:bg-zinc-800/50">
                        <summary className="cursor-pointer px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                          Wallets we track — Top Leverage Traders ({topTradersData.length})
                        </summary>
                        <div className="px-4 pb-3 pt-1 flex flex-wrap gap-2">
                          {topTradersData.map((t) => (
                            <a
                              key={t.address}
                              href={t.apexLiquidUrl ?? "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs px-2 py-1 rounded bg-zinc-200/80 dark:bg-zinc-700/80 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 text-zinc-700 dark:text-zinc-300 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors font-mono"
                            >
                              {t.nickname ?? t.label ?? `${t.address.slice(0, 6)}…${t.address.slice(-4)}`}
                            </a>
                          ))}
                        </div>
                      </details>
                    )}
                    <Button variant="outline" size="sm" onClick={fetchTopTraders} disabled={topTradersLoading}>
                      {topTradersLoading ? "Loading…" : "Refresh"}
                    </Button>
                    {topTradersError && <p className="text-sm text-rose-600 dark:text-rose-400">{topTradersError}</p>}
                    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3">
                      <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Recent activity (in-app alerts)</h4>
                      <p className="text-xs text-muted-foreground mb-2">
                        <strong>Upcoming feature.</strong> When we run periodic checks, new trades from tracked Top Leverage Traders or your added wallets will appear here. Telegram alerts use the same checks when the feature flag is on.
                      </p>
                      {leverageAlertsLoading ? (
                        <p className="text-xs text-muted-foreground">Loading…</p>
                      ) : leverageAlerts.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No recent activity yet.</p>
                      ) : (
                        <ul className="space-y-1.5 max-h-40 overflow-y-auto">
                          {leverageAlerts.map((a) => {
                            const at = new Date(a.createdAt).toLocaleString(undefined, { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, dateStyle: "short", timeStyle: "short" });
                            const label = a.nickname ?? `${a.walletAddress.slice(0, 6)}…${a.walletAddress.slice(-4)}`;
                            const apexUrl = `https://apexliquid.bot/trade/detail?address=${encodeURIComponent(a.walletAddress)}`;
                            return (
                              <li key={a.id} className="text-xs flex flex-wrap gap-x-2 gap-y-0.5 items-baseline">
                                <span className="text-muted-foreground shrink-0">{at}</span>
                                <a href={apexUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-600 dark:text-cyan-400 hover:underline font-mono">{label}</a>
                                <span className="text-zinc-600 dark:text-zinc-400">{a.positionsSummary}</span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                    {historyAddress && (
                      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                            Trade history: {historyNickname ?? `${historyAddress.slice(0, 6)}…${historyAddress.slice(-4)}`}
                          </h4>
                          <Button variant="ghost" size="sm" onClick={() => { setHistoryAddress(null); setHistoryNickname(null); setHistoryFills([]); }}>Close</Button>
                        </div>
                        {historyLoading ? (
                          <p className="text-xs text-muted-foreground">Loading fills…</p>
                        ) : historyFills.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No fills in the last 7 days.</p>
                        ) : (
                          <div className="overflow-x-auto max-h-60 overflow-y-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-xs">Time</TableHead>
                                  <TableHead className="text-xs">Asset</TableHead>
                                  <TableHead className="text-xs">Direction</TableHead>
                                  <TableHead className="text-right text-xs" title="Quantity of the asset (contracts). Negative = short, positive = long.">Size</TableHead>
                                  <TableHead className="text-right text-xs">Price</TableHead>
                                  <TableHead className="text-right text-xs" title="Time from open/add to this close fill.">Duration</TableHead>
                                  <TableHead className="text-right text-xs" title="Realized PnL when closing or reducing (— for opens).">Closed PnL</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {historyFillsWithDuration.map((f, i) => {
                                  const isOpenOrAdd = f.dir.startsWith("Open") || f.dir.startsWith("Add");
                                  const showClosedPnl = !isOpenOrAdd && f.closedPnl != null && f.closedPnl !== "";
                                  const closedPnlNum = showClosedPnl ? Number(f.closedPnl) : 0;
                                  const durationStr = f.durationMs != null
                                    ? f.durationMs >= 3600000
                                      ? `${(f.durationMs / 3600000).toFixed(1)}h`
                                      : f.durationMs >= 60000
                                        ? `${(f.durationMs / 60000).toFixed(0)}m`
                                        : `${(f.durationMs / 1000).toFixed(0)}s`
                                    : "—";
                                  return (
                                    <TableRow key={`${f.time}-${i}`}>
                                      <TableCell className="text-xs text-muted-foreground">
                                        {new Date(f.time).toLocaleString(undefined, { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, dateStyle: "short", timeStyle: "short" })}
                                      </TableCell>
                                      <TableCell className="text-xs font-mono">{f.coin}</TableCell>
                                      <TableCell className="text-xs">{f.dir}</TableCell>
                                      <TableCell className="text-right font-mono text-xs">{f.sz}</TableCell>
                                      <TableCell className="text-right font-mono text-xs">${Number(f.px).toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell>
                                      <TableCell className="text-right font-mono text-xs text-muted-foreground">{durationStr}</TableCell>
                                      <TableCell className={`text-right font-mono text-xs ${showClosedPnl && closedPnlNum >= 0 ? "text-emerald-600 dark:text-emerald-400" : showClosedPnl ? "text-rose-600 dark:text-rose-400" : ""}`}>
                                        {showClosedPnl ? `$${closedPnlNum.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—"}
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 w-full max-w-full overflow-x-auto">
                      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-zinc-200 dark:border-zinc-700">
                        <span className="text-xs text-muted-foreground">Active (date):</span>
                        <button
                          type="button"
                          onClick={() => setLeverageTradersDateFilter("all")}
                          className={`text-xs px-2 py-1 rounded ${leverageTradersDateFilter === "all" ? "bg-cyan-500 text-white dark:bg-cyan-600" : "bg-zinc-200/80 dark:bg-zinc-700/80 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300/80 dark:hover:bg-zinc-600/80"}`}
                        >
                          All dates
                        </button>
                        <button
                          type="button"
                          onClick={() => setLeverageTradersDateFilter("today")}
                          className={`text-xs px-2 py-1 rounded ${leverageTradersDateFilter === "today" ? "bg-cyan-500 text-white dark:bg-cyan-600" : "bg-zinc-200/80 dark:bg-zinc-700/80 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300/80 dark:hover:bg-zinc-600/80"}`}
                        >
                          Today
                        </button>
                        <span className="text-xs text-muted-foreground ml-auto">
                          Note: Some Apex symbols (like <span className="font-mono">xyz:*</span>) are synthetic markets. Their live PnL may show as unavailable.
                        </span>
                      </div>
                      <Table className="table-fixed w-full min-w-0 text-xs" style={{ tableLayout: "fixed" }}>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[13%] py-1.5 px-1.5 text-xs">Trader</TableHead>
                            <TableHead className="w-[8%] py-1.5 px-1.5 text-xs">Account</TableHead>
                            <TableHead className="w-[11%] py-1.5 px-1.5 text-xs" title="Last fill (open/add/reduce/close) in last 7 days">Active</TableHead>
                            <TableHead className="w-[6%] py-1.5 px-1.5 text-xs">Symbol</TableHead>
                            <TableHead className="w-[6%] py-1.5 px-1.5 text-xs">Side</TableHead>
                            <TableHead className="w-[7%] py-1.5 px-1.5 text-right text-xs" title="Quantity of the asset (contracts). Negative = short, positive = long.">Size</TableHead>
                            <TableHead className="w-[8%] py-1.5 px-1.5 text-right text-xs">Entry</TableHead>
                            <TableHead className="w-[8%] py-1.5 px-1.5 text-right text-xs">Margin</TableHead>
                            <TableHead className="w-[9%] py-1.5 px-1.5 text-right text-xs">Notional</TableHead>
                            <TableHead className="w-[6%] py-1.5 px-1.5 text-right text-xs">Lev</TableHead>
                            <TableHead className="w-[8%] py-1.5 px-1.5 text-right text-xs">PnL</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {leverageDisplayTraders.flatMap((t) => {
                            const displayName = t.nickname ?? t.label ?? `${t.address.slice(0, 6)}…${t.address.slice(-4)}`;
                            const lastTradeStr = t.lastTradeTimeMs
                              ? new Date(t.lastTradeTimeMs).toLocaleString(undefined, { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, dateStyle: "short", timeStyle: "short" })
                              : "—";
                            const isTraderFavorite = leverageTraderFavoriteAddresses.has(t.address.toLowerCase());
                            const traderCell = (
                              <span className="inline-flex items-center gap-1 flex-wrap min-w-0">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    toggleLeverageTraderFavorite(t.address);
                                  }}
                                  className="shrink-0 p-0.5 rounded text-muted-foreground hover:text-amber-500 dark:hover:text-amber-400 hover:bg-zinc-200/80 dark:hover:bg-zinc-700/80 -ml-0.5"
                                  aria-label={isTraderFavorite ? "Remove trader from favorites" : "Favorite trader (pin to top)"}
                                  aria-pressed={isTraderFavorite}
                                  title={isTraderFavorite ? "Remove favorite" : "Favorite — pinned to top of list"}
                                >
                                  <Star className={`h-3.5 w-3.5 ${isTraderFavorite ? "fill-amber-400 text-amber-400" : ""}`} />
                                </button>
                                {t.apexLiquidUrl ? (
                                  <a href={t.apexLiquidUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-600 dark:text-cyan-400 hover:underline font-mono truncate max-w-full">{displayName}</a>
                                ) : (
                                  <span className="font-mono truncate max-w-full">{displayName}</span>
                                )}
                                <button type="button" onClick={() => openTraderHistory(t.address, t.nickname ?? null)} className="text-muted-foreground hover:text-cyan-600 dark:hover:text-cyan-400 underline shrink-0">History</button>
                              </span>
                            );
                            return t.positions.length === 0
                              ? [<TableRow key={t.address}><TableCell className="font-mono py-1.5 px-1.5 truncate max-w-0">{traderCell}</TableCell><TableCell className="font-mono py-1.5 px-1.5">{t.accountValue != null ? `$${Number(t.accountValue).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"}</TableCell><TableCell className="text-muted-foreground py-1.5 px-1.5 truncate" title="Last fill in last 7d">{lastTradeStr}</TableCell><TableCell colSpan={8} className="text-muted-foreground py-1.5 px-1.5">No open positions</TableCell></TableRow>]
                              : t.positions.map((pos, i) => (
                                  <TableRow key={`${t.address}-${pos.coin}-${i}`}>
                                    {(() => {
                                      const isXyzSynthetic = pos.coin.toLowerCase().startsWith("xyz:");
                                      const pnlNum = Number(pos.unrealizedPnl);
                                      const showPnlUnavailable = isXyzSynthetic && (!Number.isFinite(pnlNum) || pnlNum === 0);
                                      return (
                                        <>
                                    {i === 0 ? (
                                      <>
                                        <TableCell className="align-top py-1.5 px-1.5 truncate max-w-0" rowSpan={t.positions.length}>{traderCell}</TableCell>
                                        <TableCell className="font-mono align-top py-1.5 px-1.5" rowSpan={t.positions.length}>{t.accountValue != null ? `$${Number(t.accountValue).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"}</TableCell>
                                      </>
                                    ) : null}
                                    <TableCell className="text-muted-foreground py-1.5 px-1.5 truncate" title="Last fill (open/add/reduce/close) in last 7d">{lastTradeStr}</TableCell>
                                    <TableCell className="py-1.5 px-1.5 font-mono">{pos.coin}</TableCell>
                                    <TableCell className="py-1.5 px-1.5">
                                      <Badge variant={pos.side === "long" ? "default" : "secondary"} className={pos.side === "long" ? "bg-emerald-600 text-[10px] px-1" : "bg-rose-600 text-[10px] px-1"}>
                                        {pos.side === "long" ? "Long" : "Short"}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-right font-mono py-1.5 px-1.5 truncate">{pos.szi}</TableCell>
                                    <TableCell className="text-right font-mono py-1.5 px-1.5">${Number(pos.entryPx).toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell>
                                    <TableCell className="text-right font-mono py-1.5 px-1.5">{pos.marginUsed != null && pos.marginUsed !== "" ? `$${Number(pos.marginUsed).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"}</TableCell>
                                    <TableCell className="text-right font-mono py-1.5 px-1.5">${Number(pos.positionValue).toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                                    <TableCell className="text-right font-mono py-1.5 px-1.5">{pos.leverage != null ? `${pos.leverage}x` : "—"}</TableCell>
                                    <TableCell
                                      className={`text-right font-mono py-1.5 px-1.5 ${
                                        showPnlUnavailable
                                          ? "text-muted-foreground"
                                          : Number(pos.unrealizedPnl) >= 0
                                          ? "text-emerald-600 dark:text-emerald-400"
                                          : "text-rose-600 dark:text-rose-400"
                                      }`}
                                      title={showPnlUnavailable ? "Live PnL is not available for this symbol yet." : undefined}
                                    >
                                      {showPnlUnavailable
                                        ? "Not available yet"
                                        : `$${Number(pos.unrealizedPnl).toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                        </>
                                      );
                                    })()}
                                  </TableRow>
                                ));
                          })}
                          {topTradersData.length === 0 && !topTradersLoading && !topTradersError ? (
                            <TableRow><TableCell colSpan={11} className="text-muted-foreground text-center py-8">Click Refresh to load Top Leverage Traders.</TableCell></TableRow>
                          ) : topTradersData.length > 0 && leverageTradersDateFilter === "today" && leverageFilteredTraders.length === 0 ? (
                            <TableRow><TableCell colSpan={11} className="text-muted-foreground text-center py-8">No trades with activity today. Try &quot;All dates&quot; or refresh later.</TableCell></TableRow>
                          ) : null}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                  </TabsContent>
                </Tabs>
              </div>
            ) : activeTab === "watchlist" ? (
              watchlist.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground text-sm text-center px-6">
                  <p className="font-semibold text-zinc-700 dark:text-zinc-300">Your watchlist is empty</p>
                  <p className="mt-2">Star tokens from Go Hunting, Trending, BSC, or other tabs to see them here.</p>
                </div>
              ) : (
                <div className="px-4 py-4 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-zinc-200/80 dark:border-zinc-800/80 hover:bg-transparent">
                        <TableHead className="font-semibold text-zinc-700 dark:text-zinc-300">Symbol</TableHead>
                        <TableHead className="font-semibold text-zinc-700 dark:text-zinc-300">Contract</TableHead>
                        <TableHead className="font-semibold text-zinc-700 dark:text-zinc-300">Chain</TableHead>
                        <TableHead className="text-right font-semibold text-zinc-700 dark:text-zinc-300">Links</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {watchlist.map((w) => {
                        const dexUrl = (w.chain ?? "solana") === "bsc" ? `https://dexscreener.com/bsc/${w.contractAddress}` : `https://dexscreener.com/solana/${w.contractAddress}`;
                        return (
                          <TableRow key={`${w.contractAddress}-${w.chain ?? "solana"}`} className="border-zinc-200/60 dark:border-zinc-800/60">
                            <TableCell className="font-medium text-zinc-900 dark:text-zinc-100">{w.symbol ?? "—"}</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground max-w-[120px] truncate" title={w.contractAddress}>{w.contractAddress.slice(0, 6)}…{w.contractAddress.slice(-4)}</TableCell>
                            <TableCell className="text-zinc-600 dark:text-zinc-400">{(w.chain ?? "solana").toUpperCase()}</TableCell>
                            <TableCell className="text-right">
                              <a href={dexUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1 text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:underline">Dex</a>
                            </TableCell>
                            <TableCell>
                              <button type="button" onClick={() => persistWatchlist(watchlist.filter((x) => x.contractAddress !== w.contractAddress || (x.chain ?? "solana") !== (w.chain ?? "solana")))} className="text-xs text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 font-medium" title="Remove from watchlist">Remove</button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )
            ) : tokensForDisplay.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground text-sm text-center px-6">
                <p className="font-semibold text-zinc-700 dark:text-zinc-300">
                  {activeTab === "bsc" ? "No BSC tokens in this view." : activeTab === "ct" ? "No CT tokens yet." : activeTab === "surge" ? "No surge tokens right now." : activeTab === "transactions" ? "No transaction data yet." : activeTab === "trending" ? "No trending tokens right now." : activeTab === "new" ? "No tokens in this view. Try another filter or refresh." : "No tokens yet."}
                </p>
                <p className="mt-2">
                  {activeTab === "bsc"
                    ? "BSC Go Hunting: new pairs, final stretch, migrated, or trending. Try another view or refresh."
                    : activeTab === "ct"
                    ? "Run \"Scan Twitter\" to find coins mentioned by 3+ tracked KOLs."
                    : activeTab === "surge"
                      ? `Surge shows coins with high volume in the selected window (${surgeWindow}). 5m/15m/30m estimated from 1h. Live from DexScreener, up to 80 coins.`
                      : activeTab === "transactions"
                        ? "Transactions tab shows coins by 24h buy/sell counts. Data from Surge (DexScreener). Refreshes every 60s."
                        : activeTab === "trending"
                          ? "Trending = live by 24h volume + price change. Try again in a moment."
                          : activeTab === "new"
                            ? "New pairs = newest from DexScreener + Birdeye (last 2h; or newest available). Refreshes every 60s."
                            : "Run Scan to save tokens to the DB, or use New pairs for live recent listings."}
                </p>
                <p className="mt-4 text-xs max-w-md text-zinc-500 dark:text-zinc-400">
                  {activeTab === "bsc"
                    ? "BSC meme coins on PancakeSwap and other DEXs. Auto-refreshes every 60s."
                    : activeTab === "surge"
                    ? `Surge: volume in last ${surgeWindow}. List auto-refreshes every 60s.`
                    : activeTab === "transactions"
                      ? "Sorted by total transactions (buys + sells) descending."
                      : activeTab === "ct"
                        ? "CT Scan: KOLs, smart money. When 3+ tweet the same coin → potential viral."
                        : activeTab === "new"
                          ? "Go Hunting: newest pairs (last 2h). Each refresh shuffles order. Auto-refreshes every 60s."
                          : "Trending = live movers. List auto-refreshes every 60s."}
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                  <Button onClick={() => fetchTokens(activeTab)} disabled={loading} variant="outline" size="sm" className="border-zinc-300 dark:border-zinc-600">
                    {loading ? "Loading…" : "Refresh"}
                  </Button>
                  {activeTab === "ct" && (
                    <Button
                      onClick={() => runScan("twitter")}
                      disabled={scanning !== "idle" || !canAccessCtScanEffective}
                      size="sm"
                      className="bg-cyan-500 hover:bg-cyan-600 text-white dark:bg-cyan-600 dark:hover:bg-cyan-700"
                    >
                      {scanning === "twitter" ? "Scanning…" : "Scan Twitter"}
                    </Button>
                  )}
                </div>
              </div>
            ) : activeTab === "transactions" ? (
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-200/80 dark:border-zinc-800/80 hover:bg-transparent">
                    <TableHead className="font-semibold text-zinc-700 dark:text-zinc-300">Symbol</TableHead>
                    <TableHead className="hidden sm:table-cell font-semibold text-zinc-700 dark:text-zinc-300">Name</TableHead>
                    <TableHead className="text-right font-semibold text-zinc-700 dark:text-zinc-300">Age</TableHead>
                    <TableHead className="text-right font-semibold text-zinc-700 dark:text-zinc-300">Liquidity</TableHead>
                    <TableHead className="text-right font-semibold text-zinc-700 dark:text-zinc-300">Vol 24h</TableHead>
                    <TableHead className="text-right font-semibold text-zinc-700 dark:text-zinc-300">Buys</TableHead>
                    <TableHead className="text-right font-semibold text-zinc-700 dark:text-zinc-300">Sells</TableHead>
                    <TableHead className="text-right font-semibold text-zinc-700 dark:text-zinc-300">Price</TableHead>
                    <TableHead className="text-right font-semibold text-zinc-700 dark:text-zinc-300">Links</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tokensForDisplay.map((t) => (
                    <TableRow key={t.id} className="border-zinc-200/60 dark:border-zinc-800/60 transition-colors hover:bg-cyan-50/40 dark:hover:bg-cyan-950/20">
                      <TableCell className="font-semibold text-zinc-900 dark:text-zinc-100">{t.symbol}</TableCell>
                      <TableCell className="max-w-[140px] truncate hidden sm:table-cell text-muted-foreground">{t.name}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground text-xs">{formatAge(t.launchedAt)}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{formatLiq(t.liquidity)}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium text-cyan-700 dark:text-cyan-300">{formatVol(t.volume24h)}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium text-emerald-600 dark:text-emerald-400">{(t.txnsBuys24h ?? 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium text-rose-600 dark:text-rose-400">{(t.txnsSells24h ?? 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{formatPrice(t.priceUSD)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <a href={dexUrl(t)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/50">Dex</a>
                          <a href={pumpFunUrl(t)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/50">Pump</a>
                          <a href={gmgnUrl(t)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/50">GMGN</a>
                          <a href={maestroUrl(t)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/50" title="Maestro">Maestro</a>
                          {isPaid && <a href={ttfTelegramUrl(t)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/50" title="TTF Telegram">TTF</a>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-200/80 dark:border-zinc-800/80 hover:bg-transparent">
                    <TableHead className="font-semibold text-zinc-700 dark:text-zinc-300">Symbol</TableHead>
                    <TableHead className="hidden sm:table-cell font-semibold text-zinc-700 dark:text-zinc-300">Name</TableHead>
                    <TableHead className="text-right font-semibold text-zinc-700 dark:text-zinc-300">Score</TableHead>
                    {activeTab === "surge" && <TableHead className="text-right font-semibold text-zinc-700 dark:text-zinc-300">Vol ({surgeWindow})</TableHead>}
                    {activeTab === "surge" && <TableHead className="text-right font-semibold text-zinc-700 dark:text-zinc-300">TXNS</TableHead>}
                    <TableHead className="text-right font-semibold text-zinc-700 dark:text-zinc-300">Age</TableHead>
                    <TableHead className="text-right font-semibold text-zinc-700 dark:text-zinc-300">Liquidity</TableHead>
                    <TableHead className="text-right font-semibold text-zinc-700 dark:text-zinc-300">Price</TableHead>
                    <TableHead className="text-right font-semibold text-zinc-700 dark:text-zinc-300">Links</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tokensForDisplay.map((t) => (
                    <TableRow
                      key={t.id}
                      className="border-zinc-200/60 dark:border-zinc-800/60 transition-colors hover:bg-cyan-50/40 dark:hover:bg-cyan-950/20"
                    >
                      <TableCell className="font-semibold text-zinc-900 dark:text-zinc-100">{t.symbol}</TableCell>
                      <TableCell className="max-w-[140px] truncate hidden sm:table-cell text-muted-foreground">
                        {t.name}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Badge variant="secondary" className="bg-cyan-100 dark:bg-cyan-900/50 text-cyan-800 dark:text-cyan-200 border-0 font-semibold">
                            {t.viralScore}
                          </Badge>
                          {activeTab === "ct" && t.kolCount != null && (
                            <span className="text-xs text-muted-foreground" title="KOLs who tweeted">
                              {t.kolCount} KOL{t.kolCount !== 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      {activeTab === "surge" && (
                        <TableCell className="text-right tabular-nums font-medium text-cyan-700 dark:text-cyan-300">
                          {formatVol(
                            surgeWindow === "5m" ? t.volume5m
                            : surgeWindow === "15m" ? t.volume15m
                            : surgeWindow === "30m" ? t.volume30m
                            : surgeWindow === "1h" ? t.volume1h
                            : surgeWindow === "6h" ? t.volume6h
                            : t.volume24h
                          )}
                        </TableCell>
                      )}
                      {activeTab === "surge" && (
                        <TableCell className="text-right tabular-nums text-xs">
                          {t.txnsBuys24h != null || t.txnsSells24h != null ? (
                            <>
                              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                                {((t.txnsBuys24h ?? 0) + (t.txnsSells24h ?? 0)).toLocaleString()}
                              </span>
                              <span className="block text-muted-foreground">
                                {(t.txnsBuys24h ?? 0).toLocaleString()} / {(t.txnsSells24h ?? 0).toLocaleString()}
                              </span>
                            </>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      )}
                      <TableCell className="text-right tabular-nums text-muted-foreground text-xs">
                        {formatAge(t.launchedAt)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatLiq(t.liquidity)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatPrice(t.priceUSD)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => toggleWatchlist(t, activeTab === "bsc" ? "bsc" : "solana")}
                            className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium transition-colors ${isInWatchlist(t.contractAddress, activeTab === "bsc" ? "bsc" : "solana") ? "text-amber-500 hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-300" : "text-zinc-500 hover:text-amber-500 dark:text-zinc-400 dark:hover:text-amber-400"}`}
                            title={isInWatchlist(t.contractAddress, activeTab === "bsc" ? "bsc" : "solana") ? "Remove from watchlist" : "Add to watchlist"}
                          >
                            <Star className={`h-3.5 w-3.5 ${isInWatchlist(t.contractAddress, activeTab === "bsc" ? "bsc" : "solana") ? "fill-current" : ""}`} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const url = activeTab === "bsc" ? dexUrlBsc(t) : dexUrl(t);
                              navigator.clipboard.writeText(url).then(() => {
                                setCopiedTokenId(t.id);
                                setTimeout(() => setCopiedTokenId(null), 2000);
                              });
                            }}
                            className="inline-flex items-center rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors"
                            title="Copy Dex link"
                          >
                            {copiedTokenId === t.id ? "Copied!" : <><Copy className="h-3 w-3 mr-0.5 inline" /> Share</>}
                          </button>
                          {activeTab === "bsc" ? (
                            <>
                              <a href={dexUrlBsc(t)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors">Dex</a>
                              <a href={bscScanUrl(t)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors">BscScan</a>
                            </>
                          ) : (
                            <>
                              <a href={dexUrl(t)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors">Dex</a>
                              <a href={pumpFunUrl(t)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors">Pump</a>
                              <a href={gmgnUrl(t)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors">GMGN</a>
                              <a href={maestroUrl(t)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors" title="Open in Maestro Telegram bot">Maestro</a>
                            </>
                          )}
                          {t.twitter && (
                            <a
                              href={t.twitter}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors"
                            >
                              X
                            </a>
                          )}
                          {t.telegram && (
                            <a
                              href={t.telegram}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors"
                            >
                              TG
                            </a>
                          )}
                          {t.website && (
                            <a
                              href={t.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors"
                              title="Website"
                            >
                              🌐
                            </a>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
              </>
            )}
          </CardContent>
        </Card>
      </main>

      {novaConnectAvatarLightbox && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Profile picture"
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/90 p-4 sm:p-8"
          onClick={() => setNovaConnectAvatarLightbox(null)}
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute top-3 right-3 sm:top-6 sm:right-6 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setNovaConnectAvatarLightbox(null);
            }}
          >
            <X className="h-6 w-6" />
          </button>
          <div
            className="flex flex-col items-center gap-4 max-w-full max-h-full"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={novaConnectAvatarLightbox.src}
              alt=""
              className="max-h-[min(72vh,640px)] max-w-[min(92vw,640px)] w-auto h-auto object-contain rounded-full shadow-2xl ring-4 ring-white/15 select-none"
              draggable={false}
            />
            <p className="text-base sm:text-lg font-semibold text-white text-center px-4">
              {novaConnectAvatarLightbox.name}
            </p>
            <p className="text-xs text-white/60">Tap outside or press Esc to close</p>
          </div>
        </div>
      )}
    </div>
  );
}
