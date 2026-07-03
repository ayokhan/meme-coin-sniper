import type Stripe from "stripe";
import { getStripeCustomerId, setStripeCustomerId } from "@/lib/stripe-billing";
import { prisma } from "@/lib/db";

export const STRIPE_BILLING_TEST_TRIAL_MINUTES = 5;
export const STRIPE_BILLING_TEST_CHARGE_USD = 1;

export function isStripeTestModeKey(secretKey: string | undefined): boolean {
  return !!secretKey?.startsWith("sk_test_");
}

export function stripeBillingTestLiveAllowed(): boolean {
  return process.env.STRIPE_BILLING_TEST_ALLOW_LIVE === "true";
}

export function canRunStripeBillingTest(secretKey: string | undefined): boolean {
  if (!secretKey) return false;
  return isStripeTestModeKey(secretKey) || stripeBillingTestLiveAllowed();
}

export async function getOrCreateStripeCustomer(
  stripe: Stripe,
  userId: string,
  email: string
): Promise<string> {
  const existing = await getStripeCustomerId(userId);
  if (existing) return existing;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  const customer = await stripe.customers.create({
    email,
    name: user?.name ?? undefined,
    metadata: { userId, novastarisUserId: userId },
  });
  await setStripeCustomerId(userId, customer.id);
  return customer.id;
}

export async function createReceiptTestCheckout(
  stripe: Stripe,
  input: { userId: string; email: string; successUrl: string; cancelUrl: string }
): Promise<Stripe.Checkout.Session> {
  const customerId = await getOrCreateStripeCustomer(stripe, input.userId, input.email);
  const amountCents = STRIPE_BILLING_TEST_CHARGE_USD * 100;

  return stripe.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    client_reference_id: input.userId,
    invoice_creation: { enabled: true },
    metadata: {
      userId: input.userId,
      billingTest: "receipt",
      tier: "vip",
      planId: "billing-test-receipt",
      amountUsd: String(STRIPE_BILLING_TEST_CHARGE_USD),
      autoRenew: "false",
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: amountCents,
          product_data: {
            name: "NovaStaris receipt email test",
            description: "One-time $1 charge to verify Stripe sends a payment receipt email.",
          },
        },
      },
    ],
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
  });
}

export async function createTrialSubscriptionBillingTest(
  stripe: Stripe,
  input: { userId: string; email: string }
): Promise<{ subscriptionId: string; trialEndsAt: Date; customerId: string }> {
  const customerId = await getOrCreateStripeCustomer(stripe, input.userId, input.email);
  const trialEnd = Math.floor(Date.now() / 1000) + STRIPE_BILLING_TEST_TRIAL_MINUTES * 60;
  const amountCents = STRIPE_BILLING_TEST_CHARGE_USD * 100;

  const product = await stripe.products.create({
    name: "NovaStaris billing test subscription",
    description: `${STRIPE_BILLING_TEST_TRIAL_MINUTES}-minute trial, then $${STRIPE_BILLING_TEST_CHARGE_USD}/day (auto-cancels after first paid period).`,
  });
  const price = await stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: amountCents,
    recurring: { interval: "day", interval_count: 1 },
  });

  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    trial_end: trialEnd,
    cancel_at_period_end: true,
    metadata: {
      userId: input.userId,
      planId: "billing-test-trial",
      tier: "vip",
      billingTest: "5min_trial",
    },
    items: [{ price: price.id }],
  });

  return {
    subscriptionId: subscription.id,
    trialEndsAt: new Date(trialEnd * 1000),
    customerId,
  };
}
