import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import Stripe from "stripe";
import { authOptions, isOwnerEmail } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  STRIPE_BILLING_TEST_CHARGE_USD,
  STRIPE_BILLING_TEST_TRIAL_MINUTES,
  createReceiptTestCheckout,
  createTrialSubscriptionBillingTest,
  isStripeTestModeKey,
} from "@/lib/stripe-billing-test";
import { upsertSubscriptionFromStripePeriod } from "@/lib/stripe-billing";

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

export const dynamic = "force-dynamic";

type Body =
  | { action: "receipt_checkout"; userId?: string; confirmLiveCharge?: boolean }
  | { action: "trial_subscription"; userId?: string; confirmLiveCharge?: boolean };

/** POST - Owner-only Stripe billing tests (receipt email + short trial subscription). */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email ?? null;
    if (!email) {
      return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
    }
    if (!isOwnerEmail(email)) {
      return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
    }
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
    }
    if (!stripe) {
      return NextResponse.json({ success: false, error: "Stripe is not configured." }, { status: 503 });
    }

    const body = (await request.json().catch(() => ({}))) as Partial<Body>;
    const liveKey = !isStripeTestModeKey(process.env.STRIPE_SECRET_KEY);
    if (liveKey && body.confirmLiveCharge !== true) {
      return NextResponse.json(
        {
          success: false,
          error: "Live Stripe charges real money. Confirm in the admin UI before running a billing test.",
        },
        { status: 403 }
      );
    }

    const action = body.action;
    const ownerUserId = session.user.id;
    const targetUserId = typeof body.userId === "string" && body.userId.trim() ? body.userId.trim() : ownerUserId;

    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser?.email) {
      return NextResponse.json({ success: false, error: "Target user needs an email address." }, { status: 400 });
    }

    const origin = request.headers.get("origin") ?? process.env.NEXTAUTH_URL ?? "";
    const base = origin.replace(/\/$/, "") || "https://novastaris.ai";

    if (action === "receipt_checkout") {
      const checkout = await createReceiptTestCheckout(stripe, {
        userId: targetUserId,
        email: targetUser.email,
        successUrl: `${base}/admin/metrics?stripeTest=receipt_success`,
        cancelUrl: `${base}/admin/metrics?stripeTest=receipt_canceled`,
      });
      return NextResponse.json({
        success: true,
        action,
        url: checkout.url,
        testMode: isStripeTestModeKey(process.env.STRIPE_SECRET_KEY),
        chargeUsd: STRIPE_BILLING_TEST_CHARGE_USD,
        message: `Complete the $${STRIPE_BILLING_TEST_CHARGE_USD} checkout, then check Stripe → payment → Receipt history for “sent” and your inbox.`,
      });
    }

    if (action === "trial_subscription") {
      const result = await createTrialSubscriptionBillingTest(stripe, {
        userId: targetUserId,
        email: targetUser.email,
      });

      await upsertSubscriptionFromStripePeriod({
        userId: targetUserId,
        planId: "billing-test-trial",
        amountUsd: STRIPE_BILLING_TEST_CHARGE_USD,
        periodEnd: result.trialEndsAt,
        stripeSubscriptionId: result.subscriptionId,
        autoRenew: true,
      });

      return NextResponse.json({
        success: true,
        action,
        subscriptionId: result.subscriptionId,
        customerId: result.customerId,
        trialEndsAt: result.trialEndsAt.toISOString(),
        testMode: isStripeTestModeKey(process.env.STRIPE_SECRET_KEY),
        chargeAfterTrialUsd: STRIPE_BILLING_TEST_CHARGE_USD,
        message: `Trial subscription created. VIP trial ends in ~${STRIPE_BILLING_TEST_TRIAL_MINUTES} minutes. Check Stripe → Subscriptions and receipt emails after trial ends.`,
      });
    }

    return NextResponse.json(
      { success: false, error: "Use action receipt_checkout or trial_subscription." },
      { status: 400 }
    );
  } catch (e) {
    console.error("stripe-billing-test error:", e);
    const message = e instanceof Error ? e.message : "Billing test failed.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
