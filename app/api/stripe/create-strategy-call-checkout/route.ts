import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import Stripe from "stripe";
import { authOptions } from "@/lib/auth";
import { getStripeCustomerId } from "@/lib/stripe-billing";
import { prisma } from "@/lib/db";
import {
  attachStripeSessionToOrder,
  createPendingPaidStrategyCallOrder,
  getPaidStrategyCallConfig,
  isValidPhone,
  PAID_STRATEGY_CALL_PURPOSE,
} from "@/lib/paid-strategy-call";

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

export const dynamic = "force-dynamic";

function originFrom(request: Request): string {
  const env = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  if (env) return env;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "https://novastaris.ai";
}

/**
 * POST — Stripe Checkout for paid Strategy call (card, one-time $200 default).
 * Requires sign-in + phone. Scheduling is manual after payment.
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session?.user?.email) {
    return NextResponse.json({ success: false, error: "Sign in required to purchase a Strategy call." }, { status: 401 });
  }
  if (!stripe) {
    return NextResponse.json({ success: false, error: "Card payment is not configured." }, { status: 503 });
  }

  const cfg = await getPaidStrategyCallConfig();
  if (!cfg.enabled) {
    return NextResponse.json(
      { success: false, error: "Strategy call purchases are temporarily unavailable." },
      { status: 403 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    phone?: string;
  };
  const name = (body.name ?? session.user.name ?? "").trim();
  const phone = (body.phone ?? "").trim();
  if (!name) {
    return NextResponse.json({ success: false, error: "Full name is required." }, { status: 400 });
  }
  if (!isValidPhone(phone)) {
    return NextResponse.json(
      { success: false, error: "Enter a valid phone number with country code so our expert can reach you." },
      { status: 400 }
    );
  }

  const amountUsd = cfg.priceUsd;
  const amountCents = Math.round(amountUsd * 100);
  const origin = originFrom(request);

  try {
    const order = await createPendingPaidStrategyCallOrder({
      userId: session.user.id,
      email: session.user.email,
      name,
      phone,
      amountUsd,
    });

    // Persist phone on profile when empty
    try {
      const u = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { phone: true },
      });
      if (u && !(u.phone ?? "").trim()) {
        await prisma.user.update({ where: { id: session.user.id }, data: { phone } });
      }
    } catch {
      /* ignore */
    }

    const existingCustomerId = await getStripeCustomerId(session.user.id);
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer: existingCustomerId ?? undefined,
      customer_creation: existingCustomerId ? undefined : "always",
      customer_email: existingCustomerId ? undefined : session.user.email,
      client_reference_id: session.user.id,
      metadata: {
        purpose: PAID_STRATEGY_CALL_PURPOSE,
        planId: "strategy_call",
        amountUsd: String(amountUsd),
        userId: session.user.id,
        orderId: order.id,
        phone,
        name,
      },
      invoice_creation: { enabled: true },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: amountCents,
            product_data: {
              name: "NovaStaris Strategy call — 1 hour",
              description:
                "Private 1-hour Strategy call with NovaStaris experts. After payment, an expert contacts you within 24 hours by email and phone to schedule.",
            },
          },
        },
      ],
      success_url: `${origin}/strategy-call?paid=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/strategy-call?canceled=1`,
    });

    if (checkoutSession.id) {
      await attachStripeSessionToOrder(order.id, checkoutSession.id);
    }

    return NextResponse.json({
      success: true,
      url: checkoutSession.url,
      sessionId: checkoutSession.id,
      orderId: order.id,
      amountUsd,
    });
  } catch (e) {
    console.error("Strategy call checkout error:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to start checkout." },
      { status: 500 }
    );
  }
}
