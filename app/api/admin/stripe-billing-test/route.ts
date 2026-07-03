import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import Stripe from "stripe";
import { authOptions, isOwnerEmail } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  STRIPE_BILLING_TEST_CHARGE_USD,
  STRIPE_BILLING_TEST_MAX_USD,
  STRIPE_BILLING_TEST_MIN_USD,
  STRIPE_BILLING_TEST_TRIAL_MINUTES,
  createReceiptTestCheckout,
  createTrialSubscriptionBillingTest,
  isStripeTestModeKey,
  parseBillingTestAmountUsd,
  parseBillingTestTrialMinutes,
} from "@/lib/stripe-billing-test";
import { upsertSubscriptionFromStripePeriod } from "@/lib/stripe-billing";

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

export const dynamic = "force-dynamic";

type Body = {
  action?: "receipt_checkout" | "trial_subscription";
  userId?: string;
  confirmLiveCharge?: boolean;
  amountUsd?: number | string;
  trialMinutes?: number | string;
};

function resolveAmount(body: Partial<Body>): number {
  return parseBillingTestAmountUsd(body.amountUsd) ?? STRIPE_BILLING_TEST_CHARGE_USD;
}

function resolveTrialMinutes(body: Partial<Body>): number {
  return parseBillingTestTrialMinutes(body.trialMinutes) ?? STRIPE_BILLING_TEST_TRIAL_MINUTES;
}

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
          error: "Live Stripe charges real money. Confirm on the test page before running a billing test.",
        },
        { status: 403 }
      );
    }

    if (body.amountUsd != null && parseBillingTestAmountUsd(body.amountUsd) == null) {
      return NextResponse.json(
        {
          success: false,
          error: `Amount must be between $${STRIPE_BILLING_TEST_MIN_USD} and $${STRIPE_BILLING_TEST_MAX_USD} USD (Stripe minimum is $0.50).`,
        },
        { status: 400 }
      );
    }

    if (body.trialMinutes != null && parseBillingTestTrialMinutes(body.trialMinutes) == null) {
      return NextResponse.json(
        { success: false, error: "Trial length must be between 1 and 1440 minutes." },
        { status: 400 }
      );
    }

    const action = body.action;
    const amountUsd = resolveAmount(body);
    const trialMinutes = resolveTrialMinutes(body);
    const ownerUserId = session.user.id;
    const targetUserId = typeof body.userId === "string" && body.userId.trim() ? body.userId.trim() : ownerUserId;

    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser?.email) {
      return NextResponse.json({ success: false, error: "Target user needs an email address." }, { status: 400 });
    }

    const origin = request.headers.get("origin") ?? process.env.NEXTAUTH_URL ?? "";
    const base = origin.replace(/\/$/, "") || "https://novastaris.ai";
    const returnBase = `${base}/admin/stripe-test`;

    if (action === "receipt_checkout") {
      const checkout = await createReceiptTestCheckout(stripe, {
        userId: targetUserId,
        email: targetUser.email,
        amountUsd,
        successUrl: `${returnBase}?stripeTest=receipt_success&amount=${amountUsd}`,
        cancelUrl: `${returnBase}?stripeTest=receipt_canceled`,
      });
      return NextResponse.json({
        success: true,
        action,
        url: checkout.url,
        testMode: isStripeTestModeKey(process.env.STRIPE_SECRET_KEY),
        chargeUsd: amountUsd,
        message: `Complete the $${amountUsd.toFixed(2)} checkout, then check Stripe → payment → Receipt history and your inbox.`,
      });
    }

    if (action === "trial_subscription") {
      const result = await createTrialSubscriptionBillingTest(stripe, {
        userId: targetUserId,
        email: targetUser.email,
        amountUsd,
        trialMinutes,
      });

      await upsertSubscriptionFromStripePeriod({
        userId: targetUserId,
        planId: "billing-test-trial",
        amountUsd,
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
        chargeAfterTrialUsd: amountUsd,
        trialMinutes,
        message: `Trial subscription created ($${amountUsd.toFixed(2)}/day after ${trialMinutes} min trial). Check Stripe → Subscriptions and receipt emails after trial ends.`,
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
