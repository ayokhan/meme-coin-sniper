/** User-chosen focus path + shared onboarding storage keys. */

export type DashboardPath = "meme" | "futures" | "wallets" | "all";

export const DASHBOARD_PATH_KEY = "novastaris-dashboard-path-v1";
export const ONBOARDING_DISMISSED_KEY = "novastaris_onboarding_dismissed";
/** Legacy: first visit used to force NovaConnect — superseded by path picker when set. */
export const FIRST_VISIT_LEGACY_KEY = "firstVisitDashboard";

export type DashboardPathApplyResult = {
  filter: "all" | "core" | "pro" | "vip" | "bots";
  tab: string;
  futuresView?: "ai" | "workflow" | "altcoins" | "hot-perps" | "liquidation-map";
  novaForecastSubTab?: "nova-radar" | "nova-q" | "nova-smart" | "agent";
};

export const DASHBOARD_PATH_OPTIONS = [
  {
    id: "meme" as DashboardPath,
    title: "Meme coin hunter",
    description: "Go Hunting, Trending, and AI analysis on Solana & BSC.",
    emoji: "🎯",
  },
  {
    id: "futures" as DashboardPath,
    title: "Futures & metals trader",
    description: "Crypto Futures, NovaRadar, NovaQ, and the trading bot.",
    emoji: "📈",
  },
  {
    id: "wallets" as DashboardPath,
    title: "Wallet & signals follower",
    description: "Wallet Tracker, CT Scan, and coach signals.",
    emoji: "👛",
  },
  {
    id: "all" as DashboardPath,
    title: "Show everything",
    description: "All tabs — best if you already know the platform.",
    emoji: "✨",
  },
];

export function loadDashboardPath(): DashboardPath | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(DASHBOARD_PATH_KEY);
    if (v === "meme" || v === "futures" || v === "wallets" || v === "all") return v;
  } catch {
    /* ignore */
  }
  return null;
}

export function saveDashboardPath(path: DashboardPath): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DASHBOARD_PATH_KEY, path);
    localStorage.setItem(ONBOARDING_DISMISSED_KEY, "1");
    localStorage.setItem(FIRST_VISIT_LEGACY_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function applyDashboardPath(path: DashboardPath): DashboardPathApplyResult {
  switch (path) {
    case "meme":
      return { filter: "core", tab: "new" };
    case "futures":
      return {
        filter: "pro",
        tab: "nova-forecast",
        novaForecastSubTab: "nova-radar",
        futuresView: "workflow",
      };
    case "wallets":
      return { filter: "vip", tab: "wallets" };
    case "all":
    default:
      return { filter: "all", tab: "new" };
  }
}

export function defaultFilterForTier(tier: "pro" | "vip" | null, isPaid: boolean): DashboardPathApplyResult["filter"] {
  if (tier === "vip") return "vip";
  if (isPaid || tier === "pro") return "pro";
  return "core";
}

export function pathHintCopy(path: DashboardPath | null): string {
  switch (path) {
    case "meme":
      return "Your path: Meme hunter — start with Go Hunting or Trending, then run AI analysis on a contract.";
    case "futures":
      return "Your path: Futures — open NovaForecast → NovaRadar for limits, or Crypto Futures for chart AI and the bot.";
    case "wallets":
      return "Your path: Wallets — track smart money in Wallet Tracker; enable alerts in your account settings.";
    case "all":
      return "Showing all tools. Use Core / Pro / VIP / Bots filters above to focus.";
    default:
      return "New here? Pick a focus path (Meme, Futures, or Wallets) to reduce tab clutter.";
  }
}

/** Valid dashboard tab ids for URL deep links. */
export const URL_TAB_IDS = new Set([
  "new",
  "trending",
  "surge",
  "ct",
  "wallets",
  "transactions",
  "ai-analysis",
  "futures",
  "trending-perps",
  "perp-radar",
  "narratives",
  "trading-bot",
  "polymarket-bot",
  "prop-firm-bot",
  "nova-ultimate",
  "coach-calls",
  "nova-forecast",
  "nova-forex",
  "nova-plus",
  "nova-investment",
  "bsc",
  "watchlist",
  "nova-futures-narratives",
  "nova-eagle",
  "crypto-buddie",
  "meme-intelligence",
  "nova-connect",
  "chris-clayton",
]);

export const URL_FUTURES_VIEWS = new Set(["ai", "workflow", "altcoins", "hot-perps", "liquidation-map"]);
