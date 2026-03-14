import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { PRO_PLANS, VIP_PLANS, getActiveSubscription, getSubscriptionExpiresAt, type Tier } from '@/lib/subscription';
import { verifyUsdcPayment } from '@/lib/verify-solana-payment';
import { getUsageThisMonth } from '@/lib/usage';

const PAYMENT_WALLET = process.env.SOLANA_PAYMENT_WALLET ?? '';
const USDC_MINT = process.env.SOLANA_USDC_MINT ?? 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

/** GET - current user's subscription status, plans (Pro + VIP), usage, and payment terms acceptance. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, subscribed: false, paid: false });
  }
  const [paid, expiresAt, usage, user] = await Promise.all([
    getActiveSubscription(session.user.id),
    getSubscriptionExpiresAt(session.user.id),
    getUsageThisMonth(session.user.id),
    prisma.user.findUnique({ where: { id: session.user.id } }),
  ]);
  const paymentTermsAcceptedAt = (user as { paymentTermsAcceptedAt?: Date | null } | null)?.paymentTermsAcceptedAt;
  return NextResponse.json({
    success: true,
    paid,
    expiresAt: expiresAt?.toISOString() ?? null,
    proPlans: PRO_PLANS,
    vipPlans: VIP_PLANS,
    paymentWallet: paid ? undefined : PAYMENT_WALLET,
    usdcMint: USDC_MINT,
    usageThisMonth: usage,
    paymentTermsAcceptedAt: paymentTermsAcceptedAt?.toISOString() ?? null,
  });
}

/** POST - verify payment and grant subscription (tier + planId). Requires payment terms accepted. */
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
  const tier = (body.tier ?? 'pro').toString() as Tier;
  const planId = (body.plan ?? body.planId ?? '').toString();

  if (tier !== 'pro' && tier !== 'vip') {
    return NextResponse.json({ success: false, error: 'Invalid tier. Use "pro" or "vip".' }, { status: 400 });
  }

  const plans = tier === 'pro' ? PRO_PLANS : VIP_PLANS;
  const plan = plans.find((p) => p.id === planId);
  if (!plan) {
    return NextResponse.json({ success: false, error: 'Invalid plan for this tier.' }, { status: 400 });
  }

  if (!txSignature) {
    return NextResponse.json({
      success: true,
      message: 'Send USDC to complete subscription.',
      tier,
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
  if (plan.months === 0) {
    expiresAt.setDate(expiresAt.getDate() + 1);
  } else {
    expiresAt.setMonth(expiresAt.getMonth() + plan.months);
  }

  await prisma.subscription.create({
    data: {
      userId: session.user.id,
      tier,
      plan: plan.id,
      amountUsd: plan.priceUsd,
      expiresAt,
      txSignature,
    },
  });

  return NextResponse.json({
    success: true,
    subscribed: true,
    tier,
    expiresAt: expiresAt.toISOString(),
    message: 'Subscription activated.',
  });
}
