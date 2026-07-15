import { NextResponse } from "next/server";
import { getSessionAndSubscription } from "@/lib/auth-server";
import { FEATURE_FLAG_KEYS, getFeatureFlag } from "@/lib/feature-flags";
import { prisma } from "@/lib/db";
import {
  TRADING_UNIVERSITY_EXAM_MINUTES,
  TRADING_UNIVERSITY_PASS_CORRECT,
  TRADING_UNIVERSITY_PASS_PCT,
  allLessonIds,
} from "@/lib/trading-university/content";
import {
  getPublicQuizQuestions,
  isExamSetId,
  pickExamSetId,
  scoreQuizAnswers,
  type ExamSetId,
} from "@/lib/trading-university/quiz";
import {
  canAttemptQuizToday,
  examExpiresAt,
  finalizeExpiredExam,
  getOrCreateProgress,
  isExamExpired,
  isExamInProgress,
  makeCertificateCode,
  serializeProgress,
  type DbProgress,
} from "@/lib/trading-university/progress";

export const dynamic = "force-dynamic";

function parseCompleted(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set(allLessonIds());
  return raw.filter((x): x is string => typeof x === "string" && allowed.has(x));
}

function progressDb() {
  return (prisma as unknown as {
    tradingUniversityProgress: {
      upsert: (args: {
        where: { userId: string };
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) => Promise<DbProgress>;
    };
  }).tradingUniversityProgress;
}

async function displayNameFor(userId: string, sessionName?: string | null, email?: string | null) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return (
    (user as { name?: string | null } | null)?.name?.trim() ||
    sessionName?.trim() ||
    email?.split("@")[0] ||
    "Graduate"
  );
}

/** GET — start or resume timed exam (auth + lessons complete + daily attempt). */
export async function GET() {
  const enabled = await getFeatureFlag(FEATURE_FLAG_KEYS.PAGE_TAB_TRADING_UNIVERSITY);
  if (!enabled) {
    return NextResponse.json({ success: false, error: "Trading University is disabled." }, { status: 403 });
  }

  const { userId, session } = await getSessionAndSubscription();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Sign in required to take the quiz." }, { status: 401 });
  }

  let row = await getOrCreateProgress(userId);
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
      error: "Complete all modules before taking the final exam.",
    }, { status: 400 });
  }

  if (isExamInProgress(row) && isExamExpired(row)) {
    row = await finalizeExpiredExam(userId, row);
    return NextResponse.json({
      success: false,
      error: `Your ${TRADING_UNIVERSITY_EXAM_MINUTES}-minute exam window expired. That attempt is used — try again after UTC midnight.`,
      nextAttemptAt: canAttemptQuizToday(row).nextAttemptAt,
      timedOut: true,
    }, { status: 429 });
  }

  const attempt = canAttemptQuizToday(row);
  if (!attempt.allowed) {
    return NextResponse.json({
      success: false,
      error: "You already used today’s exam attempt. Try again after UTC midnight.",
      nextAttemptAt: attempt.nextAttemptAt,
    }, { status: 429 });
  }

  const db = progressDb();
  let startedAt = row.quizExamStartedAt ?? null;
  let setId: ExamSetId =
    isExamSetId(row.examSetId) && attempt.resume ? row.examSetId : pickExamSetId(row.examSetId);
  if (!attempt.resume || !startedAt) {
    startedAt = new Date();
    setId = pickExamSetId(row.examSetId);
    row = await db.upsert({
      where: { userId },
      create: {
        userId,
        completedLessons: completed,
        quizExamStartedAt: startedAt,
        examTabLeaveCount: 0,
        examSetId: setId,
      },
      update: {
        quizExamStartedAt: startedAt,
        examTabLeaveCount: 0,
        examSetId: setId,
      },
    });
    startedAt = row.quizExamStartedAt ?? startedAt;
    if (isExamSetId(row.examSetId)) setId = row.examSetId;
  }

  const expires = examExpiresAt(startedAt!);
  const name = await displayNameFor(userId, session?.user?.name, session?.user?.email);

  return NextResponse.json({
    success: true,
    passPct: TRADING_UNIVERSITY_PASS_PCT,
    passCorrect: TRADING_UNIVERSITY_PASS_CORRECT,
    examMinutes: TRADING_UNIVERSITY_EXAM_MINUTES,
    examStartedAt: startedAt!.toISOString(),
    examExpiresAt: expires.toISOString(),
    examSetId: setId,
    resumed: attempt.resume,
    examTabLeaveCount: row.examTabLeaveCount ?? 0,
    questions: getPublicQuizQuestions(setId),
    progress: serializeProgress(row, name),
  });
}

/** POST — grade answers; enforces timed exam window. */
export async function POST(request: Request) {
  const enabled = await getFeatureFlag(FEATURE_FLAG_KEYS.PAGE_TAB_TRADING_UNIVERSITY);
  if (!enabled) {
    return NextResponse.json({ success: false, error: "Trading University is disabled." }, { status: 403 });
  }

  const { userId, session } = await getSessionAndSubscription();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
  }

  let row = await getOrCreateProgress(userId);
  if (row.quizPassed) {
    return NextResponse.json({
      success: false,
      error: "Already graduated.",
      alreadyPassed: true,
    }, { status: 400 });
  }

  const completed = parseCompleted(row.completedLessons);
  if (!allLessonIds().every((id) => completed.includes(id))) {
    return NextResponse.json({ success: false, error: "Complete all modules first." }, { status: 400 });
  }

  let body: {
    answers?: Record<string, number>;
    reason?: "submit" | "timeout" | "tab_leaves";
    tabLeaveCount?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON." }, { status: 400 });
  }

  const now = new Date();
  const started = row.quizExamStartedAt ?? null;

  if (!started || !isExamInProgress(row)) {
    const attempt = canAttemptQuizToday(row);
    if (!attempt.allowed) {
      return NextResponse.json({
        success: false,
        error: "Daily attempt already used. Come back tomorrow (UTC).",
        nextAttemptAt: attempt.nextAttemptAt,
      }, { status: 429 });
    }
    return NextResponse.json({
      success: false,
      error: "No active exam session. Start the exam again.",
    }, { status: 400 });
  }

  const expired = isExamExpired(row, now);
  const reason = body.reason === "timeout" || body.reason === "tab_leaves" ? body.reason : "submit";

  const answers = body.answers;
  const normalized: Record<string, number> = {};
  if (answers && typeof answers === "object") {
    for (const [k, v] of Object.entries(answers)) {
      if (typeof v === "number" && Number.isInteger(v)) normalized[k] = v;
    }
  }

  const scored = scoreQuizAnswers(normalized, isExamSetId(row.examSetId) ? row.examSetId : "A");
  /** Timed-out or integrity auto-submit cannot pass, even if answers are complete. */
  const integrityFail = reason === "timeout" || reason === "tab_leaves" || expired;
  const passed = !integrityFail && scored.correct >= TRADING_UNIVERSITY_PASS_CORRECT;

  const leaveCount =
    typeof body.tabLeaveCount === "number" && Number.isFinite(body.tabLeaveCount)
      ? Math.max(row.examTabLeaveCount ?? 0, Math.floor(body.tabLeaveCount))
      : row.examTabLeaveCount ?? 0;

  const db = progressDb();
  const update: Record<string, unknown> = {
    lastAttemptAt: now,
    attemptCount: (row.attemptCount ?? 0) + 1,
    quizExamStartedAt: null,
    examTabLeaveCount: 0,
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
      quizExamStartedAt: null,
      examTabLeaveCount: 0,
    },
    update,
  });

  const name = await displayNameFor(userId, session?.user?.name, session?.user?.email);

  return NextResponse.json({
    success: true,
    passed,
    correct: scored.correct,
    total: scored.total,
    scorePct: scored.scorePct,
    passPct: TRADING_UNIVERSITY_PASS_PCT,
    passCorrect: TRADING_UNIVERSITY_PASS_CORRECT,
    missedCount: scored.missedIds.length,
    missedLessonIds: scored.missedLessonIds,
    timedOut: expired || reason === "timeout",
    tabLeaveFail: reason === "tab_leaves",
    examTabLeaveCount: leaveCount,
    progress: serializeProgress(saved, name),
  });
}

/** PATCH — record a tab/window leave during an active exam. */
export async function PATCH() {
  const enabled = await getFeatureFlag(FEATURE_FLAG_KEYS.PAGE_TAB_TRADING_UNIVERSITY);
  if (!enabled) {
    return NextResponse.json({ success: false, error: "Trading University is disabled." }, { status: 403 });
  }

  const { userId } = await getSessionAndSubscription();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
  }

  const row = await getOrCreateProgress(userId);
  if (!isExamInProgress(row) || isExamExpired(row)) {
    return NextResponse.json({ success: false, error: "No active exam." }, { status: 400 });
  }

  const next = (row.examTabLeaveCount ?? 0) + 1;
  const db = progressDb();
  const saved = await db.upsert({
    where: { userId },
    create: { userId, completedLessons: [], examTabLeaveCount: next, quizExamStartedAt: row.quizExamStartedAt },
    update: { examTabLeaveCount: next },
  });

  return NextResponse.json({
    success: true,
    examTabLeaveCount: saved.examTabLeaveCount ?? next,
  });
}
