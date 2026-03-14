import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import Stripe from "stripe";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PRO_PLANS, VIP_PLANS, type Tier } from "@/lib/subscription";

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

export const dynamic = "force-dynamic";

/** POST - Create Stripe Checkout session for subscription. Requires payment terms accepted. */
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
    select: { paymentTermsAcceptedAt: true },
  });
  if (!user?.paymentTermsAcceptedAt) {
    return NextResponse.json(
      { success: false, error: "You must accept the Payment Terms and Conditions before paying." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const tier = (body.tier ?? "pro").toString() as Tier;
  const planId = (body.planId ?? body.plan ?? "").toString();
  const successUrl = (body.successUrl ?? request.headers.get("origin") ?? "").trim() || `${process.env.NEXTAUTH_URL ?? ""}/subscribe?success=1`;
  const cancelUrl = (body.cancelUrl ?? request.headers.get("origin") ?? "").trim() || `${process.env.NEXTAUTH_URL ?? ""}/subscribe?canceled=1`;

  if (tier !== "pro" && tier !== "vip") {
    return NextResponse.json({ success: false, error: "Invalid tier." }, { status: 400 });
  }
  const plans = tier === "pro" ? PRO_PLANS : VIP_PLANS;
  const plan = plans.find((p) => p.id === planId);
  if (!plan) {
    return NextResponse.json({ success: false, error: "Invalid plan." }, { status: 400 });
  }

  const amountCents = Math.round(plan.priceUsd * 100);
  if (amountCents < 50) {
    return NextResponse.json({ success: false, error: "Minimum charge is $0.50." }, { status: 400 });
  }

  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: session.user.email,
      client_reference_id: session.user.id,
      metadata: { tier, planId, amountUsd: String(plan.priceUsd) },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: amountCents,
            product_data: {
              name: `NovaStaris ${tier === "vip" ? "VIP" : "Pro"} — ${plan.label}`,
              description: `Subscription: ${plan.label}. Payment terms: no refund after 24 hours of use.`,
            },
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
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create checkout session.";
    console.error("Stripe create-checkout-session error:", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
