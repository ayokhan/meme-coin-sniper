import { NextResponse } from 'next/server';
import { TRACKED_WALLETS } from '@/lib/config/ct-wallets';
import { getSessionAndSubscription } from '@/lib/auth-server';
import { getWalletAlerts, type WalletAlert } from '@/lib/get-wallet-alerts';

export type { WalletAlert };

export async function GET() {
  try {
    const { isPaid } = await getSessionAndSubscription();
    if (!isPaid) {
      return NextResponse.json({ success: false, error: 'Subscribe to access Wallet Tracker.', locked: true }, { status: 403 });
    }
    if (TRACKED_WALLETS.length === 0) {
      return NextResponse.json({
        success: true,
        alerts: [],
        message: 'Wallet tracker is not configured yet.',
      });
    }

    const alerts = await getWalletAlerts();

    return NextResponse.json({
      success: true,
      alerts,
      walletsTracked: TRACKED_WALLETS.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, alerts: [], error: error.message },
      { status: 500 }
    );
  }
}
