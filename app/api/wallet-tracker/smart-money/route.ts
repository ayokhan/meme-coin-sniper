import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import { getSmartMoneyAlertsAccess } from "@/lib/smart-money-access";
import { prisma } from "@/lib/db";
import { runSmartMoneyScan } from "@/lib/smart-money-scanner";
import { getSubscriptionTier } from "@/lib/subscription";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SOURCE = "smart_money_alerts";
const CONFIG_ID = "default";

function getDayBounds(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

type PrismaExt = typeof prisma & {
  smartMoneyConfig?: {
    findUnique: (a: { where: { id: string } }) => Promise<{
      enabled: boolean;
      vipDailyLimit: number;
      freeDailyLimit: number;
    } | null>;
  };
  smartMoneyUserLimit?: {
    findUnique: (a: { where: { userId: string } }) => Promise<{ dailyLimit: number } | null>;
  };
  smartMoneyAlert?: {
    findMany: (a: object) => Promise<unknown[]>;
  };
  smartMoneyWallet?: {
    findMany: (a: object) => Promise<unknown[]>;
    count: (a?: object) => Promise<number>;
  };
};

async function getConfig() {
  const db = (prisma as unknown as PrismaExt).smartMoneyConfig;
  if (!db) return { enabled: true, vipDailyLimit: 1, freeDailyLimit: 0 };
  const row = await db.findUnique({ where: { id: CONFIG_ID } });
  return row ?? { enabled: true, vipDailyLimit: 1, freeDailyLimit: 0 };
}

async function getUserLimit(userId: string): Promise<number | null> {
  const db = (prisma as unknown as PrismaExt).smartMoneyUserLimit;
  if (!db) return null;
  const row = await db.findUnique({ where: { userId } });
  return row?.dailyLimit ?? null;
}

/** GET: list recent alerts + wallets (read does not consume daily quota). */
export async function GET() {
  const session = await getServerSession(authOptions);
  const access = await getSmartMoneyAlertsAccess(session);
  if (!access.ok) {
    return NextResponse.json({ success: false, error: access.error }, { status: access.status });
  }

  const ext = prisma as unknown as PrismaExt;
  const alerts = ext.smartMoneyAlert
    ? await ext.smartMoneyAlert.findMany({
        orderBy: { createdAt: "desc" },
        take: 80,
      } as object)
    : [];
  const wallets = ext.smartMoneyWallet
    ? await ext.smartMoneyWallet.findMany({
        where: { active: true },
        orderBy: { createdAt: "asc" },
        take: 40,
      } as object)
    : [];

  const config = await getConfig();
  const isOwner = isOwnerSession(session);
  let used = 0;
  let limit = config.vipDailyLimit;
  if (!isOwner) {
    const individual = await getUserLimit(access.userId);
    const tier = await getSubscriptionTier(access.userId);
    limit = individual ?? (tier === "vip" ? config.vipDailyLimit : config.freeDailyLimit);
    const { start, end } = getDayBounds();
    used = await prisma.usageAnalysisEvent.count({
      where: { userId: access.userId, source: SOURCE, createdAt: { gte: start, lt: end } },
    });
  }

  return NextResponse.json({
    success: true,
    alerts,
    wallets,
    isOwner,
    usage: { used, limit: isOwner ? null : limit, resets: "midnight UTC" },
  });
}

/** POST: run scan (consumes VIP daily quota unless owner). */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    const access = await getSmartMoneyAlertsAccess(session);
    if (!access.ok) {
      return NextResponse.json({ success: false, error: access.error }, { status: access.status });
    }

    const config = await getConfig();
    if (!config.enabled && !access.isOwner) {
      return NextResponse.json(
        { success: false, error: "Smart Money Alerts is currently disabled by admin.", locked: true },
        { status: 403 }
      );
    }

    if (!access.isOwner) {
      const individual = await getUserLimit(access.userId);
      const tier = await getSubscriptionTier(access.userId);
      const dailyLimit = individual ?? (tier === "vip" ? config.vipDailyLimit : config.freeDailyLimit);
      if (dailyLimit === 0) {
        return NextResponse.json(
          { success: false, error: "Your access to Smart Money Alerts refresh has been disabled.", locked: true },
          { status: 403 }
        );
      }
      const { start, end } = getDayBounds();
      const usedToday = await prisma.usageAnalysisEvent.count({
        where: { userId: access.userId, source: SOURCE, createdAt: { gte: start, lt: end } },
      });
      if (usedToday >= dailyLimit) {
        return NextResponse.json(
          {
            success: false,
            error: `Daily limit reached (${dailyLimit} refresh${dailyLimit !== 1 ? "es" : ""} per day — resets midnight UTC).`,
            locked: true,
            limitReached: true,
            used: usedToday,
            limit: dailyLimit,
          },
          { status: 429 }
        );
      }
    }

    const result = await runSmartMoneyScan();

    if (!access.isOwner) {
      await prisma.usageAnalysisEvent.create({
        data: { userId: access.userId, source: SOURCE },
      });
    }

    return NextResponse.json({ success: true, result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Smart Money scan failed";
    console.error("smart-money:", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
