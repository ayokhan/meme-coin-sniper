/**
 * Wallet Tracker config: tracked wallets and alert rules.
 * Loads from DB; falls back to config file if DB is empty.
 */
import { prisma } from '@/lib/db';
import { TRACKED_WALLETS } from '@/lib/config/ct-wallets';

export type TrackedWalletItem = {
  address: string;
  label?: string | null;
  firstBuyEnabled?: boolean;
};

export type AlertRuleConfig = {
  minBuyers: number;
  maxAgeHours: number;
  maxAlerts: number;
};

/** Owner first-buy alerts: lookback in minutes (mins or hours stored as mins) and max alerts per cron run. */
export type FirstBuyRuleConfig = {
  lookbackMinutes: number;
  maxAlerts: number;
};

/** Allowed first-buy lookback values in minutes (1, 2, 5, 15, 30 mins). */
export const FIRST_BUY_LOOKBACK_MINUTES = [1, 2, 5, 15, 30] as const;

/** Hour options for first-buy lookback (stored as minutes: 60, 120, 360, 720, 1440). */
export const FIRST_BUY_LOOKBACK_HOURS = [1, 2, 6, 12, 24] as const;

/** All allowed lookback values in minutes (mins + hours as minutes). */
export const FIRST_BUY_LOOKBACK_ALL_MINUTES = [
  ...FIRST_BUY_LOOKBACK_MINUTES,
  ...FIRST_BUY_LOOKBACK_HOURS.map((h) => h * 60),
] as const;

const DEFAULT_RULES: AlertRuleConfig = {
  minBuyers: 3,
  maxAgeHours: 24,
  maxAlerts: 30,
};

const DEFAULT_FIRST_BUY_RULES: FirstBuyRuleConfig = {
  lookbackMinutes: 15,
  maxAlerts: 50,
};

type PrismaWithWalletTracker = typeof prisma & {
  trackedWallet?: { findMany: (args: unknown) => Promise<Array<{ address: string; label: string | null; firstBuyEnabled: boolean }>> };
  alertRule?: {
    findUnique: (args: unknown) => Promise<{ minBuyers: number; maxAgeHours: number; maxAlerts: number } | null>;
    findMany?: (args: unknown) => Promise<Array<{ key: string; maxAgeHours: number; maxAlerts: number }>>;
    upsert?: (args: unknown) => Promise<unknown>;
  };
};

/** Get tracked wallets from DB, or fallback to config. */
export async function getTrackedWallets(): Promise<TrackedWalletItem[]> {
  try {
    const db = prisma as unknown as PrismaWithWalletTracker;
    if (!db.trackedWallet) return TRACKED_WALLETS.map((w) => ({ address: w.address, label: w.label, firstBuyEnabled: true }));
    const rows = await db.trackedWallet.findMany({ orderBy: { createdAt: 'asc' } } as { orderBy: { createdAt: string } });
    if (rows.length > 0) {
      return rows.map((r) => ({ address: r.address, label: r.label, firstBuyEnabled: r.firstBuyEnabled ?? true }));
    }
  } catch {
    /* ignore */
  }
  return TRACKED_WALLETS.map((w) => ({ address: w.address, label: w.label, firstBuyEnabled: true }));
}

/** Get alert rules from DB, or defaults. */
export async function getAlertRules(): Promise<AlertRuleConfig> {
  try {
    const db = prisma as unknown as PrismaWithWalletTracker;
    if (!db.alertRule) return DEFAULT_RULES;
    const row = await db.alertRule.findUnique({ where: { key: 'wallet_tracker' } } as { where: { key: string } });
    if (row) {
      return {
        minBuyers: row.minBuyers ?? DEFAULT_RULES.minBuyers,
        maxAgeHours: row.maxAgeHours ?? DEFAULT_RULES.maxAgeHours,
        maxAlerts: row.maxAlerts ?? DEFAULT_RULES.maxAlerts,
      };
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_RULES;
}

const FIRST_BUY_KEY = 'first_buy';

/** Get first-buy alert rules (owner-only feature). */
export async function getFirstBuyRules(): Promise<FirstBuyRuleConfig> {
  try {
    const db = prisma as unknown as PrismaWithWalletTracker;
    if (!db.alertRule?.findUnique) return DEFAULT_FIRST_BUY_RULES;
    const row = await db.alertRule.findUnique({ where: { key: FIRST_BUY_KEY } } as { where: { key: string } });
    if (row && 'maxAgeHours' in row && 'maxAlerts' in row) {
      const stored = (row as { maxAgeHours: number }).maxAgeHours;
      const lookbackMinutes = (FIRST_BUY_LOOKBACK_ALL_MINUTES as readonly number[]).includes(stored) ? stored : DEFAULT_FIRST_BUY_RULES.lookbackMinutes;
      return {
        lookbackMinutes,
        maxAlerts: (row as { maxAlerts: number }).maxAlerts ?? DEFAULT_FIRST_BUY_RULES.maxAlerts,
      };
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_FIRST_BUY_RULES;
}
