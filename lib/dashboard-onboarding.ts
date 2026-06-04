/** User-chosen focus path + shared onboarding storage keys. */

export type DashboardPath = "meme" | "futures" | "wallet-tracking" | "polymarket" | "all";

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

export type DashboardPathApplyOptions = {
  subscriptionTier?: "pro" | "vip" | null;
  isPaid?: boolean;
};

export const DASHBOARD_PATH_OPTIONS: Array<{
  id: DashboardPath;
  title: string;
  description: string;
  emoji: string;
}> = [
  {
    id: "meme",
    title: "Meme coin hunter",
    description: "Go Hunting, Trending, and AI analysis on Solana & BSC.",
    emoji: "🎯",
  },
  {
    id: "futures",
    title: "Futures & metals trader",
    description: "VIP: NovaForecast, NovaRadar, Nova Forex, addons. Pro: Crypto Futures chart AI.",
    emoji: "📈",
  },
  {
    id: "wallet-tracking",
    title: "Wallet tracking",
    description: "Wallet Tracker, CT Scan, and coach signals.",
    emoji: "👛",
  },
  {
    id: "polymarket",
    title: "Prediction markets",
    description: "Nova Polymarket Pro — on-demand Polymarket workflows.",
    emoji: "🎲",
  },
  {
    id: "all",
    title: "Show everything",
    description: "All tabs — best if you already know the platform.",
    emoji: "✨",
  },
];

export function loadDashboardPath(): DashboardPath | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(DASHBOARD_PATH_KEY);
    if (v === "wallets") return "wallet-tracking";
    if (
      v === "meme" ||
      v === "futures" ||
      v === "wallet-tracking" ||
      v === "polymarket" ||
      v === "all"
    ) {
      return v;
    }
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

export function applyDashboardPath(
  path: DashboardPath,
  options?: DashboardPathApplyOptions
): DashboardPathApplyResult {
  const tier = options?.subscriptionTier ?? null;
  const isVip = tier === "vip";

  switch (path) {
    case "meme":
      return { filter: "core", tab: "new" };
    case "futures":
      // Most futures power tools (NovaRadar, NovaForecast, Forex, addons) are VIP tabs.
      if (isVip) {
        return {
          filter: "vip",
          tab: "nova-forecast",
          novaForecastSubTab: "nova-radar",
        };
      }
      return {
        filter: "pro",
        tab: "futures",
        futuresView: "workflow",
      };
    case "wallet-tracking":
      return { filter: "vip", tab: "wallets" };
    case "polymarket":
      return { filter: "bots", tab: "polymarket-bot" };
    case "all":
    default:
      return { filter: "all", tab: "new" };
  }
}

export function pathDisplayLabel(path: DashboardPath): string {
  switch (path) {
    case "meme":
      return "Meme";
    case "futures":
      return "Futures";
    case "wallet-tracking":
      return "Wallet tracking";
    case "polymarket":
      return "Prediction markets";
    case "all":
      return "All";
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
      return "Your path: Futures — VIP filter shows NovaForecast/NovaRadar, Forex, and addons; switch to Pro for Crypto Futures chart AI if you have Pro.";
    case "wallet-tracking":
      return "Your path: Wallet tracking — use Wallet Tracker and CT Scan; enable alerts in your account settings.";
    case "polymarket":
      return "Your path: Prediction markets — open Nova Polymarket Pro under Bots (on-demand access may apply).";
    case "all":
      return "Showing all tools. Use Core / Pro / VIP / Bots filters above to focus.";
    default:
      return "New here? Pick a focus path (Meme, Futures, Wallet tracking, or Prediction markets) to reduce tab clutter.";
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
