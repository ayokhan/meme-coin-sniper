import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import Stripe from "stripe";
import { authOptions } from "@/lib/auth";
import { getActiveSubscriptionDetails } from "@/lib/subscription";

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

export const dynamic = "force-dynamic";

/** POST - Re-enable auto-renewal before the current period ends. */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
  }
  if (!stripe) {
    return NextResponse.json({ success: false, error: "Card billing is not configured." }, { status: 503 });
  }

  const details = await getActiveSubscriptionDetails(session.user.id);
  if (!details?.stripeSubscriptionId) {
    return NextResponse.json(
      { success: false, error: "No auto-renewing card subscription found." },
      { status: 400 }
    );
  }

  try {
    const updated = await stripe.subscriptions.update(details.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });

    const db = (await import("@/lib/db")).prisma as unknown as {
      subscription: { updateMany: (args: unknown) => Promise<unknown> };
    };
    await db.subscription.updateMany({
      where: { stripeSubscriptionId: details.stripeSubscriptionId },
      data: { cancelAtPeriodEnd: false, autoRenew: true },
    });

    return NextResponse.json({
      success: true,
      cancelAtPeriodEnd: updated.cancel_at_period_end,
      expiresAt: details.expiresAt.toISOString(),
      message: "Auto-renewal is enabled. Your card will be charged at the end of each billing period.",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not update subscription.";
    console.error("resume-auto-renew error:", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
