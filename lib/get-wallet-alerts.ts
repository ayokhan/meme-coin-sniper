/**
 * Shared wallet-tracker logic: compute alerts (3+ tracked wallets bought same token).
 * Used by GET /api/wallet-tracker and by cron notify (Telegram).
 */
import { TRACKED_WALLETS } from '@/lib/config/ct-wallets';
import { getRecentTokenBuysForWallet } from '@/lib/api-clients/helius';
import { getSolanaToken } from '@/lib/api-clients/dexscreener';

const MIN_BUYERS = 3;
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h
const LIMIT_PER_WALLET = 30;
const MAX_ALERTS = 30;

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
  if (TRACKED_WALLETS.length === 0) return [];

  const apiKey = process.env.HELIUS_API_KEY;
  if (!apiKey) return [];

  const mintToWallets: Record<string, Set<string>> = {};
  for (const w of TRACKED_WALLETS) {
    const buys = await getRecentTokenBuysForWallet(w.address, LIMIT_PER_WALLET, MAX_AGE_MS);
    for (const b of buys) {
      if (!mintToWallets[b.mint]) mintToWallets[b.mint] = new Set();
      mintToWallets[b.mint].add(w.address);
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  const alertMints = Object.entries(mintToWallets)
    .filter(([, wallets]) => wallets.size >= MIN_BUYERS)
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, MAX_ALERTS);

  const alerts: WalletAlert[] = [];
  for (const [mint, walletSet] of alertMints) {
    const buyers = Array.from(walletSet).map((addr) => {
      const w = TRACKED_WALLETS.find((x) => x.address === addr);
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
