import { prisma } from '@/lib/db';

export const PLANS = [
  { id: '1day', label: '1 day trial', months: 0, priceUsd: 10 },   // 0 = 1 day
  { id: '1month', label: '1 month', months: 1, priceUsd: 250 },
  { id: '3month', label: '3 months', months: 3, priceUsd: 700 },   // $50 off
  { id: '6month', label: '6 months', months: 6, priceUsd: 1400 }, // $100 off
] as const;

export type PlanId = (typeof PLANS)[number]['id'];

/** Returns true if user has an active (non-expired) subscription. */
export async function getActiveSubscription(userId: string): Promise<boolean> {
  const sub = await prisma.subscription.findFirst({
    where: { userId, expiresAt: { gt: new Date() } },
    orderBy: { expiresAt: 'desc' },
  });
  return !!sub;
}

/** Get current subscription end date if any. */
export async function getSubscriptionExpiresAt(userId: string): Promise<Date | null> {
  const sub = await prisma.subscription.findFirst({
    where: { userId, expiresAt: { gt: new Date() } },
    orderBy: { expiresAt: 'desc' },
  });
  return sub?.expiresAt ?? null;
}
