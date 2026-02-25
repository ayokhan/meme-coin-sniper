/**
 * Wallet Tracker config: tracked wallets and alert rules.
 * Loads from DB; falls back to config file if DB is empty.
 */
import { prisma } from '@/lib/db';
import { TRACKED_WALLETS } from '@/lib/config/ct-wallets';

export type TrackedWalletItem = {
  address: string;
  label?: string | null;
};

export type AlertRuleConfig = {
  minBuyers: number;
  maxAgeHours: number;
  maxAlerts: number;
};

/** Owner first-buy alerts: lookback window and max alerts per cron run. */
export type FirstBuyRuleConfig = {
  lookbackHours: number;
  maxAlerts: number;
};

const DEFAULT_RULES: AlertRuleConfig = {
  minBuyers: 3,
  maxAgeHours: 24,
  maxAlerts: 30,
};

const DEFAULT_FIRST_BUY_RULES: FirstBuyRuleConfig = {
  lookbackHours: 24,
  maxAlerts: 50,
};

type PrismaWithWalletTracker = typeof prisma & {
  trackedWallet?: { findMany: (args: unknown) => Promise<Array<{ address: string; label: string | null }>> };
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
    if (!db.trackedWallet) return TRACKED_WALLETS.map((w) => ({ address: w.address, label: w.label }));
    const rows = await db.trackedWallet.findMany({ orderBy: { createdAt: 'asc' } } as { orderBy: { createdAt: string } });
    if (rows.length > 0) {
      return rows.map((r) => ({ address: r.address, label: r.label }));
    }
  } catch {
    /* ignore */
  }
  return TRACKED_WALLETS.map((w) => ({ address: w.address, label: w.label }));
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
      return {
        lookbackHours: (row as { maxAgeHours: number }).maxAgeHours ?? DEFAULT_FIRST_BUY_RULES.lookbackHours,
        maxAlerts: (row as { maxAlerts: number }).maxAlerts ?? DEFAULT_FIRST_BUY_RULES.maxAlerts,
      };
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_FIRST_BUY_RULES;
}
