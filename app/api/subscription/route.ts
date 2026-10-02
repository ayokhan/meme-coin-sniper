import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import {
  VIP_PLANS,
  NOVA_PRO_PLANS,
  CARD_PAYMENT_FEE_USD,
  getActiveSubscription,
  getActiveSubscriptionDetails,
  getSubscriptionExpiresAt,
  getSubscriptionProductInfo,
  getSubscriptionTier,
  isNovaProPlanId,
  novaProPlanForUser,
  storedTierForProduct,
  type AnyPlan,
} from '@/lib/subscription';
import {
  applyNovaProUpgradeCredit,
  getFoundingPublicState,
  getNovaProConfig,
  getNovaProRefundStatus,
  getNovaProUsageToday,
  novaProPeriodStart,
  novaProPurchaseBlockReason,
  resolveFoundingForNewPro,
} from '@/lib/nova-pro';
import { getStripeCustomerId } from '@/lib/stripe-billing';
import { verifyUsdcPayment } from '@/lib/verify-solana-payment';
import { getUsageThisMonth } from '@/lib/usage';
import { recordReferralCommissionForSubscription } from '@/lib/referral-commission';
import { FEATURE_FLAG_KEYS, getFeatureFlag } from '@/lib/feature-flags';
import { recordBillingInvoiceFromSubscriptionRow } from '@/lib/billing-invoices';

const PAYMENT_WALLET = process.env.SOLANA_PAYMENT_WALLET ?? '';
const USDC_MINT = process.env.SOLANA_USDC_MINT ?? 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

/** GET - current user's subscription status, VIP plans, usage, and payment terms acceptance. */
export async function GET() {
  const session = await getServerSession(authOptions);
  const [novaProCfg, founding] = await Promise.all([getNovaProConfig(), getFoundingPublicState()]);
  const novaPro = {
    enabled: novaProCfg.enabled,
    plans: NOVA_PRO_PLANS,
    sharedDailyLimit: novaProCfg.sharedDailyLimit,
    pulseDailyLimit: novaProCfg.pulseDailyLimit,
    refundMaxRuns: novaProCfg.refundMaxRuns,
    founding: { enabled: founding.enabled, seats: founding.seats, remaining: founding.remaining },
  };
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, subscribed: false, paid: false, vipPlans: VIP_PLANS, cardPaymentFeeUsd: CARD_PAYMENT_FEE_USD, novaPro });
  }
  const productInfo = await getSubscriptionProductInfo(session.user.id);
  const isNovaPro = productInfo.product === 'nova_pro';
  const [novaProUsage, novaProRefund] = isNovaPro
    ? await Promise.all([getNovaProUsageToday(session.user.id), getNovaProRefundStatus(session.user.id)])
    : [null, null];
  const [paid, expiresAt, tier, usage, user, billing, stripeCustomerId, payCard, payUsdc] = await Promise.all([
    getActiveSubscription(session.user.id),
    getSubscriptionExpiresAt(session.user.id),
    getSubscriptionTier(session.user.id),
    getUsageThisMonth(session.user.id),
    prisma.user.findUnique({ where: { id: session.user.id } }),
    getActiveSubscriptionDetails(session.user.id),
    getStripeCustomerId(session.user.id),
    getFeatureFlag(FEATURE_FLAG_KEYS.SUBSCRIPTION_PAY_CARD),
    getFeatureFlag(FEATURE_FLAG_KEYS.SUBSCRIPTION_PAY_USDC),
  ]);
  const paymentTermsAcceptedAt = (user as { paymentTermsAcceptedAt?: Date | null } | null)?.paymentTermsAcceptedAt;
  return NextResponse.json({
    success: true,
    paid,
    subscriptionTier: tier,
    subscriptionProduct: productInfo.product,
    isNovaPro,
    isFoundingPro: isNovaPro && productInfo.founding,
    novaPro,
    novaProUsage,
    novaProRefund,
    expiresAt: expiresAt?.toISOString() ?? null,
    autoRenew: billing?.autoRenew ?? false,
    cancelAtPeriodEnd: billing?.cancelAtPeriodEnd ?? false,
    hasStripeSubscription: !!billing?.stripeSubscriptionId,
    hasStripeCustomer: !!stripeCustomerId || !!billing?.stripeSubscriptionId,
    vipPlans: VIP_PLANS,
    cardPaymentFeeUsd: CARD_PAYMENT_FEE_USD,
    paymentWallet: (paid && !isNovaPro) || !payUsdc ? undefined : PAYMENT_WALLET,
    usdcMint: USDC_MINT,
    payByCardEnabled: payCard,
    payByUsdcEnabled: payUsdc,
    usageThisMonth: usage,
    paymentTermsAcceptedAt: paymentTermsAcceptedAt?.toISOString() ?? null,
  });
}

/** POST - verify payment and grant VIP subscription (planId). Requires payment terms accepted. */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
  }

  const usdcEnabled = await getFeatureFlag(FEATURE_FLAG_KEYS.SUBSCRIPTION_PAY_USDC);
  if (!usdcEnabled) {
    return NextResponse.json(
      { success: false, error: 'USDC payment is temporarily unavailable. Try card payment or check back later.' },
      { status: 403 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (!(user as { paymentTermsAcceptedAt?: Date | null } | null)?.paymentTermsAcceptedAt) {
    return NextResponse.json(
      { success: false, error: 'You must accept the Payment Terms and Conditions before paying. Check the box on the subscribe page and try again.' },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const txSignature = (body.txSignature ?? body.signature ?? body.tx ?? '').toString().trim();
  const planId = (body.plan ?? body.planId ?? '').toString();

  const isPro = isNovaProPlanId(planId);
  let founding = false;
  let plan: AnyPlan | undefined;
  if (isPro) {
    const blocked = await novaProPurchaseBlockReason(session.user.id);
    if (blocked) {
      return NextResponse.json({ success: false, error: blocked }, { status: 400 });
    }
    founding = await resolveFoundingForNewPro(session.user.id);
    plan = novaProPlanForUser(planId, founding);
  } else {
    plan = VIP_PLANS.find((p) => p.id === planId);
  }
  if (!plan) {
    return NextResponse.json({ success: false, error: 'Invalid plan.' }, { status: 400 });
  }
  const product = isPro ? 'nova_pro' : 'vip';

  if (!txSignature) {
    return NextResponse.json({
      success: true,
      message: 'Send USDC to complete subscription.',
      tier: product,
      plan: plan.id,
      amountUsdc: plan.priceUsd,
      paymentWallet: PAYMENT_WALLET,
      instruction: `Send ${plan.priceUsd} USDC to ${PAYMENT_WALLET} (Solana), then paste the transaction signature here to activate.`,
    });
  }

  if (!PAYMENT_WALLET) {
    return NextResponse.json({ success: false, error: 'Payment not configured.' }, { status: 503 });
  }

  const existing = await prisma.subscription.findFirst({ where: { txSignature } });
  if (existing) {
    return NextResponse.json({ success: false, error: 'This transaction was already used for a subscription.' }, { status: 400 });
  }

  const verification = await verifyUsdcPayment(txSignature, PAYMENT_WALLET, USDC_MINT, plan.priceUsd);
  if (!verification.ok) {
    return NextResponse.json({ success: false, error: verification.error }, { status: 400 });
  }

  const expiresAt = isPro ? new Date(await novaProPeriodStart(session.user.id)) : new Date();
  expiresAt.setMonth(expiresAt.getMonth() + plan.months);

  const sub = await prisma.subscription.create({
    data: {
      userId: session.user.id,
      tier: storedTierForProduct(product),
      plan: plan.id,
      amountUsd: plan.priceUsd,
      expiresAt,
      txSignature,
      founding,
    },
  });

  await recordReferralCommissionForSubscription(sub.id);

  let upgradeCredit: Awaited<ReturnType<typeof applyNovaProUpgradeCredit>> | null = null;
  if (!isPro) {
    upgradeCredit = await applyNovaProUpgradeCredit({
      userId: session.user.id,
      vipSubscriptionId: sub.id,
      vipAutoRenew: false,
    }).catch((e) => {
      console.error('USDC subscribe: Nova Pro upgrade credit failed', e);
      return null;
    });
  }

  await recordBillingInvoiceFromSubscriptionRow({
    userId: session.user.id,
    subscriptionId: sub.id,
    amountUsd: plan.priceUsd,
    planId: plan.id,
    paidAt: new Date(),
    periodEnd: expiresAt,
    paymentMethod: "usdc",
  }).catch((e) => console.error("billing invoice after USDC subscribe:", e));

  try {
    const { sendVipSubscribeOwnerAlert, sendNovaProSubscribeOwnerAlert } = await import("@/lib/vip-subscribe-owner-alert");
    const alert = isPro
      ? await sendNovaProSubscribeOwnerAlert({
          userId: session.user.id,
          planId: plan.id,
          amountUsd: plan.priceUsd,
          paymentMethod: "usdc",
          founding,
          subscriptionId: sub.id,
        })
      : await sendVipSubscribeOwnerAlert({
          userId: session.user.id,
          planId: plan.id,
          amountUsd: plan.priceUsd,
          paymentMethod: "usdc",
          subscriptionId: sub.id,
        });
    if (!alert.ok) {
      console.warn("USDC subscribe: owner alert failed", alert.error);
    }
  } catch (e) {
    console.warn("USDC subscribe: owner alert error", e);
  }

  return NextResponse.json({
    success: true,
    subscribed: true,
    tier: product,
    founding,
    upgradeCredit,
    expiresAt: expiresAt.toISOString(),
    message: 'Subscription activated.',
  });
}
