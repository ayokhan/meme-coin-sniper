import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { PLANS, getActiveSubscription, getSubscriptionExpiresAt, type PlanId } from '@/lib/subscription';
import { verifyUsdcPayment } from '@/lib/verify-solana-payment';

const PAYMENT_WALLET = process.env.SOLANA_PAYMENT_WALLET ?? '';
const USDC_MINT = process.env.SOLANA_USDC_MINT ?? 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

/** GET - current user's subscription status (and payment address if not paid). */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, subscribed: false, paid: false });
  }
  const paid = await getActiveSubscription(session.user.id);
  const expiresAt = await getSubscriptionExpiresAt(session.user.id);
  return NextResponse.json({
    success: true,
    paid,
    expiresAt: expiresAt?.toISOString() ?? null,
    plans: PLANS,
    paymentWallet: paid ? undefined : PAYMENT_WALLET,
    usdcMint: USDC_MINT,
  });
}

/** POST - verify payment by transaction signature and grant subscription. */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const txSignature = (body.txSignature ?? body.signature ?? body.tx ?? '').toString().trim();
  const planId = (body.plan ?? body.planId ?? '1month').toString() as PlanId;

  const plan = PLANS.find((p) => p.id === planId);
  if (!plan) {
    return NextResponse.json({ success: false, error: 'Invalid plan.' }, { status: 400 });
  }

  if (!txSignature) {
    return NextResponse.json({
      success: true,
      message: 'Send USDC to complete subscription.',
      plan: plan.id,
      amountUsdc: plan.priceUsd,
      paymentWallet: PAYMENT_WALLET,
      instruction: `Send ${plan.priceUsd} USDC to ${PAYMENT_WALLET} (Solana), then paste the transaction signature here to activate.`,
    });
  }

  if (!PAYMENT_WALLET) {
    return NextResponse.json({ success: false, error: 'Payment not configured.' }, { status: 503 });
  }

  // Reject if this tx was already used (replay protection)
  const existing = await prisma.subscription.findFirst({ where: { txSignature } });
  if (existing) {
    return NextResponse.json({ success: false, error: 'This transaction was already used for a subscription.' }, { status: 400 });
  }

  // Verify on-chain that the tx sent at least plan.priceUsd USDC to our wallet
  const verification = await verifyUsdcPayment(txSignature, PAYMENT_WALLET, USDC_MINT, plan.priceUsd);
  if (!verification.ok) {
    return NextResponse.json({ success: false, error: verification.error }, { status: 400 });
  }

  const expiresAt = new Date();
  if (plan.months === 0) {
    expiresAt.setDate(expiresAt.getDate() + 1); // 1-day trial
  } else {
    expiresAt.setMonth(expiresAt.getMonth() + plan.months);
  }

  await prisma.subscription.create({
    data: {
      userId: session.user.id,
      plan: plan.id,
      amountUsd: plan.priceUsd,
      expiresAt,
      txSignature,
    },
  });

  return NextResponse.json({
    success: true,
    subscribed: true,
    expiresAt: expiresAt.toISOString(),
    message: 'Subscription activated.',
  });
}
