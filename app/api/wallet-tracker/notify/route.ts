import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getWalletAlerts, getFirstBuyAlerts } from '@/lib/get-wallet-alerts';
import { getAlertRules } from '@/lib/wallet-tracker-config';
import { sendWalletAlerts, sendFirstBuyAlerts } from '@/lib/telegram';
import { getFeatureFlag, FEATURE_FLAG_KEYS } from '@/lib/feature-flags';

/**
 * Cron-only: run wallet-tracker logic and send NEW alerts to Telegram.
 * 1) minBuyers+ wallets bought same token (cooldown by token).
 * 2) Owner-only first-buy: first time a tracked wallet buys a token (one alert per wallet+token ever).
 * Call with Authorization: Bearer CRON_SECRET.
 */
export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const telegramEnabled = await getFeatureFlag(FEATURE_FLAG_KEYS.TELEGRAM_WALLET_ALERTS);
    const firstBuyEnabled = await getFeatureFlag(FEATURE_FLAG_KEYS.OWNER_FIRST_BUY_ALERTS);

    let sent = 0;
    let firstBuySent = 0;

    if (telegramEnabled) {
      const [alerts, rules] = await Promise.all([getWalletAlerts(), getAlertRules()]);
      const db = prisma as unknown as {
        walletAlertSent?: {
          findMany: (args: { where: { sentAt: { gte: Date } }; select: { contractAddress: true } }) => Promise<{ contractAddress: string }[]>;
          createMany: (args: { data: { contractAddress: string }[] }) => Promise<unknown>;
          deleteMany: (args: { where: { sentAt: { lt: Date } } }) => Promise<unknown>;
        };
      };
      const cooldownHours = rules.maxAgeHours;
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
        sent = toSend.length;
      }
    }

    if (firstBuyEnabled && telegramEnabled) {
      const firstBuyAlerts = await getFirstBuyAlerts();
      if (firstBuyAlerts.length > 0) {
        await sendFirstBuyAlerts(firstBuyAlerts);
        const db = prisma as unknown as {
          walletFirstBuyAlertSent?: {
            createMany: (args: { data: Array<{ walletAddress: string; contractAddress: string }> }) => Promise<unknown>;
          };
        };
        if (db.walletFirstBuyAlertSent) {
          await db.walletFirstBuyAlertSent.createMany({
            data: firstBuyAlerts.map((a) => ({ walletAddress: a.walletAddress, contractAddress: a.contractAddress })),
          });
        }
        firstBuySent = firstBuyAlerts.length;
      }
    }

    return NextResponse.json({
      success: true,
      sent,
      firstBuySent,
    });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message ?? 'Failed' },
      { status: 500 }
    );
  }
}
