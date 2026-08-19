import { NextResponse } from "next/server";
import { getSessionAndSubscription } from "@/lib/auth-server";
import { isOwnerSession } from "@/lib/auth";
import { runNarrativeScan, type NarrativeTimeframe } from "@/lib/narrative-scanner";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const FREE_DAILY_LIMIT = 1;
const SOURCE = "narrative_scanner";

function getDayBounds(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
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

    const isOwner = isOwnerSession(session);
    const unlimited = isPaid || isOwner;

    if (!unlimited) {
      const { start, end } = getDayBounds();
      const usedToday = await prisma.usageAnalysisEvent.count({
        where: { userId, source: SOURCE, createdAt: { gte: start, lt: end } },
      });
      if (usedToday >= FREE_DAILY_LIMIT) {
        return NextResponse.json(
          {
            success: false,
            error: `Daily limit reached (${FREE_DAILY_LIMIT} free Narrative Scanner scan per day — resets at midnight UTC). Upgrade to Pro or VIP for unlimited access.`,
            locked: true,
            limitReached: true,
            used: usedToday,
            limit: FREE_DAILY_LIMIT,
          },
          { status: 429 }
        );
      }
    }

    const body = await request.json().catch(() => ({}));
    const timeframe: NarrativeTimeframe =
      body.timeframe === "4h" ? "4h" : body.timeframe === "weekly" ? "weekly" : "daily";

    const result = await runNarrativeScan(timeframe);

    if (!unlimited) {
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
