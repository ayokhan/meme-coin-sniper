import { prisma } from '@/lib/db';

export type Tier = 'pro' | 'vip';

/** Flat fee added to list price for credit/debit card checkout (USDC pays list price only). */
export const CARD_PAYMENT_FEE_USD = 8;

/** Pro: Surge, Transactions, NovaStaris AI Agent, Futures. $70/mo USDC; 6mo $350 (1 free); 12mo $700 (2 free). Card +$8. */
export const PRO_PLANS = [
  { id: '1month', label: '1 month', months: 1, priceUsd: 70 },
  { id: '6month', label: '6 months (1 month free)', months: 6, priceUsd: 350 },
  { id: '12month', label: '12 months (2 months free)', months: 12, priceUsd: 700 },
] as const;

/** VIP: full access + CT Scan, Wallet Tracker, Coach Calls. 1 day trial $20; $150/mo; 6mo $750 (1 free); 12mo $1500 (2 free). Card +$8. */
export const VIP_PLANS = [
  { id: '1day', label: '1 day trial', months: 0, priceUsd: 20 },
  { id: '1month', label: '1 month', months: 1, priceUsd: 150 },
  { id: '6month', label: '6 months (1 month free)', months: 6, priceUsd: 750 },
  { id: '12month', label: '12 months (2 months free)', months: 12, priceUsd: 1500 },
] as const;

export type ProPlanId = (typeof PRO_PLANS)[number]['id'];
export type VipPlanId = (typeof VIP_PLANS)[number]['id'];
export type SubscriptionPlan = (typeof PRO_PLANS)[number] | (typeof VIP_PLANS)[number];

/** All plans for display (legacy); prefer PRO_PLANS / VIP_PLANS by tier. */
export const PLANS = [...PRO_PLANS, ...VIP_PLANS];

export function getCardPriceUsd(listPriceUsd: number): number {
  return listPriceUsd + CARD_PAYMENT_FEE_USD;
}

export function findPlanByListOrCardAmount(
  tier: Tier,
  amountUsd: number
): (typeof PRO_PLANS)[number] | (typeof VIP_PLANS)[number] | undefined {
  const plans = tier === 'vip' ? VIP_PLANS : PRO_PLANS;
  return (
    plans.find((p) => p.priceUsd === amountUsd) ??
    plans.find((p) => getCardPriceUsd(p.priceUsd) === amountUsd)
  );
}

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
