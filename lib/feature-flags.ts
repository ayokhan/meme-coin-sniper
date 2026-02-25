/**
 * Owner-only feature flags. When a flag is OFF, the corresponding API/feature is disabled
 * (e.g. no Moralis calls for Go Hunting, no Moralis for Wallet Tracker, no Telegram alerts).
 * Stored in DB; only editable by owner in Admin → Feature Flags.
 */
import { prisma } from '@/lib/db';

export const FEATURE_FLAG_KEYS = {
  /** Moralis for Go Hunting (new-pairs + scan fallback). When OFF, no getPumpFunNewTokens calls. */
  MORALIS_GO_HUNTING: 'moralis_go_hunting',
  /** Moralis for Wallet Tracker (alerts + trades). When OFF, wallet APIs use Helius/Birdeye only. */
  MORALIS_WALLET_TRACKER: 'moralis_wallet_tracker',
  /** Send wallet alerts to Telegram (cron notify). When OFF, cron does not send to Telegram. */
  TELEGRAM_WALLET_ALERTS: 'telegram_wallet_alerts',
  /** Show/fetch live trades from tracked wallets. When OFF, no calls to /api/wallet-tracker/trades (saves Moralis). Alerts still work. */
  LIVE_TRADES_ENABLED: 'live_trades_enabled',
  /** Owner-only: notify (in-app + Telegram) the first time a tracked wallet buys a coin. No repeat alerts for same wallet+token. */
  OWNER_FIRST_BUY_ALERTS: 'owner_first_buy_alerts',
} as const;

export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[keyof typeof FEATURE_FLAG_KEYS];

const DEFAULT_ENABLED = true;

type PrismaWithFeatureFlag = typeof prisma & {
  featureFlag?: {
    findUnique: (args: { where: { key: string } }) => Promise<{ enabled: boolean } | null>;
    findMany: () => Promise<Array<{ key: string; enabled: boolean }>>;
    upsert: (args: {
      where: { key: string };
      create: { key: string; enabled: boolean };
      update: { enabled: boolean };
    }) => Promise<unknown>;
  };
};

/** Get whether a feature flag is enabled. Defaults to true if key not in DB. */
export async function getFeatureFlag(key: string): Promise<boolean> {
  try {
    const db = prisma as unknown as PrismaWithFeatureFlag;
    if (!db.featureFlag) return DEFAULT_ENABLED;
    const row = await db.featureFlag.findUnique({ where: { key } });
    return row?.enabled ?? DEFAULT_ENABLED;
  } catch {
    return DEFAULT_ENABLED;
  }
}

/** Get all known flags with their current state (for admin UI). */
export async function getAllFeatureFlags(): Promise<Record<string, boolean>> {
  const keys = Object.values(FEATURE_FLAG_KEYS);
  const out: Record<string, boolean> = {};
  try {
    const db = prisma as unknown as PrismaWithFeatureFlag;
    if (!db.featureFlag) {
      keys.forEach((k) => (out[k] = true));
      return out;
    }
    const rows = await db.featureFlag.findMany();
    const byKey = new Map(rows.map((r) => [r.key, r.enabled]));
    keys.forEach((k) => (out[k] = byKey.get(k) ?? true));
    return out;
  } catch {
    keys.forEach((k) => (out[k] = true));
    return out;
  }
}

/** Set a feature flag (admin only; caller must enforce owner check). */
export async function setFeatureFlag(key: string, enabled: boolean): Promise<void> {
  const db = prisma as unknown as PrismaWithFeatureFlag;
  if (!db.featureFlag) return;
  await db.featureFlag.upsert({
    where: { key },
    create: { key, enabled },
    update: { enabled },
  });
}
