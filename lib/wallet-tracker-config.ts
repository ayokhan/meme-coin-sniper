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

const DEFAULT_RULES: AlertRuleConfig = {
  minBuyers: 3,
  maxAgeHours: 24,
  maxAlerts: 30,
};

type PrismaWithWalletTracker = typeof prisma & {
  trackedWallet?: { findMany: (args: unknown) => Promise<Array<{ address: string; label: string | null }>> };
  alertRule?: { findUnique: (args: unknown) => Promise<{ minBuyers: number; maxAgeHours: number; maxAlerts: number } | null> };
};

/** Get tracked wallets from DB, or fallback to config. */
export async function getTrackedWallets(): Promise<TrackedWalletItem[]> {
  try {
    const db = prisma as unknown as PrismaWithWalletTracker;
    if (!db.trackedWallet) return TRACKED_WALLETS.map((w) => ({ address: w.address, label: w.label }));
    const rows = await db.trackedWallet.findMany({ orderBy: { createdAt: 'asc' } } as Parameters<NonNullable<typeof db.trackedWallet>['findMany']>[0]);
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
    if (!db.alertRule) return DEFAULT_RULES;
    const row = await db.alertRule.findUnique({ where: { key: 'wallet_tracker' } });
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
