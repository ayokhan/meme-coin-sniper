import { prisma } from "@/lib/db";
import { getSubscriptionTier } from "@/lib/subscription";

export const FIND_WALLET_SOURCE = "find_wallet";
export const FIND_WALLET_CONFIG_ID = "default";

export type FindWalletConfigRow = {
  enabled: boolean;
  vipDailyLimit: number;
  freeDailyLimit: number;
};

type PrismaExt = typeof prisma & {
  findWalletConfig?: {
    findUnique: (a: { where: { id: string } }) => Promise<FindWalletConfigRow | null>;
  };
  findWalletUserLimit?: {
    findUnique: (a: { where: { userId: string } }) => Promise<{ dailyLimit: number } | null>;
  };
};

export function getDayBoundsUtc(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

export async function getFindWalletConfig(): Promise<FindWalletConfigRow> {
  const db = (prisma as unknown as PrismaExt).findWalletConfig;
  if (!db) return { enabled: true, vipDailyLimit: 2, freeDailyLimit: 0 };
  const row = await db.findUnique({ where: { id: FIND_WALLET_CONFIG_ID } });
  return row ?? { enabled: true, vipDailyLimit: 2, freeDailyLimit: 0 };
}

export async function getFindWalletUserLimit(userId: string): Promise<number | null> {
  const db = (prisma as unknown as PrismaExt).findWalletUserLimit;
  if (!db) return null;
  const row = await db.findUnique({ where: { userId } });
  return row?.dailyLimit ?? null;
}

export async function countFindWalletUsesToday(userId: string): Promise<number> {
  const { start, end } = getDayBoundsUtc();
  return prisma.usageAnalysisEvent.count({
    where: { userId, source: FIND_WALLET_SOURCE, createdAt: { gte: start, lt: end } },
  });
}

export async function recordFindWalletUse(userId: string): Promise<void> {
  await prisma.usageAnalysisEvent.create({
    data: { userId, source: FIND_WALLET_SOURCE },
  });
}

/** Resolve daily limit for a non-owner user. */
export async function resolveFindWalletDailyLimit(userId: string): Promise<number> {
  const config = await getFindWalletConfig();
  const individual = await getFindWalletUserLimit(userId);
  if (individual != null) return Math.max(0, individual);
  const tier = await getSubscriptionTier(userId);
  return Math.max(0, tier === "vip" ? config.vipDailyLimit : config.freeDailyLimit);
}

export type FindWalletUsageSnapshot = {
  used: number;
  limit: number | null;
  remaining: number | null;
  unlimited: boolean;
  resets: string;
};

export async function getFindWalletUsage(userId: string, isOwner: boolean): Promise<FindWalletUsageSnapshot> {
  if (isOwner) {
    return { used: 0, limit: null, remaining: null, unlimited: true, resets: "midnight UTC" };
  }
  const limit = await resolveFindWalletDailyLimit(userId);
  const used = await countFindWalletUsesToday(userId);
  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    unlimited: false,
    resets: "midnight UTC",
  };
}
