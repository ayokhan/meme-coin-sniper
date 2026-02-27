import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isOwnerEmail } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { PRO_PLANS, VIP_PLANS, type Tier } from '@/lib/subscription';

type Action = 'set' | 'clear';

type Body =
  | {
      action: 'set';
      tier: Tier;
      planId?: string | null;
      months?: number | null;
    }
  | {
      action: 'clear';
    };

/** POST - Owner-only. Manually set or clear a user's subscription (Pro / VIP) for admin tools. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email ?? null;
    if (!email) {
      return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
    }
    if (!isOwnerEmail(email)) {
      return NextResponse.json({ success: false, error: 'Not authorized. Owner only.' }, { status: 403 });
    }

    const { userId } = await params;
    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID required.' }, { status: 400 });
    }

    const rawBody = (await request.json().catch(() => ({}))) as Partial<Body>;
    const action = rawBody.action as Action | undefined;

    if (!action) {
      return NextResponse.json({ success: false, error: 'Action is required.' }, { status: 400 });
    }

    if (action === 'clear') {
      const now = new Date();
      const expiredAt = new Date(now.getTime() - 60 * 1000);
      await prisma.subscription.updateMany({
        where: { userId, expiresAt: { gt: now } },
        data: { expiresAt: expiredAt },
      });
      return NextResponse.json({ success: true, cleared: true });
    }

    // action === 'set'
    const tier = (rawBody as Extract<Body, { action: 'set' }>).tier;
    if (tier !== 'pro' && tier !== 'vip') {
      return NextResponse.json({ success: false, error: 'Invalid tier. Use \"pro\" or \"vip\".' }, { status: 400 });
    }

    const monthsOverride = (rawBody as Extract<Body, { action: 'set' }>).months ?? null;
    const planIdOverride = (rawBody as Extract<Body, { action: 'set' }>).planId ?? null;

    const plans = tier === 'pro' ? PRO_PLANS : VIP_PLANS;
    let plan =
      (planIdOverride ? plans.find((p) => p.id === planIdOverride) : null) ??
      plans.find((p) => p.id === '1month') ??
      plans[0];

    if (!plan) {
      return NextResponse.json({ success: false, error: 'No plan configured for this tier.' }, { status: 500 });
    }

    const months = typeof monthsOverride === 'number' && monthsOverride > 0 ? monthsOverride : plan.months || 1;

    const expiresAt = new Date();
    if (months === 0) {
      expiresAt.setDate(expiresAt.getDate() + 1);
    } else {
      expiresAt.setMonth(expiresAt.getMonth() + months);
    }

    const sub = await prisma.subscription.create({
      data: {
        userId,
        tier,
        plan: plan.id,
        amountUsd: plan.priceUsd,
        expiresAt,
        txSignature: `admin-manual-${Date.now()}`,
      },
    });

    return NextResponse.json({
      success: true,
      subscription: {
        tier: sub.tier,
        plan: sub.plan,
        expiresAt: sub.expiresAt.toISOString(),
      },
    });
  } catch (e) {
    console.error('Admin set subscription error:', e);
    return NextResponse.json({ success: false, error: 'Failed to update subscription.' }, { status: 500 });
  }
}

