import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import Stripe from "stripe";
import { authOptions } from "@/lib/auth";
import { recordBillingInvoiceFromCheckout } from "@/lib/billing-invoices";
import {
  fulfillPaidStrategyCallOrder,
  getPaidStrategyCallOrderBySession,
  PAID_STRATEGY_CALL_PURPOSE,
} from "@/lib/paid-strategy-call";

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

export const dynamic = "force-dynamic";

/** GET — Confirm Strategy call payment on success page (webhook may lag). */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
  }
  if (!stripe) {
    return NextResponse.json({ success: false, error: "Stripe not configured." }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("session_id")?.trim();
  if (!sessionId) {
    return NextResponse.json({ success: false, error: "session_id required." }, { status: 400 });
  }

  try {
    const checkout = await stripe.checkout.sessions.retrieve(sessionId);
    if (checkout.metadata?.purpose !== PAID_STRATEGY_CALL_PURPOSE) {
      return NextResponse.json({ success: false, error: "Not a Strategy call payment." }, { status: 400 });
    }
    const userId = checkout.client_reference_id ?? checkout.metadata?.userId ?? null;
    if (userId && userId !== session.user.id) {
      return NextResponse.json({ success: false, error: "This payment belongs to another account." }, { status: 403 });
    }

    if (checkout.payment_status !== "paid" && checkout.status !== "complete") {
      const existing = await getPaidStrategyCallOrderBySession(sessionId);
      return NextResponse.json({
        success: true,
        paid: false,
        order: existing,
      });
    }

    const amountUsd =
      checkout.amount_total != null
        ? checkout.amount_total / 100
        : parseFloat(checkout.metadata?.amountUsd ?? "0") || 0;

    const order = await fulfillPaidStrategyCallOrder({
      orderId: checkout.metadata?.orderId ?? null,
      stripeSessionId: sessionId,
      amountUsd,
      userId,
    });

    if (userId && amountUsd > 0) {
      try {
        await recordBillingInvoiceFromCheckout({
          userId,
          amountUsd,
          planId: "strategy_call",
          stripeSessionId: sessionId,
          paymentMethod: "card",
        });
      } catch (e) {
        console.error("strategy-call confirm invoice:", e);
      }
    }

    return NextResponse.json({ success: true, paid: true, order });
  } catch (e) {
    console.error("strategy-call confirm:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Could not confirm payment." },
      { status: 500 }
    );
  }
}
