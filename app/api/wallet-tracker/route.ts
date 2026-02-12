import { NextResponse } from 'next/server';
import { getTrackedWallets, getAlertRules } from '@/lib/wallet-tracker-config';
import { getSessionAndSubscription } from '@/lib/auth-server';
import { getWalletAlerts, type WalletAlert } from '@/lib/get-wallet-alerts';
import { getFeatureFlag, FEATURE_FLAG_KEYS } from '@/lib/feature-flags';

export type { WalletAlert };

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { tier } = await getSessionAndSubscription();
    if (tier !== 'vip') {
      return NextResponse.json({ success: false, error: 'VIP subscription required for Copy wallet / Wallet Tracker.', locked: true }, { status: 403 });
    }
    const [trackedWallets, rules, liveTradesEnabled] = await Promise.all([
      getTrackedWallets(),
      getAlertRules(),
      getFeatureFlag(FEATURE_FLAG_KEYS.LIVE_TRADES_ENABLED),
    ]);
    if (trackedWallets.length === 0) {
      return NextResponse.json({
        success: true,
        alerts: [],
        minBuyers: rules.minBuyers,
        liveTradesEnabled,
        message: 'Wallet tracker is not configured yet.',
      });
    }

    const alerts = await getWalletAlerts();

    return NextResponse.json({
      success: true,
      alerts,
      minBuyers: rules.minBuyers,
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
