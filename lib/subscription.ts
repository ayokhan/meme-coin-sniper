import { prisma } from '@/lib/db';

export type Tier = 'pro' | 'vip';

/** Pro: everything except Twitter tracker and Copy wallet. $100/mo, 6mo $500, 12mo $1000 */
export const PRO_PLANS = [
  { id: '1month', label: '1 month', months: 1, priceUsd: 100 },
  { id: '6month', label: '6 months (1 month free)', months: 6, priceUsd: 500 },
  { id: '12month', label: '12 months (2 months free)', months: 12, priceUsd: 1000 },
] as const;

/** VIP: Twitter tracker + Copy wallet (everything). Current price structure. */
export const VIP_PLANS = [
  { id: '1day', label: '1 day trial', months: 0, priceUsd: 10 },
  { id: '1month', label: '1 month', months: 1, priceUsd: 250 },
  { id: '3month', label: '3 months', months: 3, priceUsd: 700 },
  { id: '6month', label: '6 months', months: 6, priceUsd: 1400 },
] as const;

export type ProPlanId = (typeof PRO_PLANS)[number]['id'];
export type VipPlanId = (typeof VIP_PLANS)[number]['id'];

/** All plans for display (legacy); prefer PRO_PLANS / VIP_PLANS by tier. */
export const PLANS = [...PRO_PLANS, ...VIP_PLANS];

/** Returns true if user has any active (non-expired) subscription. */
export async function getActiveSubscription(userId: string): Promise<boolean> {
  const sub = await prisma.subscription.findFirst({
    where: { userId, expiresAt: { gt: new Date() } },
    orderBy: { expiresAt: 'desc' },
  });
  return !!sub;
}

/** Returns active subscription tier ('pro' | 'vip') or null. */
export async function getSubscriptionTier(userId: string): Promise<Tier | null> {
  const sub = await prisma.subscription.findFirst({
    where: { userId, expiresAt: { gt: new Date() } },
    orderBy: { expiresAt: 'desc' },
  }) as { tier?: string } | null;
  return sub?.tier ? (sub.tier as Tier) : null;
}

/** Get current subscription end date if any. */
export async function getSubscriptionExpiresAt(userId: string): Promise<Date | null> {
  const sub = await prisma.subscription.findFirst({
    where: { userId, expiresAt: { gt: new Date() } },
    orderBy: { expiresAt: 'desc' },
  });
  return sub?.expiresAt ?? null;
}

/** True if user has VIP (includes Twitter tracker + Copy wallet). */
export async function hasVip(userId: string): Promise<boolean> {
  const tier = await getSubscriptionTier(userId);
  return tier === 'vip';
}
