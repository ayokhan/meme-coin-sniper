/**
 * Owner-only feature flags. When a flag is OFF, the corresponding API/feature is disabled
 * (e.g. no Moralis calls for Go Hunting, no Moralis for Wallet Tracker, no Telegram alerts).
 * Stored in DB; only editable by owner in Admin → Feature Flags.
 */
import { prisma } from '@/lib/db';
import { FEATURE_FLAG_KEYS, type FeatureFlagKey } from "@/lib/feature-flag-keys";

export { FEATURE_FLAG_KEYS, type FeatureFlagKey };

const DEFAULT_ENABLED = true;
const DEFAULT_DISABLED_KEYS: Set<string> = new Set([
  FEATURE_FLAG_KEYS.DIGEST_TO_NEWSLETTER_SUBSCRIBERS,
  FEATURE_FLAG_KEYS.NOVA_SCALPER_CRON,
  FEATURE_FLAG_KEYS.NOVA_POLYMARKET_COPY_BOT,
  FEATURE_FLAG_KEYS.NOVA_POLYMARKET_LEADERBOARD,
  FEATURE_FLAG_KEYS.NOVA_POLYMARKET_FIVE_MINS,
  FEATURE_FLAG_KEYS.NOVA_POLYMARKET_ELITE,
  FEATURE_FLAG_KEYS.NOVA_EAGLE,
  FEATURE_FLAG_KEYS.NOVA_CRYPTO_BUDDIE,
  FEATURE_FLAG_KEYS.NOVA_LIQUIDATION_MAP,
  FEATURE_FLAG_KEYS.NOVA_FUTURES_NARRATIVES,
  FEATURE_FLAG_KEYS.NOVA_MEME_INTELLIGENCE,
  FEATURE_FLAG_KEYS.NOVA_Q_MEMES,
  FEATURE_FLAG_KEYS.NOVA_SMART_MEMES,
  FEATURE_FLAG_KEYS.NOVA_TOP_MEME_COINS,
  FEATURE_FLAG_KEYS.NOVA_MEME_PRICE_FACTOR,
  FEATURE_FLAG_KEYS.NOVA_MEME_RUNNER,
  FEATURE_FLAG_KEYS.NOVA_SCALP_AGENT,
  FEATURE_FLAG_KEYS.NOVA_Q_FIB,
  FEATURE_FLAG_KEYS.NOVA_EXTRA,
  FEATURE_FLAG_KEYS.NOVA_PATTERN_DETECTOR,
  FEATURE_FLAG_KEYS.PAGE_TAB_NOVA_FOREX,
  FEATURE_FLAG_KEYS.PAGE_TAB_NOVA_PULSE,
  FEATURE_FLAG_KEYS.NOVA_FOREX_AGENT,
  FEATURE_FLAG_KEYS.NOVA_FOREX_FIB,
  FEATURE_FLAG_KEYS.NOVA_FOREX_SCALP_AGENT,
  FEATURE_FLAG_KEYS.NOVA_FOREX_BOT,
  FEATURE_FLAG_KEYS.NOVA_FOREX_BOT_OWNER_ONLY,
  FEATURE_FLAG_KEYS.NOVA_FOREX_SCALP_BOT,
  FEATURE_FLAG_KEYS.NOVA_FOREX_SCALP_BOT_OWNER_ONLY,
  FEATURE_FLAG_KEYS.NOVA_FOREX_SCALP_BOT_CRON,
  FEATURE_FLAG_KEYS.FOREX_BROKER_ASSEXMARKETS,
  FEATURE_FLAG_KEYS.AI_ANALYSIS_RAG,
  FEATURE_FLAG_KEYS.LIVE_SUPPORT_CHAT,
  FEATURE_FLAG_KEYS.ACCOUNT_BILLING_HISTORY,
  FEATURE_FLAG_KEYS.PAGE_TAB_NOVA_STORE,
  FEATURE_FLAG_KEYS.PAGE_TAB_DEMO_SESSIONS,
  FEATURE_FLAG_KEYS.PNL_SHARE_CARD_MESSAGE,
]);

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

/** Get whether a feature flag is enabled. Defaults to true if key not in DB (except DIGEST_TO_NEWSLETTER_SUBSCRIBERS which defaults to false). */
export async function getFeatureFlag(key: string): Promise<boolean> {
  try {
    const db = prisma as unknown as PrismaWithFeatureFlag;
    if (!db.featureFlag) return DEFAULT_DISABLED_KEYS.has(key) ? false : DEFAULT_ENABLED;
    const row = await db.featureFlag.findUnique({ where: { key } });
    const defaultVal = DEFAULT_DISABLED_KEYS.has(key) ? false : DEFAULT_ENABLED;
    return row?.enabled ?? defaultVal;
  } catch {
    return DEFAULT_DISABLED_KEYS.has(key) ? false : DEFAULT_ENABLED;
  }
}

/** Get all known flags with their current state (for admin UI). */
export async function getAllFeatureFlags(): Promise<Record<string, boolean>> {
  const keys = Object.values(FEATURE_FLAG_KEYS);
  const out: Record<string, boolean> = {};
  try {
    const db = prisma as unknown as PrismaWithFeatureFlag;
    if (!db.featureFlag) {
      keys.forEach((k) => (out[k] = !DEFAULT_DISABLED_KEYS.has(k)));
      return out;
    }
    const rows = await db.featureFlag.findMany();
    const byKey = new Map(rows.map((r) => [r.key, r.enabled]));
    keys.forEach((k) => (out[k] = byKey.get(k) ?? !DEFAULT_DISABLED_KEYS.has(k)));
    return out;
  } catch {
    keys.forEach((k) => (out[k] = !DEFAULT_DISABLED_KEYS.has(k)));
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
