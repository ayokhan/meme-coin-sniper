import { NextResponse } from "next/server";
import { FEATURE_FLAG_KEYS, getFeatureFlag } from "@/lib/feature-flags";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

/** Recent graduates (first name / handle only) for the University tab. */
export async function GET() {
  const enabled = await getFeatureFlag(FEATURE_FLAG_KEYS.PAGE_TAB_TRADING_UNIVERSITY);
  if (!enabled) {
    return NextResponse.json({ success: false, error: "Disabled." }, { status: 403 });
  }

  try {
    const rows = (await db.tradingUniversityProgress.findMany({
      where: { quizPassed: true },
      orderBy: { quizPassedAt: "desc" },
      take: 12,
      include: { user: { select: { name: true, email: true } } },
    })) as Array<{
      quizBestScorePct: number | null;
      quizPassedAt: Date | null;
      user: { name: string | null; email: string | null };
    }>;

    const graduates = rows.map((r) => {
      const raw =
        r.user.name?.trim() ||
        r.user.email?.split("@")[0] ||
        "Graduate";
      const displayName = raw.split(/\s+/)[0]!.slice(0, 24);
      return {
        displayName,
        scorePct: r.quizBestScorePct,
        passedAt: r.quizPassedAt?.toISOString() ?? null,
      };
    });

    return NextResponse.json({ success: true, graduates });
  } catch {
    return NextResponse.json({ success: true, graduates: [] });
  }
}
