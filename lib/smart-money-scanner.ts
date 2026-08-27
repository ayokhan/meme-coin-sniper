/**
 * Smart Money Alerts scanner — sized buys, hold, still-holding, sold.
 * In-app only. Caps wallet count to control Helius CU.
 */

import { prisma } from "@/lib/db";
import { getRecentSizedTokenBuysForWallet } from "@/lib/api-clients/helius";
import { getWalletHoldings } from "@/lib/api-clients/helius-wallet-pnl";
import { getSolUsdPrice } from "@/lib/api-clients/dexscreener-prices";

const CONFIG_ID = "default";

type PrismaExt = typeof prisma & {
  smartMoneyWallet?: {
    findMany: (a: object) => Promise<Array<{ address: string; label: string | null; active: boolean }>>;
  };
  smartMoneyConfig?: {
    findUnique: (a: { where: { id: string } }) => Promise<{
      buyAlertUsd: number;
      bigBuyAlertUsd: number;
      holdAlertMinutes: number;
      maxWallets: number;
    } | null>;
  };
  smartMoneyPosition?: {
    findMany: (a: object) => Promise<Array<{
      id: string;
      walletAddress: string;
      mint: string;
      symbol: string | null;
      buyUsd: number | null;
      buyAt: Date;
      status: string;
      heldOver5mSent: boolean;
      stillHoldingSent: boolean;
    }>>;
    upsert: (a: object) => Promise<unknown>;
    update: (a: object) => Promise<unknown>;
  };
  smartMoneyAlert?: {
    createMany: (a: { data: object[]; skipDuplicates?: boolean }) => Promise<{ count: number }>;
  };
};

function db() {
  return prisma as unknown as PrismaExt;
}

export type SmartMoneyScanResult = {
  walletsScanned: number;
  alertsCreated: number;
  solUsd: number;
};

async function getConfig() {
  const row = await db().smartMoneyConfig?.findUnique({ where: { id: CONFIG_ID } });
  return {
    buyAlertUsd: row?.buyAlertUsd ?? 2000,
    bigBuyAlertUsd: row?.bigBuyAlertUsd ?? 10000,
    holdAlertMinutes: row?.holdAlertMinutes ?? 5,
    maxWallets: row?.maxWallets ?? 20,
  };
}

async function upsertAlert(row: {
  dedupeKey: string;
  type: string;
  walletAddress: string;
  walletLabel?: string | null;
  mint: string;
  symbol?: string | null;
  buyUsd?: number | null;
  buyAt?: Date | null;
  soldAt?: Date | null;
  heldMinutes?: number | null;
  signature?: string | null;
}) {
  const alertDb = db().smartMoneyAlert;
  if (!alertDb) return;
  try {
    await alertDb.createMany({
      data: [row],
      skipDuplicates: true,
    });
  } catch {
    /* unique race */
  }
}

/** Run a full scan of active Smart Money wallets. */
export async function runSmartMoneyScan(): Promise<SmartMoneyScanResult> {
  const walletDb = db().smartMoneyWallet;
  const posDb = db().smartMoneyPosition;
  if (!walletDb || !posDb) {
    return { walletsScanned: 0, alertsCreated: 0, solUsd: 0 };
  }

  const config = await getConfig();
  const wallets = (await walletDb.findMany({
    where: { active: true },
    orderBy: { createdAt: "asc" },
    take: config.maxWallets,
  } as object)) as Array<{ address: string; label: string | null }>;

  const solUsd = await getSolUsdPrice();
  let alertsCreated = 0;
  const now = Date.now();

  for (const w of wallets) {
    const buys = await getRecentSizedTokenBuysForWallet(w.address, 30, 48 * 60 * 60 * 1000);
    const holdings = await getWalletHoldings(w.address);
    const heldMints = new Set(holdings.map((h) => h.mint));

    for (const buy of buys) {
      const buyUsd = buy.solSpent > 0 && solUsd > 0 ? buy.solSpent * solUsd : null;
      if (buyUsd == null || buyUsd < config.buyAlertUsd) continue;

      const buyAt = new Date(buy.timestamp);
      const sig = buy.signature ?? `${buy.timestamp}`;

      if (buyUsd >= config.bigBuyAlertUsd) {
        await upsertAlert({
          dedupeKey: `buy_10k:${w.address}:${buy.mint}:${sig}`,
          type: "buy_10k",
          walletAddress: w.address,
          walletLabel: w.label,
          mint: buy.mint,
          buyUsd,
          buyAt,
          signature: buy.signature ?? null,
        });
        alertsCreated += 1;
      } else {
        await upsertAlert({
          dedupeKey: `buy_2k:${w.address}:${buy.mint}:${sig}`,
          type: "buy_2k",
          walletAddress: w.address,
          walletLabel: w.label,
          mint: buy.mint,
          buyUsd,
          buyAt,
          signature: buy.signature ?? null,
        });
        alertsCreated += 1;
      }

      await posDb.upsert({
        where: { walletAddress_mint: { walletAddress: w.address, mint: buy.mint } },
        create: {
          walletAddress: w.address,
          mint: buy.mint,
          buyUsd,
          buyAt,
          status: heldMints.has(buy.mint) ? "holding" : "sold",
          soldAt: heldMints.has(buy.mint) ? null : new Date(),
        },
        update: {
          buyUsd,
          buyAt,
          lastCheckedAt: new Date(),
          ...(heldMints.has(buy.mint)
            ? { status: "holding", soldAt: null }
            : {}),
        },
      });
    }

    const openPositions = (await posDb.findMany({
      where: { walletAddress: w.address, status: "holding" },
    } as object)) as Array<{
      id: string;
      walletAddress: string;
      mint: string;
      symbol: string | null;
      buyUsd: number | null;
      buyAt: Date;
      heldOver5mSent: boolean;
      stillHoldingSent: boolean;
    }>;

    for (const pos of openPositions) {
      const stillHeld = heldMints.has(pos.mint);
      const heldMs = now - pos.buyAt.getTime();
      const heldMinutes = heldMs / 60_000;

      if (!stillHeld) {
        await posDb.update({
          where: { id: pos.id },
          data: { status: "sold", soldAt: new Date(), lastCheckedAt: new Date() },
        });
        await upsertAlert({
          dedupeKey: `sold:${pos.walletAddress}:${pos.mint}`,
          type: "sold",
          walletAddress: pos.walletAddress,
          walletLabel: w.label,
          mint: pos.mint,
          symbol: pos.symbol,
          buyUsd: pos.buyUsd,
          buyAt: pos.buyAt,
          soldAt: new Date(),
          heldMinutes,
        });
        alertsCreated += 1;
        continue;
      }

      await posDb.update({
        where: { id: pos.id },
        data: { lastCheckedAt: new Date() },
      });

      if (heldMinutes >= config.holdAlertMinutes && !pos.heldOver5mSent) {
        await upsertAlert({
          dedupeKey: `held_over_5m:${pos.walletAddress}:${pos.mint}`,
          type: "held_over_5m",
          walletAddress: pos.walletAddress,
          walletLabel: w.label,
          mint: pos.mint,
          symbol: pos.symbol,
          buyUsd: pos.buyUsd,
          buyAt: pos.buyAt,
          heldMinutes,
        });
        await posDb.update({
          where: { id: pos.id },
          data: { heldOver5mSent: true },
        });
        alertsCreated += 1;
      }

      // Re-surface still-holding once after 30+ minutes
      if (heldMinutes >= 30 && !pos.stillHoldingSent) {
        await upsertAlert({
          dedupeKey: `still_holding:${pos.walletAddress}:${pos.mint}`,
          type: "still_holding",
          walletAddress: pos.walletAddress,
          walletLabel: w.label,
          mint: pos.mint,
          symbol: pos.symbol,
          buyUsd: pos.buyUsd,
          buyAt: pos.buyAt,
          heldMinutes,
        });
        await posDb.update({
          where: { id: pos.id },
          data: { stillHoldingSent: true },
        });
        alertsCreated += 1;
      }
    }
  }

  return { walletsScanned: wallets.length, alertsCreated, solUsd };
}
