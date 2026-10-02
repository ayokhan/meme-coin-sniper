import { NextResponse } from "next/server";
import { syncReferralCommissionForReferee } from "@/lib/referral-commission";
import Stripe from "stripe";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerEmail } from "@/lib/auth";
import {
  addAdminVipGrantDuration,
  grantLabel,
  isAdminVipGrantId,
  listPriceForAdminGrantPlan,
  listPriceForAdminProGrantPlan,
  planIdForAdminGrant,
  proGrantLabel,
  proPlanIdForAdminGrant,
  type AdminVipGrantId,
} from "@/lib/admin-vip-grant";
import { prisma } from "@/lib/db";
import { NOVA_PRO_TIER, VIP_PLANS } from "@/lib/subscription";
import { resolveFoundingForNewPro } from "@/lib/nova-pro";
import { recordBillingInvoiceFromAdminGrant } from "@/lib/billing-invoices";

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

type Body =
  | { action: "grant"; grant: AdminVipGrantId; limited?: boolean }
  | { action: "setLimited"; limited: boolean }
  | { action: "clear" }
  | { action: "set"; tier?: string; planId?: string | null; months?: number | null; limited?: boolean };

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

/** Complimentary Nova Pro: extends an active Pro period, refuses while VIP is active. */
async function grantNovaPro(userId: string, grantId: AdminVipGrantId, wantFounding: boolean) {
  const db = prisma as unknown as {
    subscription: {
      findFirst: (args: unknown) => Promise<{ id: string; expiresAt: Date; founding: boolean } | null>;
      update: (args: unknown) => Promise<unknown>;
      create: (args: unknown) => Promise<unknown>;
    };
  };
  const now = new Date();
  const activeVip = await db.subscription.findFirst({
    where: { userId, expiresAt: { gt: now }, tier: { not: NOVA_PRO_TIER } },
    select: { id: true },
  });
  if (activeVip) {
    return NextResponse.json(
      { success: false, error: "User has active VIP (includes everything in Pro). Cancel / reset VIP first to grant Nova Pro." },
      { status: 400 }
    );
  }

  let founding = false;
  if (wantFounding) {
    founding = await resolveFoundingForNewPro(userId, { forceRequest: true });
    if (!founding) {
      return NextResponse.json(
        { success: false, error: "No founding (limited edition) seats left. Raise the seat count in Admin → Nova Pro or grant regular Pro." },
        { status: 400 }
      );
    }
  }

  const activePro = await db.subscription.findFirst({
    where: { userId, expiresAt: { gt: now }, tier: NOVA_PRO_TIER },
    orderBy: { expiresAt: "desc" },
    select: { id: true, expiresAt: true, founding: true },
  });
  const base = activePro ? activePro.expiresAt : now;
  const expiresAt = addAdminVipGrantDuration(base, grantId);
  const planId = proPlanIdForAdminGrant(grantId);
  const amountUsd = listPriceForAdminProGrantPlan(planId);
  const adminTag = `admin-grant-pro-${grantId}${founding ? "-founding" : ""}-${Date.now()}`;
  const keepFounding = founding || !!activePro?.founding;

  if (activePro) {
    await db.subscription.update({
      where: { id: activePro.id },
      data: { plan: planId, amountUsd, expiresAt, txSignature: adminTag, autoRenew: false, cancelAtPeriodEnd: false, founding: keepFounding },
    });
  } else {
    await db.subscription.create({
      data: { userId, tier: NOVA_PRO_TIER, plan: planId, amountUsd, expiresAt, txSignature: adminTag, autoRenew: false, founding: keepFounding },
    });
  }

  await recordBillingInvoiceFromAdminGrant({
    userId,
    planId,
    grantLabel: proGrantLabel(grantId),
    adminTag,
    periodEnd: expiresAt,
  }).catch((e) => console.error("billing invoice after admin Pro grant:", e));

  return NextResponse.json({
    success: true,
    grant: grantId,
    grantLabel: proGrantLabel(grantId),
    product: "nova_pro",
    founding: keepFounding,
    subscription: {
      tier: NOVA_PRO_TIER,
      plan: planId,
      expiresAt: expiresAt.toISOString(),
      extendedFromExisting: !!activePro,
    },
    complimentary: true,
  });
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

    const rawBody = (await request.json().catch(() => ({}))) as Partial<Body> & {
      grant?: string;
      limited?: boolean;
    };
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

    if (action === "setLimited") {
      const limited = rawBody.limited === true;
      const now = new Date();
      const active = (await prisma.subscription.findFirst({
        where: { userId, expiresAt: { gt: now } },
        orderBy: { expiresAt: "desc" },
      })) as { id: string; expiresAt: Date; deskLimited?: boolean } | null;
      if (!active) {
        return NextResponse.json(
          { success: false, error: "No active VIP to convert. Grant VIP first." },
          { status: 400 }
        );
      }
      await (prisma as unknown as { subscription: { update: (args: unknown) => Promise<unknown> } }).subscription.update({
        where: { id: active.id },
        data: {
          deskLimited: limited,
          // Keep complimentary admin access; don't mark as Stripe card trial
          isTrial: false,
          trialEndsAt: null,
        },
      });
      return NextResponse.json({
        success: true,
        deskLimited: limited,
        subscription: {
          expiresAt: active.expiresAt.toISOString(),
          deskLimited: limited,
          extendedFromExisting: false,
          convertedOnly: true,
        },
        message: limited
          ? "Converted to Limited VIP — same expiry, 3/day desk caps."
          : "Converted to unlimited VIP — same expiry.",
      });
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
    if ((rawBody as { product?: string }).product === "nova_pro") {
      return grantNovaPro(userId, grantId, (rawBody as { founding?: boolean }).founding === true);
    }
    const deskLimited = rawBody.limited === true;
    const active = (await prisma.subscription.findFirst({
      where: { userId, expiresAt: { gt: now } },
      orderBy: { expiresAt: "desc" },
    })) as { id: string; expiresAt: Date } | null;

    const base = active && active.expiresAt > now ? active.expiresAt : now;
    const expiresAt = addAdminVipGrantDuration(base, grantId);
    const planId = planIdForAdminGrant(grantId);
    const amountUsd = listPriceForAdminGrantPlan(planId) || VIP_PLANS[0]?.priceUsd || 0;
    const adminTag = `admin-grant-${grantId}${deskLimited ? "-ltd" : ""}-${Date.now()}`;

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
          deskLimited,
          // Admin grants are not Stripe card trials
          isTrial: false,
          trialEndsAt: null,
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
          deskLimited,
          isTrial: false,
        } as Record<string, unknown>,
      });
    }

    await syncReferralCommissionForReferee(userId, {
      allowAdminGrants: true,
      notes: deskLimited ? "Admin Limited VIP grant" : "Admin VIP grant",
    }).catch((e) => console.error("referral sync after admin grant:", e));

    await recordBillingInvoiceFromAdminGrant({
      userId,
      planId,
      grantLabel: `${grantLabel(grantId)}${deskLimited ? " Limited" : ""}`,
      adminTag,
      periodEnd: expiresAt,
    }).catch((e) => console.error("billing invoice after admin grant:", e));

    return NextResponse.json({
      success: true,
      grant: grantId,
      grantLabel: grantLabel(grantId),
      deskLimited,
      subscription: {
        tier: "vip",
        plan: planId,
        expiresAt: expiresAt.toISOString(),
        extendedFromExisting: !!active,
        deskLimited,
      },
      complimentary: true,
      sickKidsExcluded: true,
    });
  } catch (e) {
    console.error("Admin set subscription error:", e);
    return NextResponse.json({ success: false, error: "Failed to update subscription." }, { status: 500 });
  }
}
