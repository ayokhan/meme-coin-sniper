import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import Stripe from "stripe";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getStripeCustomerId, planToStripeRecurring } from "@/lib/stripe-billing";
import { VIP_PLANS, getCardPriceForPlan } from "@/lib/subscription";

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

export const dynamic = "force-dynamic";

/** POST - Create Stripe Checkout session for VIP subscription. Requires payment terms accepted. */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session?.user?.email) {
    return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
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
  const planId = (body.planId ?? body.plan ?? "").toString();
  const autoRenew = body.autoRenew === true;
  const successUrl = (body.successUrl ?? request.headers.get("origin") ?? "").trim() || `${process.env.NEXTAUTH_URL ?? ""}/subscribe?success=1`;
  const cancelUrl = (body.cancelUrl ?? request.headers.get("origin") ?? "").trim() || `${process.env.NEXTAUTH_URL ?? ""}/subscribe?canceled=1`;

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

  const productData = {
    name: `NovaStaris VIP — ${plan.label}`,
    description: autoRenew
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
    };

    const checkoutSession = autoRenew
      ? await stripe.checkout.sessions.create({
          mode: "subscription",
          customer: existingCustomerId ?? undefined,
          customer_email: existingCustomerId ? undefined : session.user.email,
          client_reference_id: session.user.id,
          metadata: sharedMetadata,
          subscription_data: {
            metadata: { planId, userId: session.user.id, tier: "vip" },
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
          customer_email: session.user.email,
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
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create checkout session.";
    console.error("Stripe create-checkout-session error:", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
