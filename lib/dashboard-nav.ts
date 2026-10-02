/** Two-level dashboard navigation: market groups on top, tools (tabs) inside each group. */

import type { DashboardPath } from "@/lib/dashboard-onboarding";

export type DashboardNavGroup = "home" | "memes" | "perps" | "forex" | "bots" | "learn" | "all";

export const DASHBOARD_NAV_GROUPS: DashboardNavGroup[] = ["home", "memes", "perps", "forex", "bots", "learn", "all"];

export const NAV_GROUP_LS_KEY = "novastaris-nav-group-v1";
export const NAV_HOME_PINS_LS_KEY = "novastaris-nav-home-pins-v1";

/** Free essentials always shown on Home; users can pin more. */
export const HOME_DEFAULT_TABS: string[] = ["new", "ai-analysis", "daily-wrap", "pnl-calculator", "trading-university", "nova-store"];

/** Master display order (also the "All tools" order). Tabs merged into Go Hunting are intentionally absent. */
export const NAV_TAB_ORDER: string[] = [
  "new",
  "ai-analysis",
  "daily-wrap",
  "narratives",
  "meme-intelligence",
  "ct",
  "futures",
  "perp-radar",
  "nova-forecast",
  "nova-pulse",
  "nova-eagle",
  "session-sweep",
  "nova-futures-narratives",
  "crypto-buddie",
  "wallets",
  "nova-forex",
  "trading-bot",
  "polymarket-bot",
  "prop-firm-bot",
  "nova-forex-bot",
  "nova-ultimate",
  "gmgn-vip-bot",
  "pnl-calculator",
  "coach-calls",
  "nova-plus",
  "nova-investment",
  "nova-connect",
  "trading-university",
  "nova-store",
  "nova-job-agent",
  "realtor-os",
  "chris-clayton",
];

/** A tool may live in several groups (bots appear under Bots and their market). First listed group is its home group. */
export const NAV_GROUP_TABS: Record<Exclude<DashboardNavGroup, "home" | "all">, string[]> = {
  memes: ["new", "ai-analysis", "narratives", "meme-intelligence", "ct", "wallets", "gmgn-vip-bot"],
  perps: [
    "futures",
    "perp-radar",
    "nova-forecast",
    "nova-pulse",
    "nova-eagle",
    "session-sweep",
    "nova-futures-narratives",
    "crypto-buddie",
    "wallets",
    "ai-analysis",
  ],
  forex: ["nova-forex", "session-sweep", "nova-forex-bot", "prop-firm-bot", "nova-pulse"],
  bots: ["trading-bot", "polymarket-bot", "prop-firm-bot", "nova-forex-bot", "nova-ultimate", "gmgn-vip-bot"],
  learn: [
    "daily-wrap",
    "pnl-calculator",
    "trading-university",
    "nova-store",
    "nova-connect",
    "coach-calls",
    "nova-plus",
    "nova-investment",
    "nova-job-agent",
    "realtor-os",
    "chris-clayton",
  ],
};

export function isDashboardNavGroup(v: unknown): v is DashboardNavGroup {
  return typeof v === "string" && (DASHBOARD_NAV_GROUPS as string[]).includes(v);
}

export function homeTabs(pins: string[]): string[] {
  const out = [...HOME_DEFAULT_TABS];
  for (const p of pins) if (!out.includes(p) && NAV_TAB_ORDER.includes(p)) out.push(p);
  return out;
}

export function tabsForNavGroup(group: DashboardNavGroup, pins: string[]): string[] {
  if (group === "all") return NAV_TAB_ORDER;
  if (group === "home") return homeTabs(pins);
  return NAV_GROUP_TABS[group];
}

export function tabInNavGroup(tab: string, group: DashboardNavGroup, pins: string[]): boolean {
  return tabsForNavGroup(group, pins).includes(tab);
}

/** Group to show when a tab is opened from a deep link or in-page link. */
export function primaryNavGroupForTab(tab: string): DashboardNavGroup {
  for (const g of ["memes", "perps", "forex", "bots", "learn"] as const) {
    if (NAV_GROUP_TABS[g].includes(tab)) return g;
  }
  return "all";
}

export function navGroupForPath(path: DashboardPath | null): DashboardNavGroup {
  switch (path) {
    case "meme":
      return "memes";
    case "futures":
      return "perps";
    case "forex":
      return "forex";
    case "wallet-tracking":
      return "memes";
    case "polymarket":
      return "bots";
    case "all":
      return "all";
    default:
      return "home";
  }
}

export function loadNavGroup(): DashboardNavGroup | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(NAV_GROUP_LS_KEY);
    return isDashboardNavGroup(v) ? v : null;
  } catch {
    return null;
  }
}

export function saveNavGroup(group: DashboardNavGroup): void {
  try {
    localStorage.setItem(NAV_GROUP_LS_KEY, group);
  } catch {
    /* ignore */
  }
}

export function loadHomePins(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(NAV_HOME_PINS_LS_KEY) ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string" && NAV_TAB_ORDER.includes(x)) : [];
  } catch {
    return [];
  }
}

export function saveHomePins(pins: string[]): void {
  try {
    localStorage.setItem(NAV_HOME_PINS_LS_KEY, JSON.stringify(pins));
  } catch {
    /* ignore */
  }
}
