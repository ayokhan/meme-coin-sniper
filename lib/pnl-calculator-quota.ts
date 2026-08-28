import { prisma } from "@/lib/db";

export const PNL_CALCULATOR_SOURCE = "pnl_calculator";
export const PNL_CALCULATOR_CONFIG_ID = "default";

export type PnlCalculatorConfigRow = {
  enabled: boolean;
  freeDailyLimit: number;
  vipDailyLimit: number;
};

type PrismaExt = typeof prisma & {
  pnlCalculatorConfig?: {
    findUnique: (a: { where: { id: string } }) => Promise<PnlCalculatorConfigRow | null>;
  };
  pnlCalculatorUserLimit?: {
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

export async function getPnlCalculatorConfig(): Promise<PnlCalculatorConfigRow> {
  const db = (prisma as unknown as PrismaExt).pnlCalculatorConfig;
  if (!db) {
    return { enabled: true, freeDailyLimit: 2, vipDailyLimit: 0 };
  }
  const row = await db.findUnique({ where: { id: PNL_CALCULATOR_CONFIG_ID } });
  return row ?? { enabled: true, freeDailyLimit: 2, vipDailyLimit: 0 };
}

export async function getPnlCalculatorUserLimit(userId: string): Promise<number | null> {
  const db = (prisma as unknown as PrismaExt).pnlCalculatorUserLimit;
  if (!db) return null;
  const row = await db.findUnique({ where: { userId } });
  return row?.dailyLimit ?? null;
}

/** null = unlimited */
export function resolvePnlCalculatorDailyLimit(opts: {
  individualLimit: number | null;
  isVip: boolean;
  freeDailyLimit: number;
  vipDailyLimit: number;
}): number | null {
  if (opts.individualLimit != null) {
    if (opts.individualLimit < 0) return null;
    return opts.individualLimit;
  }
  const tierLimit = opts.isVip ? opts.vipDailyLimit : opts.freeDailyLimit;
  if (opts.isVip && tierLimit === 0) return null;
  return tierLimit;
}

export async function countPnlCalculatorUsesToday(userId: string): Promise<number> {
  const { start, end } = getDayBoundsUtc();
  return prisma.usageAnalysisEvent.count({
    where: { userId, source: PNL_CALCULATOR_SOURCE, createdAt: { gte: start, lt: end } },
  });
}

export async function recordPnlCalculatorUse(userId: string): Promise<void> {
  await prisma.usageAnalysisEvent.create({
    data: { userId, source: PNL_CALCULATOR_SOURCE },
  });
}
