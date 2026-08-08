import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerEmail } from "@/lib/auth";
import {
  getVipTrialConfig,
  listVipCancelSurveys,
  listVipTrialEmailLogs,
  listVipTrialSignups,
  setVipTrialConfig,
} from "@/lib/vip-trial";

export const dynamic = "force-dynamic";

async function requireOwner() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email || !isOwnerEmail(email)) {
    return null;
  }
  return session;
}

/** GET — trial config + signups + email logs + cancel surveys (owner). */
export async function GET() {
  const session = await requireOwner();
  if (!session) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }

  const [config, signups, emailLogs, surveys] = await Promise.all([
    getVipTrialConfig(),
    listVipTrialSignups(80),
    listVipTrialEmailLogs(80),
    listVipCancelSurveys(80),
  ]);

  return NextResponse.json({
    success: true,
    config,
    signups: signups.map((s) => ({
      id: s.id,
      userId: s.userId,
      email: s.user?.email ?? null,
      name: s.user?.name ?? null,
      plan: s.plan,
      isTrial: s.isTrial,
      trialEndsAt: s.trialEndsAt?.toISOString() ?? null,
      expiresAt: s.expiresAt.toISOString(),
      autoRenew: s.autoRenew,
      cancelAtPeriodEnd: s.cancelAtPeriodEnd,
      reminderSent: !!s.trialReminderEmailSentAt,
      createdAt: s.createdAt.toISOString(),
      stripeSubscriptionId: s.stripeSubscriptionId,
    })),
    emailLogs: emailLogs.map((e) => ({
      id: e.id,
      userId: e.userId,
      email: e.email,
      subscriptionId: e.subscriptionId,
      kind: e.kind,
      success: e.success,
      error: e.error,
      meta: e.meta,
      createdAt: e.createdAt.toISOString(),
    })),
    surveys: surveys.map((s) => ({
      id: s.id,
      userId: s.userId,
      email: s.user?.email ?? null,
      name: s.user?.name ?? null,
      subscriptionId: s.subscriptionId,
      reasons: (() => {
        try {
          return JSON.parse(s.reasons) as string[];
        } catch {
          return [];
        }
      })(),
      comment: s.comment,
      wasTrial: s.wasTrial,
      createdAt: s.createdAt.toISOString(),
    })),
  });
}

/** PATCH — update trial days / enable / reminder hours / post-trial plan. */
export async function PATCH(request: Request) {
  const session = await requireOwner();
  if (!session) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  try {
    const config = await setVipTrialConfig({
      enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
      trialDays: body.trialDays != null ? Number(body.trialDays) : undefined,
      reminderHoursBefore:
        body.reminderHoursBefore != null ? Number(body.reminderHoursBefore) : undefined,
      planIdAfterTrial:
        typeof body.planIdAfterTrial === "string" ? body.planIdAfterTrial : undefined,
    });
    return NextResponse.json({ success: true, config });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Update failed" },
      { status: 500 }
    );
  }
}
