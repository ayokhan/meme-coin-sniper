import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import Stripe from "stripe";
import { authOptions } from "@/lib/auth";
import { resolveStripeCustomerId } from "@/lib/stripe-billing";

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

export const dynamic = "force-dynamic";

/** POST - Open Stripe Customer Portal to update card / view invoices. */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
  }
  if (!stripe) {
    return NextResponse.json({ success: false, error: "Card billing is not configured." }, { status: 503 });
  }

  const customerId = await resolveStripeCustomerId(session.user.id, stripe);
  if (!customerId) {
    return NextResponse.json(
      {
        success: false,
        error: "No card billing profile found. Pay with card (auto-renewal) first, or contact support.",
      },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const origin = request.headers.get("origin") ?? process.env.NEXTAUTH_URL ?? "";
  const returnUrl =
    (typeof body.returnUrl === "string" && body.returnUrl.trim()) ||
    (origin ? `${origin.replace(/\/$/, "")}/account` : "/account");

  try {
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return NextResponse.json({
      success: true,
      url: portalSession.url,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not open billing portal.";
    console.error("billing-portal error:", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
