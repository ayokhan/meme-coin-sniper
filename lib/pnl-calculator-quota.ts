import { prisma } from "@/lib/db";
import { normalizeVisitorId } from "@/lib/visitor-id";

export const PNL_CALCULATOR_SOURCE = "pnl_calculator";
export const PNL_CALCULATOR_CONFIG_ID = "default";

export type PnlCalculatorConfigRow = {
  enabled: boolean;
  guestDailyLimit: number;
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
  pnlCalculatorGuestUse?: {
    count: (a: object) => Promise<number>;
    create: (a: object) => Promise<unknown>;
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
    return { enabled: true, guestDailyLimit: 2, freeDailyLimit: 4, vipDailyLimit: 0 };
  }
  const row = await db.findUnique({ where: { id: PNL_CALCULATOR_CONFIG_ID } });
  return row ?? { enabled: true, guestDailyLimit: 2, freeDailyLimit: 4, vipDailyLimit: 0 };
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
  isGuest: boolean;
  guestDailyLimit: number;
  freeDailyLimit: number;
  vipDailyLimit: number;
}): number | null {
  if (opts.individualLimit != null) {
    if (opts.individualLimit < 0) return null;
    return opts.individualLimit;
  }
  if (opts.isGuest) return opts.guestDailyLimit;
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

export async function countPnlCalculatorGuestUsesToday(visitorId: string): Promise<number> {
  const db = (prisma as unknown as PrismaExt).pnlCalculatorGuestUse;
  if (!db) return 0;
  const { start, end } = getDayBoundsUtc();
  return db.count({
    where: { visitorId, createdAt: { gte: start, lt: end } },
  });
}

export async function recordPnlCalculatorUse(userId: string): Promise<void> {
  await prisma.usageAnalysisEvent.create({
    data: { userId, source: PNL_CALCULATOR_SOURCE },
  });
}

export async function recordPnlCalculatorGuestUse(visitorId: string): Promise<void> {
  const id = normalizeVisitorId(visitorId);
  if (!id) return;
  const db = (prisma as unknown as PrismaExt).pnlCalculatorGuestUse;
  if (!db) return;
  await db.create({ data: { visitorId: id } });
}

export function parseVisitorIdFromRequest(url: URL, headerVisitorId?: string | null): string | null {
  const fromQuery = normalizeVisitorId(url.searchParams.get("visitorId"));
  if (fromQuery) return fromQuery;
  return normalizeVisitorId(headerVisitorId);
}
