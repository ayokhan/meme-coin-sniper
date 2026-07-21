import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isOwnerEmail, isOwnerSession } from '@/lib/auth';
import { canViewAdminCustomersSession } from '@/lib/admin-access';
import { prisma } from '@/lib/db';

/** GET - List all customers. Owner or read-only customers admin. */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
    }
    if (!canViewAdminCustomersSession(session)) {
      return NextResponse.json({ success: false, error: 'Not authorized.' }, { status: 403 });
    }
    const readOnly = !isOwnerSession(session);

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
          stripeSubscriptionId?: string | null;
          autoRenew?: boolean;
          cancelAtPeriodEnd?: boolean;
          txSignature?: string | null;
        }>;
      }).subscriptions ?? [];
      const subs = [...rawSubs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const activeSub = subs.find((s) => new Date(s.expiresAt) > now);
      const latestSub = subs[0];
      const stripeSub = activeSub?.stripeSubscriptionId
        ? activeSub
        : subs.find((s) => s.stripeSubscriptionId) ?? null;
      const subTier = activeSub?.tier ?? latestSub?.tier ?? null;
      const subPlan = activeSub ? activeSub.plan : latestSub?.plan ?? null;
      const payments = subs.map((s) => ({
        date: s.createdAt,
        amountUsd: s.amountUsd,
        tier: s.tier ?? null,
        plan: s.plan,
        method: s.stripeSessionId || s.stripeSubscriptionId
          ? ("card" as const)
          : s.txSignature
            ? ("usdc" as const)
            : ("other" as const),
      }));
      const row = {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        country: u.country,
        experienceTradingCrypto: u.experienceTradingCrypto,
        tradingBotOnDemand: !!(u as { tradingBotOnDemand?: boolean }).tradingBotOnDemand,
        polymarketBotOnDemand: !!(u as { polymarketBotOnDemand?: boolean }).polymarketBotOnDemand,
        propFirmBotOnDemand: !!(u as { propFirmBotOnDemand?: boolean }).propFirmBotOnDemand,
        novaUltimateOnDemand: !!(u as { novaUltimateOnDemand?: boolean }).novaUltimateOnDemand,
        ctScanOnDemand: !!(u as { ctScanOnDemand?: boolean }).ctScanOnDemand,
        ctScanOnDemandExpiresAt: (u as { ctScanOnDemandExpiresAt?: Date | null }).ctScanOnDemandExpiresAt ?? null,
        memeCoinsTraderOnDemand: !!(u as { memeCoinsTraderOnDemand?: boolean }).memeCoinsTraderOnDemand,
        memeCoinsTraderOnDemandExpiresAt: (u as { memeCoinsTraderOnDemandExpiresAt?: Date | null }).memeCoinsTraderOnDemandExpiresAt ?? null,
        newsletterOptIn: !!(u as { newsletterOptIn?: boolean }).newsletterOptIn,
        novaConnectEnabled: !!(u as { novaConnectEnabled?: boolean }).novaConnectEnabled,
        novaConnectRulesAcceptedAt: (u as { novaConnectRulesAcceptedAt?: Date | null }).novaConnectRulesAcceptedAt ?? null,
        novaConnectCommunityRep: !!(u as { novaConnectCommunityRep?: boolean }).novaConnectCommunityRep,
        novaConnectAllowedByAdmin: !!(u as { novaConnectAllowedByAdmin?: boolean }).novaConnectAllowedByAdmin,
        coachUser: !!(u as { coachUser?: boolean }).coachUser,
        customersViewerAdmin: !!(u as { customersViewerAdmin?: boolean }).customersViewerAdmin,
        supportViewerAdmin: !!(u as { supportViewerAdmin?: boolean }).supportViewerAdmin,
        liveChatAgentAdmin: !!(u as { liveChatAgentAdmin?: boolean }).liveChatAgentAdmin,
        supportStaffName: (u as { supportStaffName?: string | null }).supportStaffName ?? null,
        aiAgentDailyLimitOverride: (u as { aiAgentDailyLimitOverride?: number | null }).aiAgentDailyLimitOverride ?? null,
        aiAgentWeeklyLimitOverride: (u as { aiAgentWeeklyLimitOverride?: number | null }).aiAgentWeeklyLimitOverride ?? null,
        aiAgentMonthlyLimitOverride: (u as { aiAgentMonthlyLimitOverride?: number | null }).aiAgentMonthlyLimitOverride ?? null,
        aiChartAnalysisDailyLimitOverride: (u as { aiChartAnalysisDailyLimitOverride?: number | null }).aiChartAnalysisDailyLimitOverride ?? null,
        aiChartAnalysisWeeklyLimitOverride: (u as { aiChartAnalysisWeeklyLimitOverride?: number | null }).aiChartAnalysisWeeklyLimitOverride ?? null,
        aiChartAnalysisMonthlyLimitOverride: (u as { aiChartAnalysisMonthlyLimitOverride?: number | null }).aiChartAnalysisMonthlyLimitOverride ?? null,
        paymentTermsAcceptedAt: (u as { paymentTermsAcceptedAt?: Date | null }).paymentTermsAcceptedAt ?? null,
        twoFactorMethod: (u as { twoFactorMethod?: string | null }).twoFactorMethod ?? null,
        createdAt: u.createdAt,
        subscriptionTier: subTier,
        subscriptionPlan: subPlan,
        subscriptionExpiresAt: activeSub ? activeSub.expiresAt : latestSub?.expiresAt ?? null,
        isActive: !!activeSub,
        subscriptionAutoRenew: !!(activeSub?.autoRenew ?? stripeSub?.autoRenew),
        subscriptionCancelAtPeriodEnd: !!(activeSub?.cancelAtPeriodEnd ?? stripeSub?.cancelAtPeriodEnd),
        hasStripeSubscription: !!(activeSub?.stripeSubscriptionId ?? stripeSub?.stripeSubscriptionId),
        stripeSubscriptionActive: !!activeSub?.stripeSubscriptionId,
        payments,
      };
      if (readOnly) {
        return {
          ...row,
          email: null,
          phone: null,
          country: null,
          experienceTradingCrypto: null,
          newsletterOptIn: false,
          novaConnectEnabled: false,
          novaConnectRulesAcceptedAt: null,
          novaConnectCommunityRep: false,
          novaConnectAllowedByAdmin: false,
          coachUser: false,
          customersViewerAdmin: false,
          supportViewerAdmin: false,
          liveChatAgentAdmin: false,
          supportStaffName: null,
          aiAgentDailyLimitOverride: null,
          aiAgentWeeklyLimitOverride: null,
          aiAgentMonthlyLimitOverride: null,
          aiChartAnalysisDailyLimitOverride: null,
          aiChartAnalysisWeeklyLimitOverride: null,
          aiChartAnalysisMonthlyLimitOverride: null,
          paymentTermsAcceptedAt: null,
          twoFactorMethod: null,
          payments: [],
        };
      }
      return row;
    });

    return NextResponse.json({ success: true, customers, readOnly });
  } catch (e) {
    console.error('Admin customers error:', e);
    return NextResponse.json({ success: false, error: 'Failed to load customers.' }, { status: 500 });
  }
}
