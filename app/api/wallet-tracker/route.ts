import { NextResponse } from 'next/server';
import { getTrackedWallets, getAlertRules } from '@/lib/wallet-tracker-config';
import { getSessionAndSubscription } from '@/lib/auth-server';
import { getWalletAlerts, type WalletAlert } from '@/lib/get-wallet-alerts';

export type { WalletAlert };

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { isPaid } = await getSessionAndSubscription();
    if (!isPaid) {
      return NextResponse.json({ success: false, error: 'Subscribe to access Wallet Tracker.', locked: true }, { status: 403 });
    }
    const [trackedWallets, rules] = await Promise.all([getTrackedWallets(), getAlertRules()]);
    if (trackedWallets.length === 0) {
      return NextResponse.json({
        success: true,
        alerts: [],
        minBuyers: rules.minBuyers,
        message: 'Wallet tracker is not configured yet.',
      });
    }

    const alerts = await getWalletAlerts();

    return NextResponse.json({
      success: true,
      alerts,
      minBuyers: rules.minBuyers,
      walletsTracked: trackedWallets.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, alerts: [], error: error.message },
      { status: 500 }
    );
  }
}
