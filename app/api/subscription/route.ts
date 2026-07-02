import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { VIP_PLANS, CARD_PAYMENT_FEE_USD, getActiveSubscription, getSubscriptionExpiresAt, getSubscriptionTier } from '@/lib/subscription';
import { verifyUsdcPayment } from '@/lib/verify-solana-payment';
import { getUsageThisMonth } from '@/lib/usage';

const PAYMENT_WALLET = process.env.SOLANA_PAYMENT_WALLET ?? '';
const USDC_MINT = process.env.SOLANA_USDC_MINT ?? 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

/** GET - current user's subscription status, VIP plans, usage, and payment terms acceptance. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, subscribed: false, paid: false });
  }
  const [paid, expiresAt, tier, usage, user] = await Promise.all([
    getActiveSubscription(session.user.id),
    getSubscriptionExpiresAt(session.user.id),
    getSubscriptionTier(session.user.id),
    getUsageThisMonth(session.user.id),
    prisma.user.findUnique({ where: { id: session.user.id } }),
  ]);
  const paymentTermsAcceptedAt = (user as { paymentTermsAcceptedAt?: Date | null } | null)?.paymentTermsAcceptedAt;
  return NextResponse.json({
    success: true,
    paid,
    subscriptionTier: tier,
    expiresAt: expiresAt?.toISOString() ?? null,
    vipPlans: VIP_PLANS,
    cardPaymentFeeUsd: CARD_PAYMENT_FEE_USD,
    paymentWallet: paid ? undefined : PAYMENT_WALLET,
    usdcMint: USDC_MINT,
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

  const plan = VIP_PLANS.find((p) => p.id === planId);
  if (!plan) {
    return NextResponse.json({ success: false, error: 'Invalid plan.' }, { status: 400 });
  }

  if (!txSignature) {
    return NextResponse.json({
      success: true,
      message: 'Send USDC to complete subscription.',
      tier: 'vip',
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

  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + plan.months);

  await prisma.subscription.create({
    data: {
      userId: session.user.id,
      tier: 'vip',
      plan: plan.id,
      amountUsd: plan.priceUsd,
      expiresAt,
      txSignature,
    },
  });

  return NextResponse.json({
    success: true,
    subscribed: true,
    tier: 'vip',
    expiresAt: expiresAt.toISOString(),
    message: 'Subscription activated.',
  });
}
