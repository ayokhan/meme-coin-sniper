import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import Stripe from "stripe";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getStripeCustomerId, planToStripeRecurring } from "@/lib/stripe-billing";
import { VIP_PLANS, getCardPriceForPlan } from "@/lib/subscription";
import { FEATURE_FLAG_KEYS, getFeatureFlag } from "@/lib/feature-flags";
import { getVipTrialConfig, getVipTrialPublicOffer, userHasUsedVipTrial } from "@/lib/vip-trial";
import { getActiveSubscriptionDetails } from "@/lib/subscription";

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

export const dynamic = "force-dynamic";

/** POST - Create Stripe Checkout session for VIP subscription. Requires payment terms accepted. */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session?.user?.email) {
    return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
  }

  const cardEnabled = await getFeatureFlag(FEATURE_FLAG_KEYS.SUBSCRIPTION_PAY_CARD);
  if (!cardEnabled) {
    return NextResponse.json(
      { success: false, error: "Card payment is temporarily unavailable. Try USDC or check back later." },
      { status: 403 }
    );
  }

  if (!stripe) {
    return NextResponse.json({ success: false, error: "Card payment is not configured." }, { status: 503 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (!(user as { paymentTermsAcceptedAt?: Date | null } | null)?.paymentTermsAcceptedAt) {
    return NextResponse.json(
      { success: false, error: "You must accept the Payment Terms and Conditions before paying." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const startTrial = body.startTrial === true || body.trial === true;
  const trialCfg = startTrial ? await getVipTrialConfig() : null;
  const offer = startTrial ? await getVipTrialPublicOffer(session.user.id) : null;

  if (startTrial) {
    if (!trialCfg?.enabled || !offer?.eligible) {
      return NextResponse.json(
        { success: false, error: offer?.ineligibleReason ?? "VIP trial is not available." },
        { status: 400 }
      );
    }
    if (await userHasUsedVipTrial(session.user.id)) {
      return NextResponse.json(
        { success: false, error: "This account already used its VIP trial." },
        { status: 400 }
      );
    }
    const active = await getActiveSubscriptionDetails(session.user.id);
    if (active && active.expiresAt > new Date()) {
      return NextResponse.json({ success: false, error: "You already have active VIP." }, { status: 400 });
    }
  }

  const planId = startTrial
    ? trialCfg!.planIdAfterTrial
    : (body.planId ?? body.plan ?? "").toString();
  // Trial always becomes recurring after the free days.
  const autoRenew = startTrial ? true : body.autoRenew === true;
  const successUrl =
    (body.successUrl ?? request.headers.get("origin") ?? "").trim() ||
    `${process.env.NEXTAUTH_URL ?? ""}/subscribe?success=1${startTrial ? "&trial=1" : ""}`;
  const cancelUrl =
    (body.cancelUrl ?? request.headers.get("origin") ?? "").trim() ||
    `${process.env.NEXTAUTH_URL ?? ""}/subscribe?canceled=1`;

  const plan = VIP_PLANS.find((p) => p.id === planId);
  if (!plan) {
    return NextResponse.json({ success: false, error: "Invalid plan." }, { status: 400 });
  }

  const cardPriceUsd = getCardPriceForPlan(plan);
  const cardFeeUsd = cardPriceUsd - plan.priceUsd;
  const amountCents = Math.round(cardPriceUsd * 100);
  if (amountCents < 50) {
    return NextResponse.json({ success: false, error: "Minimum charge is $0.50." }, { status: 400 });
  }

  const trialDays = startTrial ? trialCfg!.trialDays : 0;
  const productData = {
    name: startTrial
      ? `NovaStaris VIP — ${trialDays}-day trial then ${plan.label}`
      : `NovaStaris VIP — ${plan.label}`,
    description: startTrial
      ? `${trialDays} days free VIP. Card required. We email you ~${trialCfg!.reminderHoursBefore}h before the trial ends so you can cancel. If you don’t cancel, you’re charged $${plan.priceUsd} + $${cardFeeUsd} card fee and VIP renews automatically until you cancel.`
      : autoRenew
        ? `Recurring VIP: ${plan.label} ($${plan.priceUsd} + $${cardFeeUsd} card fee per billing period). Cancel anytime before renewal.`
        : `Subscription: ${plan.label} ($${plan.priceUsd} + $${cardFeeUsd} card fee). Payment terms: no refund after 24 hours of use.`,
  };

  try {
    const existingCustomerId = await getStripeCustomerId(session.user.id);
    const sharedMetadata = {
      tier: "vip",
      planId,
      amountUsd: String(plan.priceUsd),
      cardTotalUsd: String(cardPriceUsd),
      autoRenew: autoRenew ? "true" : "false",
      userId: session.user.id,
      vipTrial: startTrial ? "true" : "false",
      trialDays: startTrial ? String(trialDays) : "",
    };

    const checkoutSession = autoRenew
      ? await stripe.checkout.sessions.create({
          mode: "subscription",
          customer: existingCustomerId ?? undefined,
          customer_email: existingCustomerId ? undefined : session.user.email,
          client_reference_id: session.user.id,
          metadata: sharedMetadata,
          payment_method_collection: "always",
          subscription_data: {
            trial_period_days: startTrial ? trialDays : undefined,
            metadata: {
              planId,
              userId: session.user.id,
              tier: "vip",
              vipTrial: startTrial ? "true" : "false",
              trialDays: startTrial ? String(trialDays) : "",
            },
          },
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: "usd",
                unit_amount: amountCents,
                recurring: planToStripeRecurring(plan),
                product_data: productData,
              },
            },
          ],
          success_url: successUrl,
          cancel_url: cancelUrl,
        })
      : await stripe.checkout.sessions.create({
          mode: "payment",
          customer: existingCustomerId ?? undefined,
          customer_creation: existingCustomerId ? undefined : "always",
          customer_email: existingCustomerId ? undefined : session.user.email,
          client_reference_id: session.user.id,
          metadata: sharedMetadata,
          invoice_creation: { enabled: true },
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: "usd",
                unit_amount: amountCents,
                product_data: productData,
              },
            },
          ],
          success_url: successUrl,
          cancel_url: cancelUrl,
        });

    return NextResponse.json({
      success: true,
      sessionId: checkoutSession.id,
      url: checkoutSession.url,
      autoRenew,
      trial: startTrial,
      trialDays: startTrial ? trialDays : null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create checkout session.";
    console.error("Stripe create-checkout-session error:", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
