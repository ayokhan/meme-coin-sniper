/**
 * Owner-managed green "NEW" pills on main navigation tabs.
 * Configured in Admin → Feature flags → Tab NEW badges.
 */
import { prisma } from "@/lib/db";

/** Shipped defaults when no DB row exists for a tab. */
export const DEFAULT_TAB_NEW_BADGES: Record<string, string> = {
  "nova-futures-narratives": "2026-05-31T23:59:59.999Z",
  "nova-eagle": "2026-05-31T23:59:59.999Z",
  "crypto-buddie": "2026-05-31T23:59:59.999Z",
  "meme-intelligence": "2026-06-30T23:59:59.999Z",
  "chris-clayton": "2026-05-31T23:59:59.999Z",
  "trading-university": "2026-08-15T23:59:59.999Z",
  "nova-store": "2026-09-30T23:59:59.999Z",
};

/** Tabs owners can configure in admin (main GUI top tabs). */
export const TAB_NEW_BADGE_OPTIONS: { id: string; label: string }[] = [
  { id: "new", label: "Go Hunting" },
  { id: "trending", label: "Trending" },
  { id: "surge", label: "Surge" },
  { id: "transactions", label: "Transactions" },
  { id: "ai-analysis", label: "NovaStaris AI Agent" },
  { id: "futures", label: "Crypto Futures" },
  { id: "nova-futures-narratives", label: "Nova Futures Narratives" },
  { id: "nova-eagle", label: "Nova Eagle" },
  { id: "crypto-buddie", label: "Crypto Buddie" },
  { id: "meme-intelligence", label: "Nova Meme Intelligence" },
  { id: "trending-perps", label: "Trending perps" },
  { id: "perp-radar", label: "Perp Radar" },
  { id: "narratives", label: "Narratives" },
  { id: "trading-bot", label: "NovaStaris AI Trading Bots" },
  { id: "polymarket-bot", label: "Nova Polymarket" },
  { id: "prop-firm-bot", label: "Nova Prop Firm Challenge" },
  { id: "nova-forex-bot", label: "Nova Forex Bots" },
  { id: "nova-ultimate", label: "Nova Ultimate" },
  { id: "ct", label: "CT Scan" },
  { id: "wallets", label: "Wallet Tracker" },
  { id: "coach-calls", label: "Coach Calls + Telegram Signals" },
  { id: "nova-forecast", label: "NovaForecast Agent" },
  { id: "nova-forex", label: "Nova Forex Agent" },
  { id: "nova-plus", label: "Nova+" },
  { id: "nova-investment", label: "Nova Investment Agent" },
  { id: "bsc", label: "BSC" },
  { id: "watchlist", label: "Watchlist" },
  { id: "nova-connect", label: "NovaConnect" },
  { id: "chris-clayton", label: "Online Boss Strategy" },
  { id: "trading-university", label: "NovaStaris Trading University" },
  { id: "nova-store", label: "Nova Store" },
];

export type TabNewBadgeAdminRow = {
  tabId: string;
  label: string;
  /** null = badge off (explicit or no default). */
  expiresAt: string | null;
  /** True when badge shows on site right now. */
  active: boolean;
  /** True when value comes from code default (no DB row). */
  usesDefault: boolean;
};

type PrismaWithTabNewBadge = typeof prisma & {
  tabNewBadge?: {
    findMany: () => Promise<Array<{ tabId: string; expiresAt: Date | null }>>;
    upsert: (args: {
      where: { tabId: string };
      create: { tabId: string; expiresAt: Date | null };
      update: { expiresAt: Date | null };
    }) => Promise<unknown>;
    delete: (args: { where: { tabId: string } }) => Promise<unknown>;
  };
};

function db(): PrismaWithTabNewBadge["tabNewBadge"] | null {
  return (prisma as unknown as PrismaWithTabNewBadge).tabNewBadge ?? null;
}

function isActiveExpiry(iso: string | null, now = Date.now()): boolean {
  if (!iso) return false;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) && now <= ms;
}

function resolveExpiryIso(
  tabId: string,
  byTab: Map<string, { expiresAt: Date | null } | undefined>
): { iso: string | null; usesDefault: boolean } {
  const row = byTab.get(tabId);
  if (row) {
    return { iso: row.expiresAt ? row.expiresAt.toISOString() : null, usesDefault: false };
  }
  const fallback = DEFAULT_TAB_NEW_BADGES[tabId];
  return { iso: fallback ?? null, usesDefault: Boolean(fallback) };
}

/** Active badges for the main app (tabId → expiry ISO). */
export async function getActiveTabNewBadges(): Promise<Record<string, string>> {
  const badgeDb = db();
  const byTab = new Map<string, { expiresAt: Date | null }>();
  if (badgeDb) {
    try {
      const rows = await badgeDb.findMany();
      for (const r of rows) byTab.set(r.tabId, r);
    } catch {
      // table may not exist yet
    }
  }

  const out: Record<string, string> = {};
  for (const { id } of TAB_NEW_BADGE_OPTIONS) {
    const { iso } = resolveExpiryIso(id, byTab);
    if (isActiveExpiry(iso)) out[id] = iso!;
  }
  return out;
}

/** Full admin list with on/off state. */
export async function getTabNewBadgesForAdmin(): Promise<TabNewBadgeAdminRow[]> {
  const badgeDb = db();
  const byTab = new Map<string, { expiresAt: Date | null }>();
  if (badgeDb) {
    try {
      const rows = await badgeDb.findMany();
      for (const r of rows) byTab.set(r.tabId, r);
    } catch {
      // ignore
    }
  }

  return TAB_NEW_BADGE_OPTIONS.map(({ id, label }) => {
    const { iso, usesDefault } = resolveExpiryIso(id, byTab);
    return {
      tabId: id,
      label,
      expiresAt: iso,
      active: isActiveExpiry(iso),
      usesDefault,
    };
  });
}

/** Set badge expiry (ISO) or turn off (null). */
export async function setTabNewBadge(tabId: string, expiresAtIso: string | null): Promise<void> {
  const badgeDb = db();
  if (!badgeDb) throw new Error("TabNewBadge table is not available. Run database migrations.");

  const allowed = new Set(TAB_NEW_BADGE_OPTIONS.map((o) => o.id));
  if (!allowed.has(tabId)) throw new Error("Invalid tab id.");

  if (expiresAtIso === null) {
    await badgeDb.upsert({
      where: { tabId },
      create: { tabId, expiresAt: null },
      update: { expiresAt: null },
    });
    return;
  }

  const ms = Date.parse(expiresAtIso);
  if (!Number.isFinite(ms)) throw new Error("Invalid expiry date.");
  await badgeDb.upsert({
    where: { tabId },
    create: { tabId, expiresAt: new Date(ms) },
    update: { expiresAt: new Date(ms) },
  });
}

/** Clear DB override so defaults apply again. */
export async function clearTabNewBadgeOverride(tabId: string): Promise<void> {
  const badgeDb = db();
  if (!badgeDb) return;
  try {
    await badgeDb.delete({ where: { tabId } });
  } catch {
    // row may not exist
  }
}

export function isTabNewBadgeActive(tabId: string, activeByTab: Record<string, string>): boolean {
  const iso = activeByTab[tabId];
  return isActiveExpiry(iso ?? null);
}
