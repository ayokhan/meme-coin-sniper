/**
 * Shared wallet-tracker logic: compute alerts (minBuyers+ tracked wallets bought same token).
 * Owner-only: first-buy alerts (notify once per wallet+token).
 */
import { prisma } from '@/lib/db';
import { getTrackedWallets, getAlertRules, getFirstBuyRules } from '@/lib/wallet-tracker-config';
import { getRecentTokenBuysForWallet } from '@/lib/api-clients/helius';
import { getWalletTokenBuysFromBirdeye } from '@/lib/api-clients/birdeye';
import { getWalletBuySwapsFromMoralis } from '@/lib/api-clients/moralis';
import { getSolanaToken } from '@/lib/api-clients/dexscreener';
import { getFeatureFlag, FEATURE_FLAG_KEYS } from '@/lib/feature-flags';

const LIMIT_PER_WALLET = 30;

/** Get recent buys – Moralis first (if enabled), then Helius, then Birdeye. */
async function getBuysForWallet(
  address: string,
  limit: number,
  maxAgeMs: number,
  useMoralis: boolean
) {
  if (useMoralis) {
    const moralis = await getWalletBuySwapsFromMoralis(address, limit, maxAgeMs);
    if (moralis.length > 0) return moralis;
  }
  const helius = await getRecentTokenBuysForWallet(address, limit, maxAgeMs);
  if (helius.length > 0) return helius;
  return getWalletTokenBuysFromBirdeye(address, limit, maxAgeMs);
}

export type WalletAlert = {
  contractAddress: string;
  symbol: string;
  name: string;
  buyerCount: number;
  buyers: Array<{ address: string; label?: string }>;
  liquidity?: number | null;
  priceUSD?: number | null;
  /** Latest buy timestamp (ms) among the tracked wallets for this token */
  latestBuyAt?: number | null;
};

export async function getWalletAlerts(): Promise<WalletAlert[]> {
  const [trackedWallets, rules, moralisWalletTracker] = await Promise.all([
    getTrackedWallets(),
    getAlertRules(),
    getFeatureFlag(FEATURE_FLAG_KEYS.MORALIS_WALLET_TRACKER),
  ]);
  if (trackedWallets.length === 0) return [];

  const hasMoralis = moralisWalletTracker && Boolean(process.env.MORALIS_API_KEY);
  const hasHelius = Boolean(process.env.HELIUS_API_KEY);
  const hasBirdeye = Boolean(process.env.BIRDEYE_API_KEY);
  if (!hasMoralis && !hasHelius && !hasBirdeye) return [];

  const MAX_AGE_MS = rules.maxAgeHours * 60 * 60 * 1000;
  const mintToWallets: Record<string, Set<string>> = {};
  const mintToLatestBuy: Record<string, number> = {};
  for (const w of trackedWallets) {
    const buys = await getBuysForWallet(w.address, LIMIT_PER_WALLET, MAX_AGE_MS, hasMoralis);
    for (const b of buys) {
      if (!mintToWallets[b.mint]) mintToWallets[b.mint] = new Set();
      mintToWallets[b.mint].add(w.address);
      const ts = b.timestamp ?? 0;
      if (ts) mintToLatestBuy[b.mint] = Math.max(mintToLatestBuy[b.mint] ?? 0, ts);
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  const alertMints = Object.entries(mintToWallets)
    .filter(([, wallets]) => wallets.size >= rules.minBuyers)
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, rules.maxAlerts);

  const alerts: WalletAlert[] = [];
  for (const [mint, walletSet] of alertMints) {
    const buyers = Array.from(walletSet).map((addr) => {
      const w = trackedWallets.find((x) => x.address === addr);
      return { address: addr, label: w?.label ?? undefined };
    });
    const dex = await getSolanaToken(mint);
    alerts.push({
      contractAddress: mint,
      symbol: dex?.baseToken?.symbol ?? '—',
      name: dex?.baseToken?.name ?? '—',
      buyerCount: buyers.length,
      buyers,
      liquidity: dex?.liquidity?.usd ?? null,
      priceUSD: dex?.priceUsd ? parseFloat(dex.priceUsd) : null,
      latestBuyAt: mintToLatestBuy[mint] ?? null,
    });
    await new Promise((r) => setTimeout(r, 150));
  }

  return alerts;
}

/** Owner-only: first time a tracked wallet bought a token (one alert per wallet+token ever). */
export type FirstBuyAlert = {
  walletAddress: string;
  walletLabel?: string;
  contractAddress: string;
  symbol: string;
  name: string;
  liquidity?: number | null;
  priceUSD?: number | null;
  firstBuyAt: number;
};

export async function getFirstBuyAlerts(): Promise<FirstBuyAlert[]> {
  const [allWallets, rules, moralisWalletTracker] = await Promise.all([
    getTrackedWallets(),
    getFirstBuyRules(),
    getFeatureFlag(FEATURE_FLAG_KEYS.MORALIS_WALLET_TRACKER),
  ]);
  // Only wallets with firstBuyEnabled get first-buy alerts (default true when not set)
  const trackedWallets = allWallets.filter((w) => w.firstBuyEnabled !== false);
  if (trackedWallets.length === 0) return [];

  const hasMoralis = moralisWalletTracker && Boolean(process.env.MORALIS_API_KEY);
  const hasHelius = Boolean(process.env.HELIUS_API_KEY);
  const hasBirdeye = Boolean(process.env.BIRDEYE_API_KEY);
  if (!hasMoralis && !hasHelius && !hasBirdeye) return [];

  const lookbackMs = rules.lookbackHours * 60 * 60 * 1000;
  const sentSet = new Set<string>();
  const db = prisma as unknown as {
    walletFirstBuyAlertSent?: {
      findMany: (args: { select: { walletAddress: true; contractAddress: true } }) => Promise<Array<{ walletAddress: string; contractAddress: string }>>;
    };
  };
  if (db.walletFirstBuyAlertSent) {
    const rows = await db.walletFirstBuyAlertSent.findMany({
      select: { walletAddress: true, contractAddress: true },
    });
    rows.forEach((r) => sentSet.add(`${r.walletAddress}:${r.contractAddress}`));
  }

  const candidates: Array<{ walletAddress: string; walletLabel?: string; contractAddress: string; firstBuyAt: number }> = [];
  for (const w of trackedWallets) {
    const buys = await getBuysForWallet(w.address, LIMIT_PER_WALLET, lookbackMs, hasMoralis);
    for (const b of buys) {
      const key = `${w.address}:${b.mint}`;
      if (sentSet.has(key)) continue;
      sentSet.add(key);
      candidates.push({
        walletAddress: w.address,
        walletLabel: w.label ?? undefined,
        contractAddress: b.mint,
        firstBuyAt: b.timestamp ?? Date.now(),
      });
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  candidates.sort((a, b) => b.firstBuyAt - a.firstBuyAt);
  const toReturn = candidates.slice(0, rules.maxAlerts);
  const alerts: FirstBuyAlert[] = [];
  for (const c of toReturn) {
    const dex = await getSolanaToken(c.contractAddress);
    alerts.push({
      walletAddress: c.walletAddress,
      walletLabel: c.walletLabel,
      contractAddress: c.contractAddress,
      symbol: dex?.baseToken?.symbol ?? '—',
      name: dex?.baseToken?.name ?? '—',
      liquidity: dex?.liquidity?.usd ?? null,
      priceUSD: dex?.priceUsd ? parseFloat(dex.priceUsd) : null,
      firstBuyAt: c.firstBuyAt,
    });
    await new Promise((r) => setTimeout(r, 150));
  }
  return alerts;
}
