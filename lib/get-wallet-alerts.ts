/**
 * Shared wallet-tracker logic: compute alerts (minBuyers+ tracked wallets bought same token).
 * Used by GET /api/wallet-tracker and by cron notify (Telegram).
 * Rules (minBuyers, maxAgeHours, maxAlerts) are configurable via admin.
 */
import { getTrackedWallets, getAlertRules } from '@/lib/wallet-tracker-config';
import { getRecentTokenBuysForWallet } from '@/lib/api-clients/helius';
import { getSolanaToken } from '@/lib/api-clients/dexscreener';

const LIMIT_PER_WALLET = 30;

export type WalletAlert = {
  contractAddress: string;
  symbol: string;
  name: string;
  buyerCount: number;
  buyers: Array<{ address: string; label?: string }>;
  liquidity?: number | null;
  priceUSD?: number | null;
};

export async function getWalletAlerts(): Promise<WalletAlert[]> {
  const [trackedWallets, rules] = await Promise.all([getTrackedWallets(), getAlertRules()]);
  if (trackedWallets.length === 0) return [];

  const apiKey = process.env.HELIUS_API_KEY;
  if (!apiKey) return [];

  const MAX_AGE_MS = rules.maxAgeHours * 60 * 60 * 1000;
  const mintToWallets: Record<string, Set<string>> = {};
  for (const w of trackedWallets) {
    const buys = await getRecentTokenBuysForWallet(w.address, LIMIT_PER_WALLET, MAX_AGE_MS);
    for (const b of buys) {
      if (!mintToWallets[b.mint]) mintToWallets[b.mint] = new Set();
      mintToWallets[b.mint].add(w.address);
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
      return { address: addr, label: w?.label };
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
    });
    await new Promise((r) => setTimeout(r, 150));
  }

  return alerts;
}
