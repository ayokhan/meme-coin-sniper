import { NextResponse } from "next/server";
import { getSessionAndSubscription } from "@/lib/auth-server";
import { isOwnerSession } from "@/lib/auth";
import { runNarrativeScan, parseNarrativeChain, type NarrativeTimeframe } from "@/lib/narrative-scanner";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SOURCE = "narrative_scanner";

function getDayBounds(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

type PrismaExt = typeof prisma & {
  narrativeScannerConfig?: {
    findUnique: (a: { where: { id: string } }) => Promise<{ enabled: boolean; freeDailyLimit: number; vipDailyLimit: number } | null>;
  };
  narrativeScannerUserLimit?: {
    findUnique: (a: { where: { userId: string } }) => Promise<{ dailyLimit: number } | null>;
  };
};

async function getConfig() {
  const db = (prisma as unknown as PrismaExt).narrativeScannerConfig;
  if (!db) return { enabled: true, freeDailyLimit: 1, vipDailyLimit: 5 };
  const row = await db.findUnique({ where: { id: "default" } });
  return row ?? { enabled: true, freeDailyLimit: 1, vipDailyLimit: 5 };
}

async function getUserLimit(userId: string): Promise<number | null> {
  const db = (prisma as unknown as PrismaExt).narrativeScannerUserLimit;
  if (!db) return null;
  const row = await db.findUnique({ where: { userId } });
  return row?.dailyLimit ?? null;
}

export async function POST(request: Request) {
  try {
    const { session, isPaid } = await getSessionAndSubscription();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Sign in to use the Narrative Scanner.", locked: true },
        { status: 401 }
      );
    }

    const config = await getConfig();

    if (!config.enabled) {
      const isOwner = isOwnerSession(session);
      if (!isOwner) {
        return NextResponse.json(
          { success: false, error: "Narrative Scanner is currently disabled by admin.", locked: true },
          { status: 403 }
        );
      }
    }

    const isOwner = isOwnerSession(session);

    if (!isOwner) {
      const individualLimit = await getUserLimit(userId);
      const dailyLimit = individualLimit ?? (isPaid ? config.vipDailyLimit : config.freeDailyLimit);

      if (dailyLimit === 0) {
        return NextResponse.json(
          { success: false, error: "Your access to the Narrative Scanner has been disabled.", locked: true },
          { status: 403 }
        );
      }

      const { start, end } = getDayBounds();
      const usedToday = await prisma.usageAnalysisEvent.count({
        where: { userId, source: SOURCE, createdAt: { gte: start, lt: end } },
      });

      if (usedToday >= dailyLimit) {
        return NextResponse.json(
          {
            success: false,
            error: `Daily limit reached (${dailyLimit} scan${dailyLimit !== 1 ? "s" : ""} per day — resets midnight UTC).${!isPaid ? " Upgrade to Pro or VIP for more." : ""}`,
            locked: true,
            limitReached: true,
            used: usedToday,
            limit: dailyLimit,
          },
          { status: 429 }
        );
      }
    }

    const body = await request.json().catch(() => ({}));
    const validTf = new Set(["5m", "15m", "30m", "1h", "4h", "daily", "weekly"]);
    const timeframe: NarrativeTimeframe = validTf.has(body.timeframe) ? body.timeframe : "daily";
    const chain = parseNarrativeChain(body.chain);

    const result = await runNarrativeScan(timeframe, chain);

    if (!isOwner) {
      await prisma.usageAnalysisEvent.create({
        data: { userId, source: SOURCE },
      });
    }

    return NextResponse.json({ success: true, result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Narrative Scanner failed";
    console.error("narrative-scanner:", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
