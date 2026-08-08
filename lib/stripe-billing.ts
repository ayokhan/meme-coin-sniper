import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import type { SubscriptionPlan } from "@/lib/subscription";
import { recordReferralCommissionForSubscription } from "@/lib/referral-commission";

export function planToStripeRecurring(plan: SubscriptionPlan): {
  interval: "month" | "year";
  interval_count: number;
} {
  if (plan.months >= 12) return { interval: "year", interval_count: 1 };
  return { interval: "month", interval_count: plan.months };
}

export async function upsertSubscriptionFromStripePeriod(input: {
  userId: string;
  planId: string;
  amountUsd: number;
  periodEnd: Date;
  stripeSessionId?: string | null;
  stripeSubscriptionId?: string | null;
  autoRenew?: boolean;
  isTrial?: boolean;
  trialEndsAt?: Date | null;
}): Promise<void> {
  const db = prisma as unknown as {
    subscription: {
      findFirst: (args: unknown) => Promise<{ id: string } | null>;
      update: (args: unknown) => Promise<unknown>;
      create: (args: unknown) => Promise<unknown>;
    };
    user: {
      update: (args: unknown) => Promise<unknown>;
    };
  };

  const trialData =
    input.isTrial != null
      ? {
          isTrial: input.isTrial,
          trialEndsAt: input.trialEndsAt ?? (input.isTrial ? input.periodEnd : null),
          // Card trial is desk-capped; paid renewals clear admin Limited grants.
          deskLimited: false,
        }
      : { deskLimited: false };

  if (input.stripeSubscriptionId) {
    const existing = await db.subscription.findFirst({
      where: { stripeSubscriptionId: input.stripeSubscriptionId },
    });
    if (existing) {
      await db.subscription.update({
        where: { id: existing.id },
        data: {
          expiresAt: input.periodEnd,
          plan: input.planId,
          amountUsd: input.amountUsd,
          autoRenew: input.autoRenew ?? true,
          ...trialData,
        },
      });
      return;
    }
  }

  if (input.stripeSessionId) {
    const bySession = await db.subscription.findFirst({
      where: { stripeSessionId: input.stripeSessionId },
    });
    if (bySession) return;
  }

  const created = (await db.subscription.create({
    data: {
      userId: input.userId,
      tier: "vip",
      plan: input.planId,
      amountUsd: input.amountUsd,
      expiresAt: input.periodEnd,
      stripeSessionId: input.stripeSessionId ?? null,
      stripeSubscriptionId: input.stripeSubscriptionId ?? null,
      autoRenew: input.autoRenew ?? false,
      isTrial: input.isTrial ?? false,
      trialEndsAt: input.trialEndsAt ?? null,
      deskLimited: false,
    },
  })) as { id: string };

  // Don't create affiliate commission on $0 trial start — wait for paid invoice.
  if (!input.isTrial) {
    await recordReferralCommissionForSubscription(created.id);
  }
}

export function trialEndFromStripeSubscription(sub: Stripe.Subscription): Date | null {
  if (typeof sub.trial_end === "number" && sub.trial_end > 0) {
    return new Date(sub.trial_end * 1000);
  }
  return null;
}

/** Prefer trial_end while trialing so VIP expiresAt matches first charge time. */
export function vipAccessEndFromStripeSubscription(sub: Stripe.Subscription): Date {
  if (sub.status === "trialing") {
    const trialEnd = trialEndFromStripeSubscription(sub);
    if (trialEnd) return trialEnd;
  }
  return periodEndFromStripeSubscription(sub);
}

export async function setStripeCustomerId(userId: string, customerId: string): Promise<void> {
  await (prisma as unknown as { user: { update: (args: unknown) => Promise<unknown> } }).user.update({
    where: { id: userId },
    data: { stripeCustomerId: customerId },
  });
}

export async function getStripeCustomerId(userId: string): Promise<string | null> {
  const user = (await prisma.user.findUnique({ where: { id: userId } })) as {
    stripeCustomerId?: string | null;
  } | null;
  return user?.stripeCustomerId ?? null;
}

/** Resolve Stripe customer id from user record or active subscription (and persist when found). */
export async function resolveStripeCustomerId(
  userId: string,
  stripe: import("stripe").default
): Promise<string | null> {
  const existing = await getStripeCustomerId(userId);
  if (existing) return existing;

  const { getActiveSubscriptionDetails } = await import("@/lib/subscription");
  const details = await getActiveSubscriptionDetails(userId);
  if (!details?.stripeSubscriptionId) return null;

  try {
    const sub = await stripe.subscriptions.retrieve(details.stripeSubscriptionId);
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
    if (customerId) {
      await setStripeCustomerId(userId, customerId);
      return customerId;
    }
  } catch (e) {
    console.error("resolveStripeCustomerId error:", e);
  }
  return null;
}

export function periodEndFromStripeSubscription(sub: Stripe.Subscription): Date {
  const raw = sub as Stripe.Subscription & {
    current_period_end?: number;
    items?: { data?: Array<{ current_period_end?: number }> };
  };
  const end = raw.items?.data?.[0]?.current_period_end ?? raw.current_period_end ?? Math.floor(Date.now() / 1000);
  return new Date(end * 1000);
}
