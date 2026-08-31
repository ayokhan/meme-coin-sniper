import type { DashboardPath } from "@/lib/dashboard-onboarding";
import type { DashboardTabId } from "@/lib/dashboard-tabs";

export const NEXT_STEP_DISMISS_KEY = "novastaris_next_step_dismissed_v1";
export const NEXT_STEP_DONE_KEY = "novastaris_next_step_done_v1";

export type NextStepAction =
  | { type: "tab"; tab: DashboardTabId }
  | { type: "futures-workflow"; tab: "futures" };

export type NextStepConfig = {
  title: string;
  description: string;
  ctaLabel: string;
  action: NextStepAction;
};

export function getNextStepForPath(path: DashboardPath | null): NextStepConfig | null {
  switch (path) {
    case "meme":
      return {
        title: "Do this first: run AI analysis",
        description: "From Go Hunting, pick a pair — or paste a contract on AI Agent (Solana, BSC, ETH, Robinhood, HyperEVM).",
        ctaLabel: "Open AI Agent",
        action: { type: "tab", tab: "ai-analysis" },
      };
    case "futures":
      return {
        title: "Do this first: open Institutional Workflow",
        description: "Set macro bias and rules, or upload one chart for AI framing.",
        ctaLabel: "Open workflow",
        action: { type: "futures-workflow", tab: "futures" },
      };
    case "forex":
      return {
        title: "Do this first: run NovaQ on gold",
        description: "Open Nova Forex, refresh Market Watch, then NovaQ on XAUUSD.",
        ctaLabel: "Open Nova Forex",
        action: { type: "tab", tab: "nova-forex" },
      };
    case "wallet-tracking":
      return {
        title: "Do this first: open Wallet Tracker",
        description: "Review Top Leverage Traders or add a wallet you want to follow.",
        ctaLabel: "Open Wallet Tracker",
        action: { type: "tab", tab: "wallets" },
      };
    case "polymarket":
      return {
        title: "Do this first: open Nova Polymarket",
        description: "Explore wallet intelligence on one prediction market.",
        ctaLabel: "Open Polymarket",
        action: { type: "tab", tab: "polymarket-bot" },
      };
    case "all":
    default:
      return null;
  }
}

export function readNextStepDismissed(path: DashboardPath): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(NEXT_STEP_DISMISS_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    return !!parsed[path];
  } catch {
    return false;
  }
}

export function dismissNextStep(path: DashboardPath): void {
  try {
    const raw = localStorage.getItem(NEXT_STEP_DISMISS_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    parsed[path] = true;
    localStorage.setItem(NEXT_STEP_DISMISS_KEY, JSON.stringify(parsed));
  } catch {
    /* ignore */
  }
}

export function readNextStepDone(path: DashboardPath): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(NEXT_STEP_DONE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    return !!parsed[path];
  } catch {
    return false;
  }
}

export function markNextStepDone(path: DashboardPath): void {
  try {
    const raw = localStorage.getItem(NEXT_STEP_DONE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    parsed[path] = true;
    localStorage.setItem(NEXT_STEP_DONE_KEY, JSON.stringify(parsed));
  } catch {
    /* ignore */
  }
}
