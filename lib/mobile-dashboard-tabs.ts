import type { DashboardPath } from "@/lib/dashboard-onboarding";
import { DASHBOARD_TAB_ORDER, type DashboardTabId } from "@/lib/dashboard-tabs";

/** Up to 4 primary mobile tabs per path; remainder live under More. */
const MOBILE_PRIMARY_BY_PATH: Record<DashboardPath, DashboardTabId[]> = {
  meme: ["new", "trending", "ai-analysis", "bsc"],
  futures: ["futures", "nova-forecast", "trending-perps", "perp-radar"],
  "wallet-tracking": ["wallets", "ct", "transactions", "coach-calls"],
  polymarket: ["polymarket-bot", "trading-bot", "prop-firm-bot", "narratives"],
  all: ["new", "ai-analysis", "futures", "wallets"],
};

const MOBILE_PRIMARY_FALLBACK: DashboardTabId[] = ["new", "trending", "ai-analysis", "futures"];

export function getMobilePrimaryTabs(
  path: DashboardPath | null,
  isVisible: (tab: DashboardTabId) => boolean
): DashboardTabId[] {
  const candidates = path ? MOBILE_PRIMARY_BY_PATH[path] : MOBILE_PRIMARY_FALLBACK;
  const primary: DashboardTabId[] = [];
  for (const tab of candidates) {
    if (!isVisible(tab)) continue;
    primary.push(tab);
    if (primary.length >= 4) break;
  }
  if (primary.length >= 4) return primary;

  for (const tab of DASHBOARD_TAB_ORDER) {
    if (primary.includes(tab) || !isVisible(tab)) continue;
    primary.push(tab);
    if (primary.length >= 4) break;
  }
  return primary;
}

export function getMobileMoreTabs(
  path: DashboardPath | null,
  isVisible: (tab: DashboardTabId) => boolean,
  primary: DashboardTabId[]
): DashboardTabId[] {
  const primarySet = new Set(primary);
  return DASHBOARD_TAB_ORDER.filter((tab) => isVisible(tab) && !primarySet.has(tab));
}
