"use client";

import { useMemo, useState } from "react";
import {
  Compass,
  Flame,
  LayoutGrid,
  MoreHorizontal,
  Star,
  Target,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type { DashboardPath } from "@/lib/dashboard-onboarding";
import { TAB_SHORT_LABELS, type DashboardTabId } from "@/lib/dashboard-tabs";
import { getMobileMoreTabs, getMobilePrimaryTabs } from "@/lib/mobile-dashboard-tabs";

type Props = {
  activeTab: DashboardTabId;
  dashboardPath: DashboardPath | null;
  isTabVisible: (tab: DashboardTabId) => boolean;
  watchlistCount?: number;
  onTabChange: (tab: DashboardTabId) => void;
};

const TAB_ICONS: Partial<Record<DashboardTabId, typeof Target>> = {
  new: Target,
  trending: TrendingUp,
  "ai-analysis": Flame,
  futures: TrendingUp,
  wallets: Wallet,
  bsc: Compass,
  watchlist: Star,
};

function tabLabel(tab: DashboardTabId, watchlistCount: number): string {
  if (tab === "watchlist" && watchlistCount > 0) {
    return `${TAB_SHORT_LABELS[tab]} (${watchlistCount})`;
  }
  return TAB_SHORT_LABELS[tab];
}

export default function MobileDashboardTabBar({
  activeTab,
  dashboardPath,
  isTabVisible,
  watchlistCount = 0,
  onTabChange,
}: Props) {
  const [moreOpen, setMoreOpen] = useState(false);

  const primary = useMemo(
    () => getMobilePrimaryTabs(dashboardPath, isTabVisible),
    [dashboardPath, isTabVisible]
  );
  const moreTabs = useMemo(
    () => getMobileMoreTabs(dashboardPath, isTabVisible, primary),
    [dashboardPath, isTabVisible, primary]
  );

  const inMore = moreTabs.includes(activeTab);
  const moreActive = inMore || moreOpen;

  if (primary.length === 0) return null;

  return (
    <>
      {moreOpen && (
        <button
          type="button"
          className="md:hidden fixed inset-0 z-[85] bg-black/40"
          aria-label="Close tab menu"
          onClick={() => setMoreOpen(false)}
        />
      )}
      {moreOpen && (
        <div
          className="md:hidden fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-[90] mx-3 max-h-[min(60vh,24rem)] overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-2xl p-2"
          role="dialog"
          aria-label="More tabs"
        >
          <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            More tabs
          </p>
          <div className="grid grid-cols-2 gap-1">
            {moreTabs.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  onTabChange(tab);
                  setMoreOpen(false);
                }}
                className={`rounded-lg px-3 py-2.5 text-left text-sm font-medium min-h-[44px] transition-colors ${
                  activeTab === tab
                    ? "bg-cyan-500 text-white dark:bg-cyan-600"
                    : "text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                {tabLabel(tab, watchlistCount)}
              </button>
            ))}
          </div>
        </div>
      )}

      <nav
        className="md:hidden fixed inset-x-0 bottom-0 z-[80] border-t border-zinc-200/90 dark:border-zinc-800/90 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
        aria-label="Dashboard tabs"
      >
        <div className="grid grid-cols-5 h-14">
          {primary.map((tab) => {
            const Icon = TAB_ICONS[tab] ?? LayoutGrid;
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setMoreOpen(false);
                  onTabChange(tab);
                }}
                className={`flex flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium min-h-[44px] transition-colors ${
                  active
                    ? "text-cyan-600 dark:text-cyan-400"
                    : "text-zinc-500 dark:text-zinc-400"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <Icon className={`h-5 w-5 ${active ? "text-cyan-500" : ""}`} aria-hidden />
                <span className="truncate max-w-full leading-tight">{TAB_SHORT_LABELS[tab]}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className={`flex flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium min-h-[44px] transition-colors ${
              moreActive
                ? "text-cyan-600 dark:text-cyan-400"
                : "text-zinc-500 dark:text-zinc-400"
            }`}
            aria-expanded={moreOpen}
            aria-label="More tabs"
          >
            <MoreHorizontal className={`h-5 w-5 ${moreActive ? "text-cyan-500" : ""}`} aria-hidden />
            <span>More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
