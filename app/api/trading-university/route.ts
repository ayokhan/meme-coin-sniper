import { NextResponse } from "next/server";
import { getSessionAndSubscription } from "@/lib/auth-server";
import { FEATURE_FLAG_KEYS, getFeatureFlag } from "@/lib/feature-flags";
import { prisma } from "@/lib/db";
import {
  TRADING_UNIVERSITY_EXAM_MINUTES,
  TRADING_UNIVERSITY_LESSONS,
  TRADING_UNIVERSITY_PASS_CORRECT,
  TRADING_UNIVERSITY_PASS_PCT,
  TRADING_UNIVERSITY_QUIZ_SIZE,
} from "@/lib/trading-university/content";
import { getOrCreateProgress, serializeProgress } from "@/lib/trading-university/progress";

export const dynamic = "force-dynamic";

/** Guests see syllabus + one free preview module; full course requires sign-in. */
const PREVIEW_LESSON_ID = TRADING_UNIVERSITY_LESSONS[0]?.id ?? "meme-coins";

export async function GET() {
  const enabled = await getFeatureFlag(FEATURE_FLAG_KEYS.PAGE_TAB_TRADING_UNIVERSITY);
  if (!enabled) {
    return NextResponse.json({ success: false, error: "Trading University is disabled." }, { status: 403 });
  }

  const { userId, session } = await getSessionAndSubscription();
  const fullAccess = !!userId;

  const donationsEnabled = await getFeatureFlag(FEATURE_FLAG_KEYS.TRADING_UNIVERSITY_DONATIONS);

  const catalog = {
    lessons: TRADING_UNIVERSITY_LESSONS.map((l) => {
      const unlocked = fullAccess || l.id === PREVIEW_LESSON_ID;
      return {
        id: l.id,
        title: l.title,
        subtitle: l.subtitle,
        estimatedMinutes: l.estimatedMinutes,
        locked: !unlocked,
        sections: unlocked ? l.sections : [],
        keyTerms: unlocked ? l.keyTerms : [],
        workedExamples: unlocked ? l.workedExamples ?? [] : [],
        relatedTools: l.relatedTools ?? [],
        diagram: unlocked ? l.diagram ?? null : null,
        track: l.track ?? undefined,
      };
    }),
    passPct: TRADING_UNIVERSITY_PASS_PCT,
    passCorrect: TRADING_UNIVERSITY_PASS_CORRECT,
    quizSize: TRADING_UNIVERSITY_QUIZ_SIZE,
    examMinutes: TRADING_UNIVERSITY_EXAM_MINUTES,
    previewLessonId: PREVIEW_LESSON_ID,
    fullAccess,
    donationsEnabled,
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
