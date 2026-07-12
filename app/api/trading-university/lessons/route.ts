import { NextResponse } from "next/server";
import { getSessionAndSubscription } from "@/lib/auth-server";
import { FEATURE_FLAG_KEYS, getFeatureFlag } from "@/lib/feature-flags";
import { allLessonIds } from "@/lib/trading-university/content";
import { markLessonComplete, serializeProgress } from "@/lib/trading-university/progress";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** POST — mark a lesson complete (auth required). */
export async function POST(request: Request) {
  const enabled = await getFeatureFlag(FEATURE_FLAG_KEYS.PAGE_TAB_TRADING_UNIVERSITY);
  if (!enabled) {
    return NextResponse.json({ success: false, error: "Trading University is disabled." }, { status: 403 });
  }

  const { userId, session } = await getSessionAndSubscription();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
  }

  let body: { lessonId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON." }, { status: 400 });
  }

  const lessonId = typeof body.lessonId === "string" ? body.lessonId : "";
  if (!allLessonIds().includes(lessonId)) {
    return NextResponse.json({ success: false, error: "Unknown lesson." }, { status: 400 });
  }

  try {
    const row = await markLessonComplete(userId, lessonId);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const displayName =
      (user as { name?: string | null } | null)?.name?.trim() ||
      session?.user?.name?.trim() ||
      session?.user?.email?.split("@")[0] ||
      "Graduate";
    return NextResponse.json({
      success: true,
      progress: serializeProgress(row, displayName),
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to save." },
      { status: 500 }
    );
  }
}
