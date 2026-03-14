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
      const rawSubs = (u as {
        subscriptions?: Array<{
          tier?: string;
          plan: string;
          amountUsd: number;
          expiresAt: Date;
          createdAt: Date;
          stripeSessionId?: string | null;
          txSignature?: string | null;
        }>;
      }).subscriptions ?? [];
      const subs = [...rawSubs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const activeSub = subs.find((s) => new Date(s.expiresAt) > now);
      const latestSub = subs[0];
      const subTier = activeSub?.tier ?? latestSub?.tier ?? null;
      const subPlan = activeSub ? activeSub.plan : latestSub?.plan ?? null;
      const payments = subs.map((s) => ({
        date: s.createdAt,
        amountUsd: s.amountUsd,
        tier: s.tier ?? null,
        plan: s.plan,
        method: s.stripeSessionId ? "card" as const : s.txSignature ? "usdc" as const : "other" as const,
      }));
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        country: u.country,
        experienceTradingCrypto: u.experienceTradingCrypto,
        tradingBotOnDemand: !!(u as { tradingBotOnDemand?: boolean }).tradingBotOnDemand,
        newsletterOptIn: !!(u as { newsletterOptIn?: boolean }).newsletterOptIn,
        novaConnectEnabled: !!(u as { novaConnectEnabled?: boolean }).novaConnectEnabled,
        novaConnectRulesAcceptedAt: (u as { novaConnectRulesAcceptedAt?: Date | null }).novaConnectRulesAcceptedAt ?? null,
        novaConnectCommunityRep: !!(u as { novaConnectCommunityRep?: boolean }).novaConnectCommunityRep,
        novaConnectAllowedByAdmin: !!(u as { novaConnectAllowedByAdmin?: boolean }).novaConnectAllowedByAdmin,
        paymentTermsAcceptedAt: (u as { paymentTermsAcceptedAt?: Date | null }).paymentTermsAcceptedAt ?? null,
        createdAt: u.createdAt,
        subscriptionTier: subTier,
        subscriptionPlan: subPlan,
        subscriptionExpiresAt: activeSub ? activeSub.expiresAt : latestSub?.expiresAt ?? null,
        isActive: !!activeSub,
        payments,
      };
    });

    return NextResponse.json({ success: true, customers });
  } catch (e) {
    console.error('Admin customers error:', e);
    return NextResponse.json({ success: false, error: 'Failed to load customers.' }, { status: 500 });
  }
}
