import { NextResponse } from "next/server";
import { getSessionAndSubscription } from "@/lib/auth-server";
import { FEATURE_FLAG_KEYS, getFeatureFlag } from "@/lib/feature-flags";
import { prisma } from "@/lib/db";
import {
  TRADING_UNIVERSITY_PASS_PCT,
  allLessonIds,
} from "@/lib/trading-university/content";
import { getPublicQuizQuestions, scoreQuizAnswers } from "@/lib/trading-university/quiz";
import {
  canAttemptQuizToday,
  getOrCreateProgress,
  makeCertificateCode,
  serializeProgress,
} from "@/lib/trading-university/progress";

export const dynamic = "force-dynamic";

// re-export parse helper locally if not exported - I'll add parseLessonIdsSafe
function parseCompleted(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set(allLessonIds());
  return raw.filter((x): x is string => typeof x === "string" && allowed.has(x));
}

/** GET — quiz questions without answers (auth + lessons complete + daily attempt). */
export async function GET() {
  const enabled = await getFeatureFlag(FEATURE_FLAG_KEYS.PAGE_TAB_TRADING_UNIVERSITY);
  if (!enabled) {
    return NextResponse.json({ success: false, error: "Trading University is disabled." }, { status: 403 });
  }

  const { userId } = await getSessionAndSubscription();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Sign in required to take the quiz." }, { status: 401 });
  }

  const row = await getOrCreateProgress(userId);
  if (row.quizPassed) {
    return NextResponse.json({
      success: false,
      error: "You already graduated. Download your certificate from the University tab.",
      alreadyPassed: true,
    }, { status: 400 });
  }

  const completed = parseCompleted(row.completedLessons);
  const allDone = allLessonIds().every((id) => completed.includes(id));
  if (!allDone) {
    return NextResponse.json({
      success: false,
      error: "Complete all lessons before taking the quiz.",
    }, { status: 400 });
  }

  const attempt = canAttemptQuizToday(row);
  if (!attempt.allowed) {
    return NextResponse.json({
      success: false,
      error: "You already used today’s quiz attempt. Try again after UTC midnight.",
      nextAttemptAt: attempt.nextAttemptAt,
    }, { status: 429 });
  }

  return NextResponse.json({
    success: true,
    passPct: TRADING_UNIVERSITY_PASS_PCT,
    questions: getPublicQuizQuestions(),
  });
}

/** POST — grade answers server-side. */
export async function POST(request: Request) {
  const enabled = await getFeatureFlag(FEATURE_FLAG_KEYS.PAGE_TAB_TRADING_UNIVERSITY);
  if (!enabled) {
    return NextResponse.json({ success: false, error: "Trading University is disabled." }, { status: 403 });
  }

  const { userId, session } = await getSessionAndSubscription();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
  }

  const row = await getOrCreateProgress(userId);
  if (row.quizPassed) {
    return NextResponse.json({
      success: false,
      error: "Already graduated.",
      alreadyPassed: true,
    }, { status: 400 });
  }

  const completed = parseCompleted(row.completedLessons);
  if (!allLessonIds().every((id) => completed.includes(id))) {
    return NextResponse.json({ success: false, error: "Complete all lessons first." }, { status: 400 });
  }

  const attempt = canAttemptQuizToday(row);
  if (!attempt.allowed) {
    return NextResponse.json({
      success: false,
      error: "Daily attempt already used. Come back tomorrow (UTC).",
      nextAttemptAt: attempt.nextAttemptAt,
    }, { status: 429 });
  }

  let body: { answers?: Record<string, number> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON." }, { status: 400 });
  }

  const answers = body.answers;
  if (!answers || typeof answers !== "object") {
    return NextResponse.json({ success: false, error: "Answers required." }, { status: 400 });
  }

  const normalized: Record<string, number> = {};
  for (const [k, v] of Object.entries(answers)) {
    if (typeof v === "number" && Number.isInteger(v)) normalized[k] = v;
  }

  const scored = scoreQuizAnswers(normalized);
  const passed = scored.scorePct >= TRADING_UNIVERSITY_PASS_PCT;
  const now = new Date();

  const db = (prisma as unknown as {
    tradingUniversityProgress: {
      upsert: (args: {
        where: { userId: string };
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) => Promise<typeof row>;
    };
  }).tradingUniversityProgress;

  const update: Record<string, unknown> = {
    lastAttemptAt: now,
    attemptCount: (row.attemptCount ?? 0) + 1,
    quizBestScorePct:
      row.quizBestScorePct == null
        ? scored.scorePct
        : Math.max(row.quizBestScorePct, scored.scorePct),
  };

  if (passed) {
    update.quizPassed = true;
    update.quizPassedAt = now;
    update.certificateCode = row.certificateCode || makeCertificateCode();
  } else {
    update.lastFailedAt = now;
  }

  const saved = await db.upsert({
    where: { userId },
    create: {
      userId,
      completedLessons: completed,
      lastAttemptAt: now,
      attemptCount: 1,
      quizBestScorePct: scored.scorePct,
      quizPassed: passed,
      quizPassedAt: passed ? now : null,
      lastFailedAt: passed ? null : now,
      certificateCode: passed ? makeCertificateCode() : null,
    },
    update,
  });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  const displayName =
    (user as { name?: string | null } | null)?.name?.trim() ||
    session?.user?.name?.trim() ||
    session?.user?.email?.split("@")[0] ||
    "Graduate";

  return NextResponse.json({
    success: true,
    passed,
    correct: scored.correct,
    total: scored.total,
    scorePct: scored.scorePct,
    passPct: TRADING_UNIVERSITY_PASS_PCT,
    missedCount: scored.missedIds.length,
    progress: serializeProgress(saved, displayName),
  });
}
