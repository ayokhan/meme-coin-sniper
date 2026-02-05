import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isOwnerEmail } from '@/lib/auth';
import { prisma } from '@/lib/db';

/** GET - List all customers (name, email, phone, country, experience, subscription). Owner-only. */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email ?? null;
    if (!email) {
      return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
    }
    if (!isOwnerEmail(email)) {
      return NextResponse.json({ success: false, error: 'Not authorized. Only owner emails (OWNER_EMAIL) can access.' }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      include: { subscriptions: true },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();
    const customers = users.map((u) => {
      const rawSubs = (u as { subscriptions?: Array<{ plan: string; amountUsd: number; expiresAt: Date }> }).subscriptions ?? [];
      const subs = [...rawSubs].sort((a, b) => new Date(b.expiresAt).getTime() - new Date(a.expiresAt).getTime());
      const activeSub = subs.find((s) => new Date(s.expiresAt) > now);
      const latestSub = subs[0];
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        country: u.country,
        experienceTradingCrypto: u.experienceTradingCrypto,
        createdAt: u.createdAt,
        subscriptionPlan: activeSub ? activeSub.plan : latestSub?.plan ?? null,
        subscriptionExpiresAt: activeSub ? activeSub.expiresAt : latestSub?.expiresAt ?? null,
        isActive: !!activeSub,
      };
    });

    return NextResponse.json({ success: true, customers });
  } catch (e) {
    console.error('Admin customers error:', e);
    return NextResponse.json({ success: false, error: 'Failed to load customers.' }, { status: 500 });
  }
}
