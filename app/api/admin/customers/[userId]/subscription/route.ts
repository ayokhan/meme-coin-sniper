import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isOwnerEmail } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { VIP_PLANS } from '@/lib/subscription';

type Action = 'set' | 'clear';

type Body =
  | {
      action: 'set';
      tier?: string;
      planId?: string | null;
      months?: number | null;
    }
  | {
      action: 'clear';
    };

/** POST - Owner-only. Manually set or clear a user's VIP subscription for admin tools. */
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
      const client: any = prisma;
      await client.subscription.updateMany({
        where: { userId, expiresAt: { gt: now } },
        data: { expiresAt: expiredAt },
      });
      return NextResponse.json({ success: true, cleared: true });
    }

    const monthsOverride = (rawBody as Extract<Body, { action: 'set' }>).months ?? null;
    const planIdOverride = (rawBody as Extract<Body, { action: 'set' }>).planId ?? null;

    const plan =
      (planIdOverride ? VIP_PLANS.find((p) => p.id === planIdOverride) : null) ??
      VIP_PLANS.find((p) => p.id === '1month') ??
      VIP_PLANS[0];

    if (!plan) {
      return NextResponse.json({ success: false, error: 'No plan configured.' }, { status: 500 });
    }

    const months =
      typeof monthsOverride === 'number' && monthsOverride >= 0
        ? monthsOverride
        : plan.months || 1;

    const expiresAt = new Date();
    if (months === 0) {
      expiresAt.setDate(expiresAt.getDate() + 1);
    } else {
      expiresAt.setMonth(expiresAt.getMonth() + months);
    }

    await prisma.subscription.create({
      data: {
        userId,
        tier: 'vip',
        plan: plan.id,
        amountUsd: plan.priceUsd,
        expiresAt,
        txSignature: `admin-manual-${Date.now()}`,
      },
    });

    return NextResponse.json({
      success: true,
      subscription: {
        tier: 'vip',
        plan: plan.id,
        expiresAt: expiresAt.toISOString(),
      },
    });
  } catch (e) {
    console.error('Admin set subscription error:', e);
    return NextResponse.json({ success: false, error: 'Failed to update subscription.' }, { status: 500 });
  }
}
