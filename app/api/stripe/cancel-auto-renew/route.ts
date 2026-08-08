import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import Stripe from "stripe";
import { authOptions } from "@/lib/auth";
import { getActiveSubscriptionDetails } from "@/lib/subscription";
import { saveVipCancelSurvey } from "@/lib/vip-trial";
import { prisma } from "@/lib/db";

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

export const dynamic = "force-dynamic";

const GOODBYE =
  "We’re sorry to see you go. Your VIP access stays active until the end of your current period (or trial). After that, free tools remain available anytime — and you’re welcome back whenever you’re ready.";

/** POST - Turn off auto-renewal at period end (card subscriptions only). Optional cancel survey. */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
  }
  if (!stripe) {
    return NextResponse.json({ success: false, error: "Card billing is not configured." }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const reasons = Array.isArray(body.reasons) ? body.reasons.map(String) : [];
  const comment = typeof body.comment === "string" ? body.comment : "";

  const details = await getActiveSubscriptionDetails(session.user.id);
  if (!details?.stripeSubscriptionId) {
    return NextResponse.json(
      { success: false, error: "No auto-renewing card subscription found." },
      { status: 400 }
    );
  }

  try {
    const updated = await stripe.subscriptions.update(details.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    const db = prisma as unknown as {
      subscription: {
        findFirst: (args: unknown) => Promise<{ id: string; isTrial?: boolean } | null>;
        updateMany: (args: unknown) => Promise<unknown>;
      };
    };
    await db.subscription.updateMany({
      where: { stripeSubscriptionId: details.stripeSubscriptionId },
      data: { cancelAtPeriodEnd: true },
    });

    const subRow = await db.subscription.findFirst({
      where: { stripeSubscriptionId: details.stripeSubscriptionId },
    });
    const wasTrial = !!subRow?.isTrial;

    if (reasons.length > 0 || comment.trim()) {
      try {
        await saveVipCancelSurvey({
          userId: session.user.id,
          subscriptionId: subRow?.id ?? null,
          reasons,
          comment,
          wasTrial,
        });
      } catch (e) {
        console.warn("cancel survey save failed", e);
      }
    }

    return NextResponse.json({
      success: true,
      cancelAtPeriodEnd: updated.cancel_at_period_end,
      expiresAt: details.expiresAt.toISOString(),
      wasTrial,
      goodbyeMessage: GOODBYE,
      message: wasTrial
        ? `${GOODBYE} You will not be charged when the trial ends.`
        : `${GOODBYE} Auto-renewal will stop at the end of your current billing period.`,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not update subscription.";
    console.error("cancel-auto-renew error:", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
