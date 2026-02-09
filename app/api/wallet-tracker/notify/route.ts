import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getWalletAlerts } from '@/lib/get-wallet-alerts';
import { getAlertRules } from '@/lib/wallet-tracker-config';
import { sendWalletAlerts } from '@/lib/telegram';

/**
 * Cron-only: run wallet-tracker logic and send NEW alerts to Telegram.
 * Uses your configured rules (minBuyers, maxAgeHours, maxAlerts). Cooldown = maxAgeHours so we don't re-send same token within your alert window.
 * Call with Authorization: Bearer CRON_SECRET. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in Vercel.
 */
export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [alerts, rules] = await Promise.all([getWalletAlerts(), getAlertRules()]);
    if (alerts.length === 0) {
      return NextResponse.json({ success: true, sent: 0 });
    }

    const cooldownHours = rules.maxAgeHours;
    const db = prisma as unknown as {
      walletAlertSent?: {
        findMany: (args: { where: { sentAt: { gte: Date } }; select: { contractAddress: true } }) => Promise<{ contractAddress: string }[]>;
        createMany: (args: { data: { contractAddress: string }[] }) => Promise<unknown>;
        deleteMany: (args: { where: { sentAt: { lt: Date } } }) => Promise<unknown>;
      };
    };

    let toSend = alerts;
    if (db.walletAlertSent) {
      const since = new Date(Date.now() - cooldownHours * 60 * 60 * 1000);
      const recent = await db.walletAlertSent.findMany({
        where: { sentAt: { gte: since } },
        select: { contractAddress: true },
      });
      const sentSet = new Set(recent.map((r) => r.contractAddress));
      toSend = alerts.filter((a) => !sentSet.has(a.contractAddress));
    }

    if (toSend.length > 0) {
      await sendWalletAlerts(toSend, rules.minBuyers);
      if (db.walletAlertSent) {
        await db.walletAlertSent.createMany({
          data: toSend.map((a) => ({ contractAddress: a.contractAddress })),
        });
        const pruneBefore = new Date(Date.now() - (cooldownHours * 2 + 24) * 60 * 60 * 1000);
        await db.walletAlertSent.deleteMany({ where: { sentAt: { lt: pruneBefore } } });
      }
    }

    return NextResponse.json({
      success: true,
      sent: toSend.length,
      total: alerts.length,
    });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message ?? 'Failed' },
      { status: 500 }
    );
  }
}
