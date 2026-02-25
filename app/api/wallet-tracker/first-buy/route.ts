import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isOwnerSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getTrackedWallets, getFirstBuyRules } from '@/lib/wallet-tracker-config';
import { getFeatureFlag, FEATURE_FLAG_KEYS } from '@/lib/feature-flags';
import { getSolanaToken } from '@/lib/api-clients/dexscreener';

export const dynamic = 'force-dynamic';

/** Owner-only: recent first-buy alerts (in-app list) and feature state. */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerSession(session)) {
      return NextResponse.json({ success: false, error: 'Owner only.', firstBuyEnabled: false, recentAlerts: [] }, { status: 403 });
    }

    const [firstBuyEnabled, rules, trackedWallets] = await Promise.all([
      getFeatureFlag(FEATURE_FLAG_KEYS.OWNER_FIRST_BUY_ALERTS),
      getFirstBuyRules(),
      getTrackedWallets(),
    ]);

    const labelByAddress = new Map(trackedWallets.map((w) => [w.address, w.label ?? null]));

    const db = prisma as unknown as {
      walletFirstBuyAlertSent?: {
        findMany: (args: {
          where: { sentAt: { gte: Date } };
          orderBy: { sentAt: 'desc' };
          take: number;
          select: { walletAddress: true; contractAddress: true; sentAt: true };
        }) => Promise<Array<{ walletAddress: string; contractAddress: string; sentAt: Date }>>;
      };
    };

    const recentAlerts: Array<{
      walletAddress: string;
      walletLabel?: string | null;
      contractAddress: string;
      symbol: string;
      name: string;
      liquidity?: number | null;
      priceUSD?: number | null;
      sentAt: string;
    }> = [];

    if (db.walletFirstBuyAlertSent) {
      const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
      const rows = await db.walletFirstBuyAlertSent.findMany({
        where: { sentAt: { gte: since } },
        orderBy: { sentAt: 'desc' },
        take: 50,
        select: { walletAddress: true, contractAddress: true, sentAt: true },
      });
      for (const r of rows) {
        const dex = await getSolanaToken(r.contractAddress);
        recentAlerts.push({
          walletAddress: r.walletAddress,
          walletLabel: labelByAddress.get(r.walletAddress) ?? null,
          contractAddress: r.contractAddress,
          symbol: dex?.baseToken?.symbol ?? '—',
          name: dex?.baseToken?.name ?? '—',
          liquidity: dex?.liquidity?.usd ?? null,
          priceUSD: dex?.priceUsd ? parseFloat(dex.priceUsd) : null,
          sentAt: r.sentAt.toISOString(),
        });
        await new Promise((x) => setTimeout(x, 80));
      }
    }

    return NextResponse.json({
      success: true,
      firstBuyEnabled,
      rules: { lookbackMinutes: rules.lookbackMinutes, maxAlerts: rules.maxAlerts },
      recentAlerts,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed';
    return NextResponse.json({ success: false, error: message, firstBuyEnabled: false, recentAlerts: [] }, { status: 500 });
  }
}
