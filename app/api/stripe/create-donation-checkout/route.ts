import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import Stripe from "stripe";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { FEATURE_FLAG_KEYS, getFeatureFlag } from "@/lib/feature-flags";
import { getStripeCustomerId } from "@/lib/stripe-billing";

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

export const dynamic = "force-dynamic";

const MIN_USD = 1;
const MAX_USD = 10_000;

/**
 * POST — Stripe Checkout for Trading University donations (card only).
 * One-time payment or monthly recurring subscription. Does not grant VIP.
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session?.user?.email) {
    return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
  }
  if (!stripe) {
    return NextResponse.json({ success: false, error: "Card payment is not configured." }, { status: 503 });
  }

  const donationsOn = await getFeatureFlag(FEATURE_FLAG_KEYS.TRADING_UNIVERSITY_DONATIONS);
  if (!donationsOn) {
    return NextResponse.json(
      { success: false, error: "Donations are temporarily unavailable." },
      { status: 403 }
    );
  }

  const db = prisma as unknown as {
    tradingUniversityProgress: {
      findUnique: (args: { where: { userId: string } }) => Promise<{ quizPassed: boolean } | null>;
    };
  };
  const row = await db.tradingUniversityProgress.findUnique({
    where: { userId: session.user.id },
  });
  if (!row?.quizPassed) {
    return NextResponse.json(
      { success: false, error: "Donations are available after you pass the Trading University exam." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const monthly = body.monthly === true;
  const rawAmount = Number(body.amountUsd);
  const amountUsd = Math.round(rawAmount * 100) / 100;
  if (!Number.isFinite(amountUsd) || amountUsd < MIN_USD || amountUsd > MAX_USD) {
    return NextResponse.json(
      { success: false, error: `Enter an amount between $${MIN_USD} and $${MAX_USD.toLocaleString()}.` },
      { status: 400 }
    );
  }
  const amountCents = Math.round(amountUsd * 100);
  if (amountCents < 50) {
    return NextResponse.json({ success: false, error: "Minimum charge is $0.50." }, { status: 400 });
  }

  const origin =
    (typeof body.cancelUrl === "string" && body.cancelUrl.startsWith("http")
      ? new URL(body.cancelUrl).origin
      : null) ||
    request.headers.get("origin") ||
    process.env.NEXTAUTH_URL ||
    "https://novastaris.ai";

  const successUrl =
    (typeof body.successUrl === "string" && body.successUrl.trim()) ||
    `${origin}/?tab=trading-university&donation=success`;
  const cancelUrl =
    (typeof body.cancelUrl === "string" && body.cancelUrl.trim()) ||
    `${origin}/?tab=trading-university&donation=canceled`;

  const planId = monthly ? "donation_monthly" : "donation_once";
  const productName = monthly
    ? "NovaStaris Trading University — Monthly donation"
    : "NovaStaris Trading University — Donation";
  const productDescription = monthly
    ? `Voluntary monthly donation of $${amountUsd.toFixed(2)} USD to support free Trading University education. Cancel anytime via Stripe customer portal / support.`
    : `Voluntary one-time donation of $${amountUsd.toFixed(2)} USD to support free Trading University education.`;

  try {
    const existingCustomerId = await getStripeCustomerId(session.user.id);
    const sharedMetadata = {
      purpose: "trading_university_donation",
      planId,
      amountUsd: String(amountUsd),
      monthly: monthly ? "true" : "false",
      userId: session.user.id,
    };

    const checkoutSession = monthly
      ? await stripe.checkout.sessions.create({
          mode: "subscription",
          payment_method_types: ["card"],
          customer: existingCustomerId ?? undefined,
          customer_email: existingCustomerId ? undefined : session.user.email,
          client_reference_id: session.user.id,
          metadata: sharedMetadata,
          subscription_data: {
            metadata: {
              purpose: "trading_university_donation",
              planId,
              userId: session.user.id,
              amountUsd: String(amountUsd),
            },
          },
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: "usd",
                unit_amount: amountCents,
                recurring: { interval: "month" },
                product_data: {
                  name: productName,
                  description: productDescription,
                },
              },
            },
          ],
          success_url: successUrl,
          cancel_url: cancelUrl,
        })
      : await stripe.checkout.sessions.create({
          mode: "payment",
          payment_method_types: ["card"],
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
                product_data: {
                  name: productName,
                  description: productDescription,
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
      monthly,
      amountUsd,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create donation checkout.";
    console.error("Stripe donation checkout error:", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
