import { NextResponse } from 'next/server';
import { getWalletAlerts } from '@/lib/get-wallet-alerts';
import { sendWalletAlerts } from '@/lib/telegram';

/**
 * Cron-only: run wallet-tracker logic and send alerts to Telegram.
 * Call with Authorization: Bearer CRON_SECRET.
 */
export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const alerts = await getWalletAlerts();
    await sendWalletAlerts(alerts);
    return NextResponse.json({
      success: true,
      sent: alerts.length,
    });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message ?? 'Failed' },
      { status: 500 }
    );
  }
}
