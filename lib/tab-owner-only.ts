/**
 * Owner-managed: which dashboard tabs are visible only to the owner.
 * Configured in Admin → Tab visibility. Master page_tab_* flags still apply.
 */

import { prisma } from "@/lib/db";

export const TAB_OWNER_ONLY_CONFIG_ID = "default";

/** Tabs that can be marked owner-only (main GUI). */
export const OWNER_ONLY_MANAGED_TABS = [
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
  "nova-forex-bot",
  "nova-ultimate",
  "ct",
  "wallets",
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
  "trading-university",
  "nova-job-agent",
  "nova-store",
] as const;

export type OwnerOnlyManagedTab = (typeof OWNER_ONLY_MANAGED_TABS)[number];

export type TabOwnerOnlyConfig = {
  /** Tab ids visible only to the site owner when listed. */
  ownerOnlyTabs: OwnerOnlyManagedTab[];
};

export type TabOwnerOnlyAdmin = TabOwnerOnlyConfig & {
  usesDefault: boolean;
  updatedAt: string | null;
};

/** Preserve Online Boss as owner-only by default (previous hardcoded behavior). */
export const DEFAULT_TAB_OWNER_ONLY: TabOwnerOnlyConfig = {
  ownerOnlyTabs: ["chris-clayton"],
};

const MANAGED_SET = new Set<string>(OWNER_ONLY_MANAGED_TABS);

type PrismaWithCfg = typeof prisma & {
  tabOwnerOnlyConfig?: {
    findUnique: (args: { where: { id: string } }) => Promise<{ tabs: unknown; updatedAt: Date } | null>;
    upsert: (args: {
      where: { id: string };
      create: { id: string; tabs: string[] };
      update: { tabs: string[] };
    }) => Promise<{ tabs: unknown; updatedAt: Date }>;
    delete: (args: { where: { id: string } }) => Promise<unknown>;
  };
};

function db() {
  return (prisma as unknown as PrismaWithCfg).tabOwnerOnlyConfig ?? null;
}

export function normalizeOwnerOnlyTabs(raw: unknown): OwnerOnlyManagedTab[] {
  if (!Array.isArray(raw)) return [...DEFAULT_TAB_OWNER_ONLY.ownerOnlyTabs];
  const out: OwnerOnlyManagedTab[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string" || !MANAGED_SET.has(item) || seen.has(item)) continue;
    seen.add(item);
    out.push(item as OwnerOnlyManagedTab);
  }
  return out;
}

export async function getTabOwnerOnlyConfig(): Promise<TabOwnerOnlyAdmin> {
  const cfgDb = db();
  if (!cfgDb) {
    return { ...DEFAULT_TAB_OWNER_ONLY, usesDefault: true, updatedAt: null };
  }
  try {
    const row = await cfgDb.findUnique({ where: { id: TAB_OWNER_ONLY_CONFIG_ID } });
    if (!row) {
      return { ...DEFAULT_TAB_OWNER_ONLY, usesDefault: true, updatedAt: null };
    }
    return {
      ownerOnlyTabs: normalizeOwnerOnlyTabs(row.tabs),
      usesDefault: false,
      updatedAt: row.updatedAt.toISOString(),
    };
  } catch {
    return { ...DEFAULT_TAB_OWNER_ONLY, usesDefault: true, updatedAt: null };
  }
}

export async function getOwnerOnlyTabIds(): Promise<string[]> {
  const cfg = await getTabOwnerOnlyConfig();
  return cfg.ownerOnlyTabs;
}

export async function setTabOwnerOnlyTabs(tabs: string[]): Promise<TabOwnerOnlyAdmin> {
  const cfgDb = db();
  if (!cfgDb) throw new Error("Tab owner-only storage unavailable. Run prisma db push.");
  const ownerOnlyTabs = normalizeOwnerOnlyTabs(tabs);
  const row = await cfgDb.upsert({
    where: { id: TAB_OWNER_ONLY_CONFIG_ID },
    create: { id: TAB_OWNER_ONLY_CONFIG_ID, tabs: ownerOnlyTabs },
    update: { tabs: ownerOnlyTabs },
  });
  return {
    ownerOnlyTabs: normalizeOwnerOnlyTabs(row.tabs),
    usesDefault: false,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function resetTabOwnerOnlyConfig(): Promise<TabOwnerOnlyAdmin> {
  const cfgDb = db();
  if (!cfgDb) throw new Error("Tab owner-only storage unavailable.");
  try {
    await cfgDb.delete({ where: { id: TAB_OWNER_ONLY_CONFIG_ID } });
  } catch {
    /* no row */
  }
  return { ...DEFAULT_TAB_OWNER_ONLY, usesDefault: true, updatedAt: null };
}

export function isTabOwnerOnly(tab: string, ownerOnlyTabs: string[] | null | undefined): boolean {
  if (!ownerOnlyTabs?.length) return false;
  return ownerOnlyTabs.includes(tab);
}
