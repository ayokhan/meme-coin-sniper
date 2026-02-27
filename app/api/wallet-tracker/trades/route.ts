import { NextResponse } from 'next/server';
import { getTrackedWallets, getAlertRules } from '@/lib/wallet-tracker-config';

export const dynamic = 'force-dynamic';
import { getSessionAndSubscription } from '@/lib/auth-server';
import { getRecentTokenBuysForWallet } from '@/lib/api-clients/helius';
import { getWalletTokenBuysFromBirdeye } from '@/lib/api-clients/birdeye';
import { getWalletBuySwapsFromMoralis } from '@/lib/api-clients/moralis';
import { getSolanaToken } from '@/lib/api-clients/dexscreener';
import { getFeatureFlag, FEATURE_FLAG_KEYS } from '@/lib/feature-flags';
const BUYS_PER_WALLET = 15;
const MAX_TRADES_TOTAL = 80;

export type WalletTrade = {
  walletLabel: string;
  walletAddress: string;
  mint: string;
  symbol: string;
  name: string;
  timestamp: number;
  signature: string | null;
  txUrl: string;
  dexUrl: string;
};

type WalletBuy = { mint: string; timestamp: number; signature?: string };

/** Get recent buys: Moralis first when available (restores previous working behavior), then Helius, then Birdeye. Merge fallbacks when Moralis returns empty. */
async function getRecentBuysForWallet(
  address: string,
  limit: number,
  maxAgeMs: number,
  useMoralis: boolean,
  hasHelius: boolean,
  hasBirdeye: boolean
): Promise<WalletBuy[]> {
  if (useMoralis) {
    const moralis = await getWalletBuySwapsFromMoralis(address, limit, maxAgeMs);
    if (moralis.length > 0) return moralis;
  }
  if (hasHelius) {
    const helius = await getRecentTokenBuysForWallet(address, limit, maxAgeMs);
    if (helius.length > 0) return helius;
  }
  if (hasBirdeye) return getWalletTokenBuysFromBirdeye(address, limit, maxAgeMs);
  return [];
}

/** GET - Recent buys from each tracked wallet (Pro). Uses Birdeye (primary) or Helius. */
export async function GET() {
  try {
    const { tier } = await getSessionAndSubscription();
    if (tier !== 'vip') {
      return NextResponse.json({ success: false, error: 'VIP subscription required for wallet trades.', locked: true }, { status: 403 });
    }
    const trackedWallets = await getTrackedWallets();
    if (trackedWallets.length === 0) {
      return NextResponse.json({ success: true, trades: [], message: 'No wallets configured.' });
    }
    const [rules, moralisWalletTracker] = await Promise.all([getAlertRules(), getFeatureFlag(FEATURE_FLAG_KEYS.MORALIS_WALLET_TRACKER)]);
    const hasMoralis = moralisWalletTracker && Boolean(process.env.MORALIS_API_KEY);
    const hasHelius = Boolean(process.env.HELIUS_API_KEY);
    const hasBirdeye = Boolean(process.env.BIRDEYE_API_KEY);
    if (!hasMoralis && !hasHelius && !hasBirdeye) {
      return NextResponse.json({ success: false, trades: [], error: 'Wallet trades require MORALIS_API_KEY, HELIUS_API_KEY, or BIRDEYE_API_KEY.' }, { status: 503 });
    }

    const MAX_AGE_MS = rules.maxAgeHours * 60 * 60 * 1000;
    const allTrades: WalletTrade[] = [];

    for (const w of trackedWallets) {
      const buys = await getRecentBuysForWallet(w.address, BUYS_PER_WALLET, MAX_AGE_MS, hasMoralis, hasHelius, hasBirdeye);
      for (const b of buys) {
        const dex = await getSolanaToken(b.mint);
        allTrades.push({
          walletLabel: w.label || `${w.address.slice(0, 4)}…${w.address.slice(-4)}`,
          walletAddress: w.address,
          mint: b.mint,
          symbol: dex?.baseToken?.symbol ?? '—',
          name: dex?.baseToken?.name ?? '—',
          timestamp: b.timestamp,
          signature: b.signature ?? null,
          txUrl: b.signature ? `https://solscan.io/tx/${b.signature}` : `https://solscan.io/account/${w.address}`,
          dexUrl: `https://dexscreener.com/solana/${b.mint}`,
        });
        if (allTrades.length >= MAX_TRADES_TOTAL) break;
        await new Promise((r) => setTimeout(r, 80));
      }
      if (allTrades.length >= MAX_TRADES_TOTAL) break;
      await new Promise((r) => setTimeout(r, 100));
    }

    // Newest first
    allTrades.sort((a, b) => b.timestamp - a.timestamp);

    return NextResponse.json({
      success: true,
      trades: allTrades.slice(0, MAX_TRADES_TOTAL),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, trades: [], error: error?.message ?? 'Failed to load wallet trades' },
      { status: 500 }
    );
  }
}
