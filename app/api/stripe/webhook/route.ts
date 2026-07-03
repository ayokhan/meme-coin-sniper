import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/db";
import {
  periodEndFromStripeSubscription,
  setStripeCustomerId,
  upsertSubscriptionFromStripePeriod,
} from "@/lib/stripe-billing";
import { VIP_PLANS, findPlanByListOrCardAmount } from "@/lib/subscription";

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";

export const dynamic = "force-dynamic";

function resolvePlan(planId: string, amountUsd: number, totalPaidUsd: number) {
  let plan = VIP_PLANS.find((p) => p.id === planId);
  if (!plan && amountUsd > 0) {
    plan = findPlanByListOrCardAmount(amountUsd);
  }
  if (!plan && totalPaidUsd > 0) {
    plan = findPlanByListOrCardAmount(totalPaidUsd);
  }
  return plan;
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.client_reference_id ?? session.metadata?.userId ?? null;
  if (!userId || !session.id) {
    console.error("Stripe webhook: missing client_reference_id or session id");
    return NextResponse.json({ error: "Missing user or session id." }, { status: 400 });
  }

  const planId = (session.metadata?.planId ?? session.metadata?.plan ?? "").toString();
  const amountUsd = parseInt(session.metadata?.amountUsd ?? "0", 10) || 0;
  const autoRenew = session.metadata?.autoRenew === "true" || session.mode === "subscription";
  const totalPaid = session.amount_total != null ? session.amount_total / 100 : 0;
  const plan = resolvePlan(planId, amountUsd, totalPaid);

  if (!plan) {
    console.error("Stripe webhook: invalid plan", { planId, amountUsd, totalPaid });
    return NextResponse.json({ error: "Invalid plan." }, { status: 400 });
  }

  const existing = await prisma.subscription.findFirst({
    where: { stripeSessionId: session.id } as Record<string, unknown>,
  });
  if (existing) {
    return NextResponse.json({ received: true, message: "Already processed." });
  }

  if (session.mode === "subscription" && session.subscription && stripe) {
    const stripeSub = await stripe.subscriptions.retrieve(session.subscription as string);
    const customerId = typeof stripeSub.customer === "string" ? stripeSub.customer : stripeSub.customer?.id;
    if (customerId) await setStripeCustomerId(userId, customerId);

    await upsertSubscriptionFromStripePeriod({
      userId,
      planId: plan.id,
      amountUsd: amountUsd || plan.priceUsd,
      periodEnd: periodEndFromStripeSubscription(stripeSub),
      stripeSessionId: session.id,
      stripeSubscriptionId: stripeSub.id,
      autoRenew: true,
    });
  } else {
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + plan.months);

    await prisma.subscription.create({
      data: {
        userId,
        tier: "vip",
        plan: plan.id,
        amountUsd: amountUsd || plan.priceUsd,
        expiresAt,
        stripeSessionId: session.id,
        autoRenew: false,
      } as Record<string, unknown>,
    });
  }

  console.info("Stripe webhook: subscription created", {
    userId,
    tier: "vip",
    planId: plan.id,
    sessionId: session.id,
    autoRenew,
  });
  return NextResponse.json({ received: true });
}

async function syncStripeSubscription(stripeSub: Stripe.Subscription) {
  const db = prisma as unknown as {
    subscription: {
      findFirst: (args: unknown) => Promise<{
        id: string;
        userId: string;
      } | null>;
      update: (args: unknown) => Promise<unknown>;
    };
  };

  let subRow = await db.subscription.findFirst({
    where: { stripeSubscriptionId: stripeSub.id },
  });

  const userId = stripeSub.metadata?.userId;
  const planId = stripeSub.metadata?.planId ?? "";
  const plan = resolvePlan(planId, 0, 0);

  if (!subRow && userId && plan) {
    await upsertSubscriptionFromStripePeriod({
      userId,
      planId: plan.id,
      amountUsd: plan.priceUsd,
      periodEnd: periodEndFromStripeSubscription(stripeSub),
      stripeSubscriptionId: stripeSub.id,
      autoRenew: stripeSub.status === "active" || stripeSub.status === "trialing",
    });
    subRow = await db.subscription.findFirst({ where: { stripeSubscriptionId: stripeSub.id } });
  }

  if (!subRow) return;

  await db.subscription.update({
    where: { id: subRow.id },
    data: {
      expiresAt: periodEndFromStripeSubscription(stripeSub),
      autoRenew: stripeSub.status === "active" || stripeSub.status === "trialing",
      cancelAtPeriodEnd: stripeSub.cancel_at_period_end ?? false,
    },
  });
}

/** POST - Stripe webhook: checkout, renewals, subscription lifecycle. */
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

  try {
    switch (event.type) {
      case "checkout.session.completed":
        return await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice & {
          subscription?: string | Stripe.Subscription | null;
        };
        const subId =
          typeof invoice.subscription === "string"
            ? invoice.subscription
            : invoice.subscription?.id ?? null;
        if (subId) {
          const stripeSub = await stripe.subscriptions.retrieve(subId);
          await syncStripeSubscription(stripeSub);
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const stripeSub = event.data.object as Stripe.Subscription;
        await syncStripeSubscription(stripeSub);
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("Stripe webhook handler error:", e);
    return NextResponse.json({ error: "Webhook handler failed." }, { status: 500 });
  }
}
