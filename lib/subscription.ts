import { prisma } from '@/lib/db';

export type Tier = 'pro' | 'vip';

/** Pro: Surge, Transactions, NovaStaris AI Agent, Futures. $50/mo, 6mo $250 (1 free), 12mo $500 (2 free) */
export const PRO_PLANS = [
  { id: '1month', label: '1 month', months: 1, priceUsd: 50 },
  { id: '6month', label: '6 months (1 month free)', months: 6, priceUsd: 250 },
  { id: '12month', label: '12 months (2 months free)', months: 12, priceUsd: 500 },
] as const;

/** VIP: full access + CT Scan, Wallet Tracker, Coach Calls. 1 day trial $10; $150/mo, 6mo $750 (1 free), 12mo $1500 (2 free) */
export const VIP_PLANS = [
  { id: '1day', label: '1 day trial', months: 0, priceUsd: 10 },
  { id: '1month', label: '1 month', months: 1, priceUsd: 150 },
  { id: '6month', label: '6 months (1 month free)', months: 6, priceUsd: 750 },
  { id: '12month', label: '12 months (2 months free)', months: 12, priceUsd: 1500 },
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

/** True if user has VIP (includes Twitter tracker + Profitable Traders Wallet Tracker). */
export async function hasVip(userId: string): Promise<boolean> {
  const tier = await getSubscriptionTier(userId);
  return tier === 'vip';
}
