import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import { getEarlyCatchAccess } from "@/lib/early-catch-access";
import { runEarlyCatchScan } from "@/lib/early-catch-scanner";
import { prisma } from "@/lib/db";
import { getSubscriptionTier } from "@/lib/subscription";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SOURCE = "early_catch";
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
  earlyCatchConfig?: {
    findUnique: (a: { where: { id: string } }) => Promise<{
      enabled: boolean;
      vipDailyLimit: number;
      freeDailyLimit: number;
      maxMarketCapUsd: number;
      minLiquidityUsd: number;
    } | null>;
  };
  earlyCatchUserLimit?: {
    findUnique: (a: { where: { userId: string } }) => Promise<{ dailyLimit: number } | null>;
  };
};

async function getConfig() {
  const db = (prisma as unknown as PrismaExt).earlyCatchConfig;
  if (!db) {
    return {
      enabled: true,
      vipDailyLimit: 1,
      freeDailyLimit: 0,
      maxMarketCapUsd: 20000,
      minLiquidityUsd: 2000,
    };
  }
  const row = await db.findUnique({ where: { id: CONFIG_ID } });
  return (
    row ?? {
      enabled: true,
      vipDailyLimit: 1,
      freeDailyLimit: 0,
      maxMarketCapUsd: 20000,
      minLiquidityUsd: 2000,
    }
  );
}

async function getUserLimit(userId: string): Promise<number | null> {
  const db = (prisma as unknown as PrismaExt).earlyCatchUserLimit;
  if (!db) return null;
  const row = await db.findUnique({ where: { userId } });
  return row?.dailyLimit ?? null;
}

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    const access = await getEarlyCatchAccess(session);
    if (!access.ok) {
      return NextResponse.json(
        { success: false, error: access.error, locked: access.locked, disabled: access.disabled },
        { status: access.status }
      );
    }

    const config = await getConfig();
    if (!config.enabled && !access.isOwner) {
      return NextResponse.json(
        { success: false, error: "Early Catch is currently disabled by admin.", locked: true },
        { status: 403 }
      );
    }

    const isOwner = isOwnerSession(session);
    if (!isOwner) {
      const individual = await getUserLimit(access.userId);
      const tier = await getSubscriptionTier(access.userId);
      const dailyLimit = individual ?? (tier === "vip" ? config.vipDailyLimit : config.freeDailyLimit);
      if (dailyLimit === 0) {
        return NextResponse.json(
          { success: false, error: "Your access to Early Catch has been disabled.", locked: true },
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
            error: `Daily limit reached (${dailyLimit} scan${dailyLimit !== 1 ? "s" : ""} per day — resets midnight UTC).`,
            locked: true,
            limitReached: true,
            used: usedToday,
            limit: dailyLimit,
          },
          { status: 429 }
        );
      }
    }

    const result = await runEarlyCatchScan({
      maxMarketCapUsd: config.maxMarketCapUsd,
      minLiquidityUsd: config.minLiquidityUsd,
    });

    if (!isOwner) {
      await prisma.usageAnalysisEvent.create({
        data: { userId: access.userId, source: SOURCE },
      });
    }

    return NextResponse.json({ success: true, result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Early Catch failed";
    console.error("early-catch:", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
