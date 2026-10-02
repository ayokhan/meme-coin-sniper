import { prisma } from '@/lib/db';

/**
 * Access tier. Nova Pro subscribers also resolve to `vip` here (VIP-level desks);
 * use `getSubscriptionProduct` / `session.user.isNovaPro` for Pro-specific caps and exclusions.
 */
export type Tier = 'vip';

/** What the customer bought. Drives pricing, caps, bot/Coach Calls exclusion and copy. */
export type SubscriptionProduct = 'vip' | 'nova_pro';

/** DB values: `pro` is the retired tier (treated as VIP), `nova_pro` is the current Nova Pro tier. */
export type StoredTier = 'pro' | 'vip' | 'nova_pro';

export const NOVA_PRO_TIER = 'nova_pro' as const;

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

/** Nova Pro: VIP desks with daily caps, no bots, no Coach Calls. $50/mo USDC; same 6/12-month discounts. Card +$8. */
export const NOVA_PRO_PLANS = [
  { id: 'pro_1month', label: '1 month', months: 1, priceUsd: 50 },
  { id: 'pro_6month', label: '6 months (1 month free)', months: 6, priceUsd: 250 },
  { id: 'pro_12month', label: '12 months (2 months free)', months: 12, priceUsd: 500 },
] as const;

/** Founding (limited edition) members keep these launch prices while they keep renewing. */
export const NOVA_PRO_FOUNDING_PLANS: readonly { id: NovaProPlanId; priceUsd: number }[] = [
  { id: 'pro_1month', priceUsd: 50 },
  { id: 'pro_6month', priceUsd: 250 },
  { id: 'pro_12month', priceUsd: 500 },
];

export type NovaProPlanId = (typeof NOVA_PRO_PLANS)[number]['id'];
export type NovaProPlan = (typeof NOVA_PRO_PLANS)[number];

/** Any purchasable plan (VIP or Nova Pro). */
export type AnyPlan = { id: string; label: string; months: number; priceUsd: number };

export function isNovaProPlanId(id: string | null | undefined): id is NovaProPlanId {
  return NOVA_PRO_PLANS.some((p) => p.id === id);
}

export function productForPlanId(id: string | null | undefined): SubscriptionProduct {
  return isNovaProPlanId(id) ? 'nova_pro' : 'vip';
}

/** Stored tier value for a new Subscription row. */
export function storedTierForProduct(product: SubscriptionProduct): 'vip' | 'nova_pro' {
  return product === 'nova_pro' ? NOVA_PRO_TIER : 'vip';
}

export function findAnyPlanById(id: string | null | undefined): AnyPlan | undefined {
  if (!id) return undefined;
  return VIP_PLANS.find((p) => p.id === id) ?? NOVA_PRO_PLANS.find((p) => p.id === id);
}

/** Nova Pro plan with the founding price lock applied. */
export function novaProPlanForUser(id: NovaProPlanId, founding: boolean): AnyPlan {
  const base = NOVA_PRO_PLANS.find((p) => p.id === id)!;
  if (!founding) return { ...base };
  const locked = NOVA_PRO_FOUNDING_PLANS.find((p) => p.id === id);
  return { ...base, priceUsd: Math.min(base.priceUsd, locked?.priceUsd ?? base.priceUsd) };
}

export function findNovaProPlanByListOrCardAmount(amountUsd: number): NovaProPlan | undefined {
  return (
    NOVA_PRO_PLANS.find((p) => p.priceUsd === amountUsd) ??
    NOVA_PRO_PLANS.find((p) => getCardPriceUsd(p.priceUsd) === amountUsd)
  );
}

/** @deprecated Use VIP_PLANS. Kept for imports that referenced PLANS. */
export const PLANS = [...VIP_PLANS];

/** Card fee applies to every card checkout. */
export function cardPaymentFeeApplies(): boolean {
  return true;
}

export function getCardPriceUsd(listPriceUsd: number): number {
  return listPriceUsd + CARD_PAYMENT_FEE_USD;
}

export function getCardPriceForPlan(plan: { priceUsd: number }): number {
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

/** Map DB tier values to the access tier (Nova Pro and retired Pro both have VIP-level desk access). */
export function normalizeSubscriptionTier(raw: string | null | undefined): Tier | null {
  if (raw === 'vip' || raw === 'pro' || raw === NOVA_PRO_TIER) return 'vip';
  return null;
}

export type SubscriptionProductInfo = {
  product: SubscriptionProduct | null;
  /** Active founding Nova Pro seat. */
  founding: boolean;
  /** Latest active Nova Pro expiry (null when product is not nova_pro). */
  novaProExpiresAt: Date | null;
};

/**
 * Which product the user currently has. Any active VIP (or retired Pro) row wins over Nova Pro,
 * so a VIP upgrade immediately removes Pro caps.
 */
export async function getSubscriptionProductInfo(userId: string): Promise<SubscriptionProductInfo> {
  const rows = (await prisma.subscription.findMany({
    where: { userId, expiresAt: { gt: new Date() } },
    select: { tier: true, expiresAt: true, founding: true },
    orderBy: { expiresAt: 'desc' },
  })) as { tier: string; expiresAt: Date; founding: boolean }[];
  if (rows.length === 0) return { product: null, founding: false, novaProExpiresAt: null };
  if (rows.some((r) => r.tier !== NOVA_PRO_TIER)) return { product: 'vip', founding: false, novaProExpiresAt: null };
  return { product: 'nova_pro', founding: rows.some((r) => r.founding), novaProExpiresAt: rows[0].expiresAt };
}

export async function getSubscriptionProduct(userId: string): Promise<SubscriptionProduct | null> {
  return (await getSubscriptionProductInfo(userId)).product;
}

/** True when the user's active product is Nova Pro (owner / coach users are never Pro-capped). */
export async function isNovaProUser(userId: string): Promise<boolean> {
  if ((await getSubscriptionProduct(userId)) !== 'nova_pro') return false;
  const { isOwnerUserId, isCoachUserId } = await import('@/lib/auth');
  if (await isOwnerUserId(userId)) return false;
  if (await isCoachUserId(userId)) return false;
  return true;
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
