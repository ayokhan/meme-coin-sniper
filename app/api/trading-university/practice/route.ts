import { NextResponse } from "next/server";
import { getSessionAndSubscription } from "@/lib/auth-server";
import { FEATURE_FLAG_KEYS, getFeatureFlag } from "@/lib/feature-flags";
import {
  getPracticeQuestionsForLesson,
  scorePracticeAnswers,
} from "@/lib/trading-university/quiz";
import { allLessonIds } from "@/lib/trading-university/content";

export const dynamic = "force-dynamic";

/** GET ?lessonId= — untimed practice questions (no answers). Auth required. */
export async function GET(request: Request) {
  const enabled = await getFeatureFlag(FEATURE_FLAG_KEYS.PAGE_TAB_TRADING_UNIVERSITY);
  if (!enabled) {
    return NextResponse.json({ success: false, error: "Disabled." }, { status: 403 });
  }
  const { userId } = await getSessionAndSubscription();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
  }
  const lessonId = new URL(request.url).searchParams.get("lessonId") ?? "";
  if (!allLessonIds().includes(lessonId)) {
    return NextResponse.json({ success: false, error: "Unknown module." }, { status: 400 });
  }
  return NextResponse.json({
    success: true,
    questions: getPracticeQuestionsForLesson(lessonId, 3),
  });
}

/** POST — grade practice (does not affect final exam). */
export async function POST(request: Request) {
  const enabled = await getFeatureFlag(FEATURE_FLAG_KEYS.PAGE_TAB_TRADING_UNIVERSITY);
  if (!enabled) {
    return NextResponse.json({ success: false, error: "Disabled." }, { status: 403 });
  }
  const { userId } = await getSessionAndSubscription();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
  }
  let body: { answers?: Record<string, number> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON." }, { status: 400 });
  }
  const answers = body.answers ?? {};
  const scored = scorePracticeAnswers(answers);
  return NextResponse.json({ success: true, ...scored });
}
