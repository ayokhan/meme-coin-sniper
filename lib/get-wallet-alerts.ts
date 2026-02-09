/**
 * Shared wallet-tracker logic: compute alerts (minBuyers+ tracked wallets bought same token).
 * Used by GET /api/wallet-tracker and by cron notify (Telegram).
 * Rules (minBuyers, maxAgeHours, maxAlerts) are configurable via admin.
 */
import { getTrackedWallets, getAlertRules } from '@/lib/wallet-tracker-config';
import { getRecentTokenBuysForWallet } from '@/lib/api-clients/helius';
import { getWalletTokenBuysFromBirdeye } from '@/lib/api-clients/birdeye';
import { getWalletBuySwapsFromMoralis } from '@/lib/api-clients/moralis';
import { getSolanaToken } from '@/lib/api-clients/dexscreener';

const LIMIT_PER_WALLET = 30;

/** Get recent buys – Moralis first, then Helius, then Birdeye. */
async function getBuysForWallet(address: string, limit: number, maxAgeMs: number) {
  const moralis = await getWalletBuySwapsFromMoralis(address, limit, maxAgeMs);
  if (moralis.length > 0) return moralis;
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
  const [trackedWallets, rules] = await Promise.all([getTrackedWallets(), getAlertRules()]);
  if (trackedWallets.length === 0) return [];

  const hasMoralis = Boolean(process.env.MORALIS_API_KEY);
  const hasHelius = Boolean(process.env.HELIUS_API_KEY);
  const hasBirdeye = Boolean(process.env.BIRDEYE_API_KEY);
  if (!hasMoralis && !hasHelius && !hasBirdeye) return [];

  const MAX_AGE_MS = rules.maxAgeHours * 60 * 60 * 1000;
  const mintToWallets: Record<string, Set<string>> = {};
  const mintToLatestBuy: Record<string, number> = {};
  for (const w of trackedWallets) {
    const buys = await getBuysForWallet(w.address, LIMIT_PER_WALLET, MAX_AGE_MS);
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
