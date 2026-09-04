import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { FEATURE_FLAG_KEYS, getFeatureFlag } from "@/lib/feature-flags";
import { COACH_CALLS_FEATURE_KEY } from "@/lib/coach-calls-access";
import { sendFeatureAccessRequestOwnerAlert } from "@/lib/feature-access-request-email";
import { getSubscriptionTier } from "@/lib/subscription";

export const dynamic = "force-dynamic";

/** POST — VIP requests Coach Calls on-demand access. Emails owner. */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
    }
    if (isOwnerSession(session)) {
      return NextResponse.json({ success: true, alreadyGranted: true, pending: false });
    }

    const masterOn = await getFeatureFlag(FEATURE_FLAG_KEYS.PAGE_TAB_COACH_CALLS);
    if (!masterOn) {
      return NextResponse.json(
        { success: false, error: "Coach Calls is not available right now." },
        { status: 403 }
      );
    }

    const ownerOnly = await getFeatureFlag(FEATURE_FLAG_KEYS.COACH_CALLS_OWNER_ONLY);
    if (ownerOnly) {
      return NextResponse.json(
        { success: false, error: "Coach Calls is in owner testing mode." },
        { status: 403 }
      );
    }

    const tier = await getSubscriptionTier(session.user.id);
    const isCoach = !!(session.user as { isCoachUser?: boolean }).isCoachUser;
    if (tier !== "vip" && !isCoach) {
      return NextResponse.json(
        { success: false, error: "VIP subscription required to request Coach Calls.", locked: true },
        { status: 403 }
      );
    }

    const user = (await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        coachCallsOnDemand: true,
        email: true,
        name: true,
      },
    })) as { coachCallsOnDemand?: boolean; email?: string | null; name?: string | null } | null;

    if (user?.coachCallsOnDemand) {
      return NextResponse.json({ success: true, alreadyGranted: true, pending: false });
    }

    const existing = await (prisma as any).featureAccessRequest.findFirst({
      where: {
        userId: session.user.id,
        feature: COACH_CALLS_FEATURE_KEY,
        status: "pending",
      },
      orderBy: { createdAt: "desc" },
    });

    if (existing) {
      return NextResponse.json({
        success: true,
        pending: true,
        requestId: existing.id,
        alreadyRequested: true,
      });
    }

    const created = await (prisma as any).featureAccessRequest.create({
      data: {
        userId: session.user.id,
        feature: COACH_CALLS_FEATURE_KEY,
        status: "pending",
      },
    });

    void sendFeatureAccessRequestOwnerAlert({
      featureLabel: "Coach Calls",
      userName: user?.name ?? session.user.name ?? null,
      userEmail: user?.email ?? session.user.email ?? null,
      userId: session.user.id,
    }).catch((e) => console.error("Coach Calls request owner email failed:", e));

    return NextResponse.json({
      success: true,
      pending: true,
      requestId: created.id,
      alreadyRequested: false,
    });
  } catch (e) {
    console.error("Coach Calls request-access error:", e);
    return NextResponse.json({ success: false, error: "Failed to submit request." }, { status: 500 });
  }
}
