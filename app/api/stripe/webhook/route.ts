import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/db";
import { PRO_PLANS, VIP_PLANS, type Tier } from "@/lib/subscription";

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";

export const dynamic = "force-dynamic";

/** POST - Stripe webhook. On checkout.session.completed, create subscription for the user. */
export async function POST(request: Request) {
  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: "Stripe not configured." }, { status: 503 });
  }

  const body = await request.text();
  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid signature";
    console.error("Stripe webhook signature error:", msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const userId = session.client_reference_id ?? null;
  let tier = (session.metadata?.tier ?? "pro") as Tier;
  let planId = (session.metadata?.planId ?? session.metadata?.plan ?? "").toString();
  const amountUsd = parseInt(session.metadata?.amountUsd ?? "0", 10) || 0;

  if (!userId || !session.id) {
    console.error("Stripe webhook: missing client_reference_id or session id");
    return NextResponse.json({ error: "Missing user or session id." }, { status: 400 });
  }

  let plans = tier === "vip" ? VIP_PLANS : PRO_PLANS;
  let plan = plans.find((p) => p.id === planId);
  if (!plan && amountUsd > 0) {
    plan = plans.find((p) => p.priceUsd === amountUsd);
    if (plan) planId = plan.id;
  }
  if (!plan && amountUsd > 0) {
    const vipPlan = VIP_PLANS.find((p) => p.priceUsd === amountUsd);
    const proPlan = PRO_PLANS.find((p) => p.priceUsd === amountUsd);
    if (vipPlan) {
      tier = "vip";
      plan = vipPlan;
      planId = plan.id;
    } else if (proPlan) {
      tier = "pro";
      plan = proPlan;
      planId = plan.id;
    }
  }
  if (!plan) {
    console.error("Stripe webhook: invalid plan", { tier, planId, amountUsd });
    return NextResponse.json({ error: "Invalid plan." }, { status: 400 });
  }

  try {
    const existing = await prisma.subscription.findFirst({
      where: { stripeSessionId: session.id } as Record<string, unknown>,
    });
    if (existing) {
      return NextResponse.json({ received: true, message: "Already processed." });
    }

    const expiresAt = new Date();
    if (plan.months === 0) {
      expiresAt.setDate(expiresAt.getDate() + 1);
    } else {
      expiresAt.setMonth(expiresAt.getMonth() + plan.months);
    }

    await prisma.subscription.create({
      data: {
        userId,
        tier,
        plan: plan.id,
        amountUsd: amountUsd || plan.priceUsd,
        expiresAt,
        stripeSessionId: session.id,
      } as Record<string, unknown>,
    });

    console.info("Stripe webhook: subscription created", { userId, tier, planId: plan.id, sessionId: session.id });
    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("Stripe webhook create subscription error:", e);
    return NextResponse.json({ error: "Failed to create subscription." }, { status: 500 });
  }
}
