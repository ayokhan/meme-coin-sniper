import { NextResponse } from 'next/server';
import { getTrackedWallets, getAlertRules } from '@/lib/wallet-tracker-config';
import { getSessionAndSubscription } from '@/lib/auth-server';
import { getWalletAlerts, type WalletAlert } from '@/lib/get-wallet-alerts';
import { getFeatureFlag, FEATURE_FLAG_KEYS } from '@/lib/feature-flags';

export type { WalletAlert };

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { tier, userId } = await getSessionAndSubscription();
    if (tier !== 'vip') {
      return NextResponse.json({ success: false, error: 'VIP subscription required for Profitable Traders Wallet Tracker.', locked: true }, { status: 403 });
    }
    const [trackedWallets, rules, liveTradesEnabled, user] = await Promise.all([
      getTrackedWallets(),
      getAlertRules(),
      getFeatureFlag(FEATURE_FLAG_KEYS.LIVE_TRADES_ENABLED),
      userId ? import('@/lib/db').then(({ prisma }) => prisma.user.findUnique({ where: { id: userId }, select: { walletTrackerMinBuyers: true } })) : Promise.resolve(null),
    ]);
    const effectiveMinBuyers = user?.walletTrackerMinBuyers ?? rules.minBuyers;
    if (trackedWallets.length === 0) {
      return NextResponse.json({
        success: true,
        alerts: [],
        minBuyers: effectiveMinBuyers,
        userMinBuyers: user?.walletTrackerMinBuyers ?? null,
        liveTradesEnabled,
        message: 'Wallet tracker is not configured yet.',
      });
    }

    const alerts = await getWalletAlerts(effectiveMinBuyers);

    return NextResponse.json({
      success: true,
      alerts,
      minBuyers: effectiveMinBuyers,
      userMinBuyers: user?.walletTrackerMinBuyers ?? null,
      liveTradesEnabled,
      walletsTracked: trackedWallets.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, alerts: [], error: error.message },
      { status: 500 }
    );
  }
}
