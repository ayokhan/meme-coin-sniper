import { NextResponse } from "next/server";
import { getSessionAndSubscription } from "@/lib/auth-server";
import { isOwnerSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

async function getOnboardingRow(userId: string) {
  return prisma.user.findUnique({ where: { id: userId } }) as Promise<{
    aiAgentOnboardingCompletedAt?: Date | null;
    createdAt?: Date;
  } | null>;
}

async function hasAiAnalysisUsage(userId: string): Promise<boolean> {
  const count = await prisma.usageAnalysisEvent.count({
    where: {
      userId,
      source: { in: ["meme_agent", "chart_analysis"] },
    } as unknown as { userId: string; source: string },
  });
  return count > 0;
}

async function hasPinnedToken(userId: string): Promise<boolean> {
  const pins = await (prisma as unknown as {
    pinnedToken: { findMany: (args: { where: { userId: string }; take: number }) => Promise<unknown[]> };
  }).pinnedToken.findMany({ where: { userId }, take: 1 });
  return pins.length > 0;
}

/** GET — should we show post-registration AI Agent onboarding? */
export async function GET() {
  const { session, isPaid, userId } = await getSessionAndSubscription();
  if (!userId) {
    return NextResponse.json({ success: true, show: false, reason: "guest" });
  }
  if (isPaid || isOwnerSession(session)) {
    return NextResponse.json({ success: true, show: false, reason: "vip" });
  }

  const user = await getOnboardingRow(userId);
  if (user?.aiAgentOnboardingCompletedAt) {
    return NextResponse.json({ success: true, show: false, reason: "completed" });
  }

  const [hasAnalyzed, hasPinned] = await Promise.all([
    hasAiAnalysisUsage(userId),
    hasPinnedToken(userId),
  ]);

  if (hasAnalyzed && hasPinned) {
    await (prisma as unknown as { user: { update: (args: unknown) => Promise<unknown> } }).user.update({
      where: { id: userId },
      data: { aiAgentOnboardingCompletedAt: new Date() },
    });
    return NextResponse.json({ success: true, show: false, reason: "auto_completed", hasAnalyzed, hasPinned });
  }

  let step: 1 | 2 | 3 = 1;
  if (hasAnalyzed) step = 3;

  return NextResponse.json({
    success: true,
    show: true,
    step,
    hasAnalyzed,
    hasPinned,
  });
}

/** POST — complete or dismiss onboarding. */
export async function POST(request: Request) {
  const { session, isPaid, userId } = await getSessionAndSubscription();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
  }
  if (isPaid || isOwnerSession(session)) {
    return NextResponse.json({ success: true });
  }

  const body = await request.json().catch(() => ({}));
  const action = body.action === "dismiss" ? "dismiss" : "complete";

  await (prisma as unknown as { user: { update: (args: unknown) => Promise<unknown> } }).user.update({
    where: { id: userId },
    data: { aiAgentOnboardingCompletedAt: new Date() },
  });

  return NextResponse.json({ success: true, action });
}
