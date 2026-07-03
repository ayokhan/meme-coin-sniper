import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerEmail } from "@/lib/auth";
import {
  addAdminVipGrantDuration,
  grantLabel,
  isAdminVipGrantId,
  listPriceForAdminGrantPlan,
  planIdForAdminGrant,
  type AdminVipGrantId,
} from "@/lib/admin-vip-grant";
import { prisma } from "@/lib/db";
import { VIP_PLANS } from "@/lib/subscription";

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

type Body =
  | { action: "grant"; grant: AdminVipGrantId }
  | { action: "clear" }
  | { action: "set"; tier?: string; planId?: string | null; months?: number | null };

function resolveGrantFromLegacy(body: Extract<Body, { action: "set" }>): AdminVipGrantId {
  const months = body.months;
  if (months === 0) return "1day";
  if (body.planId === "6month") return "6month";
  if (body.planId === "12month") return "12month";
  return "1month";
}

async function cancelStripeSubscriptionsForUser(userId: string): Promise<void> {
  if (!stripe) return;
  const rows = (await prisma.subscription.findMany({
    where: {
      userId,
      expiresAt: { gt: new Date() },
      stripeSubscriptionId: { not: null },
    } as Record<string, unknown>,
  })) as Array<{ stripeSubscriptionId: string | null }>;

  for (const row of rows) {
    if (!row.stripeSubscriptionId) continue;
    try {
      await stripe.subscriptions.cancel(row.stripeSubscriptionId);
    } catch (e) {
      console.error("Admin clear: Stripe cancel failed", row.stripeSubscriptionId, e);
    }
  }
}

/** POST - Owner-only. Grant, extend, or cancel a user's VIP subscription. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email ?? null;
    if (!email) {
      return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
    }
    if (!isOwnerEmail(email)) {
      return NextResponse.json({ success: false, error: "Not authorized. Owner only." }, { status: 403 });
    }

    const { userId } = await params;
    if (!userId) {
      return NextResponse.json({ success: false, error: "User ID required." }, { status: 400 });
    }

    const rawBody = (await request.json().catch(() => ({}))) as Partial<Body>;
    const action = rawBody.action;

    if (action === "clear") {
      const now = new Date();
      const expiredAt = new Date(now.getTime() - 60 * 1000);
      await cancelStripeSubscriptionsForUser(userId);
      await (prisma as unknown as { subscription: { updateMany: (args: unknown) => Promise<unknown> } }).subscription.updateMany({
        where: { userId, expiresAt: { gt: now } },
        data: {
          expiresAt: expiredAt,
          autoRenew: false,
          cancelAtPeriodEnd: false,
        },
      });
      return NextResponse.json({ success: true, cleared: true });
    }

    let grantId: AdminVipGrantId | null = null;
    if (action === "grant" && typeof rawBody.grant === "string" && isAdminVipGrantId(rawBody.grant)) {
      grantId = rawBody.grant;
    } else if (action === "set") {
      grantId = resolveGrantFromLegacy(rawBody as Extract<Body, { action: "set" }>);
    }

    if (!grantId) {
      return NextResponse.json(
        { success: false, error: "Use action grant with grant: 1day|1week|1month|3month|6month|12month, or action clear." },
        { status: 400 }
      );
    }

    const now = new Date();
    const active = (await prisma.subscription.findFirst({
      where: { userId, expiresAt: { gt: now } },
      orderBy: { expiresAt: "desc" },
    })) as { id: string; expiresAt: Date } | null;

    const base = active && active.expiresAt > now ? active.expiresAt : now;
    const expiresAt = addAdminVipGrantDuration(base, grantId);
    const planId = planIdForAdminGrant(grantId);
    const amountUsd = listPriceForAdminGrantPlan(planId) || VIP_PLANS[0]?.priceUsd || 0;
    const adminTag = `admin-grant-${grantId}-${Date.now()}`;

    if (active) {
      await (prisma as unknown as { subscription: { update: (args: unknown) => Promise<unknown> } }).subscription.update({
        where: { id: active.id },
        data: {
          tier: "vip",
          plan: planId,
          amountUsd,
          expiresAt,
          txSignature: adminTag,
          autoRenew: false,
          cancelAtPeriodEnd: false,
        },
      });
    } else {
      await prisma.subscription.create({
        data: {
          userId,
          tier: "vip",
          plan: planId,
          amountUsd,
          expiresAt,
          txSignature: adminTag,
          autoRenew: false,
        } as Record<string, unknown>,
      });
    }

    return NextResponse.json({
      success: true,
      grant: grantId,
      grantLabel: grantLabel(grantId),
      subscription: {
        tier: "vip",
        plan: planId,
        expiresAt: expiresAt.toISOString(),
        extendedFromExisting: !!active,
      },
    });
  } catch (e) {
    console.error("Admin set subscription error:", e);
    return NextResponse.json({ success: false, error: "Failed to update subscription." }, { status: 500 });
  }
}
