import { NextResponse } from "next/server";
import { getSessionAndSubscription } from "@/lib/auth-server";
import { FEATURE_FLAG_KEYS, getFeatureFlag } from "@/lib/feature-flags";
import { prisma } from "@/lib/db";
import {
  TRADING_UNIVERSITY_LESSONS,
  TRADING_UNIVERSITY_PASS_PCT,
  TRADING_UNIVERSITY_QUIZ_SIZE,
} from "@/lib/trading-university/content";
import { getOrCreateProgress, serializeProgress } from "@/lib/trading-university/progress";

export const dynamic = "force-dynamic";

export async function GET() {
  const enabled = await getFeatureFlag(FEATURE_FLAG_KEYS.PAGE_TAB_TRADING_UNIVERSITY);
  if (!enabled) {
    return NextResponse.json({ success: false, error: "Trading University is disabled." }, { status: 403 });
  }

  const { userId, session } = await getSessionAndSubscription();
  const catalog = {
    lessons: TRADING_UNIVERSITY_LESSONS.map((l) => ({
      id: l.id,
      title: l.title,
      subtitle: l.subtitle,
      estimatedMinutes: l.estimatedMinutes,
      sections: l.sections,
      keyTerms: l.keyTerms,
    })),
    passPct: TRADING_UNIVERSITY_PASS_PCT,
    quizSize: TRADING_UNIVERSITY_QUIZ_SIZE,
  };

  if (!userId) {
    return NextResponse.json({
      success: true,
      authenticated: false,
      catalog,
      progress: null,
    });
  }

  const row = await getOrCreateProgress(userId);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const displayName =
    (user as { name?: string | null } | null)?.name?.trim() ||
    session?.user?.name?.trim() ||
    session?.user?.email?.split("@")[0] ||
    "Graduate";

  return NextResponse.json({
    success: true,
    authenticated: true,
    catalog,
    progress: serializeProgress(row, displayName),
  });
}
