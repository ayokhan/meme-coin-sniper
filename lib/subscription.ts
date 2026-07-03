import { prisma } from '@/lib/db';

/** Active product tier (paid subscribers are VIP only). */
export type Tier = 'vip';

/** Legacy values stored on older Subscription rows before Pro was retired. */
export type StoredTier = 'pro' | 'vip';

/** Flat fee added to list price for credit/debit card checkout (USDC pays list price only). */
export const CARD_PAYMENT_FEE_USD = 8;

/** VIP: full platform access. $150/mo USDC; 6mo $750 (1 free); 12mo $1500 (2 free). Card +$8. */
export const VIP_PLANS = [
  { id: '1month', label: '1 month', months: 1, priceUsd: 150 },
  { id: '6month', label: '6 months (1 month free)', months: 6, priceUsd: 750 },
  { id: '12month', label: '12 months (2 months free)', months: 12, priceUsd: 1500 },
] as const;

export type VipPlanId = (typeof VIP_PLANS)[number]['id'];
export type SubscriptionPlan = (typeof VIP_PLANS)[number];

/** @deprecated Use VIP_PLANS. Kept for imports that referenced PLANS. */
export const PLANS = [...VIP_PLANS];

/** Card fee applies to every card checkout. */
export function cardPaymentFeeApplies(): boolean {
  return true;
}

export function getCardPriceUsd(listPriceUsd: number): number {
  return listPriceUsd + CARD_PAYMENT_FEE_USD;
}

export function getCardPriceForPlan(plan: SubscriptionPlan): number {
  return getCardPriceUsd(plan.priceUsd);
}

/** Legacy Pro list/card amounts → VIP plan (for in-flight Stripe/USDC payments). */
const LEGACY_PRO_AMOUNT_TO_PLAN: Record<number, VipPlanId> = {
  20: '1month',
  70: '1month',
  78: '1month',
  150: '1month',
  158: '1month',
  350: '6month',
  358: '6month',
  750: '6month',
  758: '6month',
  700: '12month',
  708: '12month',
  1500: '12month',
  1508: '12month',
};

export function findPlanByListOrCardAmount(amountUsd: number): SubscriptionPlan | undefined {
  const direct =
    VIP_PLANS.find((p) => p.priceUsd === amountUsd) ??
    VIP_PLANS.find((p) => getCardPriceUsd(p.priceUsd) === amountUsd);
  if (direct) return direct;
  const legacyId = LEGACY_PRO_AMOUNT_TO_PLAN[amountUsd];
  if (legacyId) return VIP_PLANS.find((p) => p.id === legacyId);
  return undefined;
}

/** Map legacy DB tier values to the current product tier. */
export function normalizeSubscriptionTier(raw: string | null | undefined): Tier | null {
  if (raw === 'vip' || raw === 'pro') return 'vip';
  return null;
}

/** Returns true if user has any active (non-expired) subscription. */
export async function getActiveSubscription(userId: string): Promise<boolean> {
  const sub = await prisma.subscription.findFirst({
    where: { userId, expiresAt: { gt: new Date() } },
    orderBy: { expiresAt: 'desc' },
  });
  return !!sub;
}

/** Returns active subscription tier (`vip`) or null. Legacy `pro` rows count as VIP. */
export async function getSubscriptionTier(userId: string): Promise<Tier | null> {
  const sub = await prisma.subscription.findFirst({
    where: { userId, expiresAt: { gt: new Date() } },
    orderBy: { expiresAt: 'desc' },
  }) as { tier?: string } | null;
  return normalizeSubscriptionTier(sub?.tier);
}

/** Get current subscription end date if any. */
export async function getSubscriptionExpiresAt(userId: string): Promise<Date | null> {
  const sub = await prisma.subscription.findFirst({
    where: { userId, expiresAt: { gt: new Date() } },
    orderBy: { expiresAt: 'desc' },
  });
  return sub?.expiresAt ?? null;
}

export type ActiveSubscriptionDetails = {
  expiresAt: Date;
  autoRenew: boolean;
  cancelAtPeriodEnd: boolean;
  stripeSubscriptionId: string | null;
  plan: string | null;
};

/** Active VIP row with billing fields (for expiry banner / manage renewal). */
export async function getActiveSubscriptionDetails(userId: string): Promise<ActiveSubscriptionDetails | null> {
  const sub = (await prisma.subscription.findFirst({
    where: { userId, expiresAt: { gt: new Date() } },
    orderBy: { expiresAt: 'desc' },
  })) as {
    expiresAt: Date;
    autoRenew?: boolean;
    cancelAtPeriodEnd?: boolean;
    stripeSubscriptionId?: string | null;
    plan?: string | null;
  } | null;
  if (!sub) return null;
  return {
    expiresAt: sub.expiresAt,
    autoRenew: sub.autoRenew ?? false,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd ?? false,
    stripeSubscriptionId: sub.stripeSubscriptionId ?? null,
    plan: sub.plan ?? null,
  };
}

/** True if user has VIP (includes legacy Pro subscriptions). */
export async function hasVip(userId: string): Promise<boolean> {
  return (await getSubscriptionTier(userId)) === 'vip';
}
