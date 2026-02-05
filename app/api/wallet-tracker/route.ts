import { NextResponse } from 'next/server';
import { TRACKED_WALLETS } from '@/lib/config/ct-wallets';
import { getRecentTokenBuysForWallet } from '@/lib/api-clients/helius';
import { getSolanaToken } from '@/lib/api-clients/dexscreener';
import { getSessionAndSubscription } from '@/lib/auth-server';

const MIN_BUYERS = 3;
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h
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

export async function GET() {
  try {
    const { isPaid } = await getSessionAndSubscription();
    if (!isPaid) {
      return NextResponse.json({ success: false, error: 'Subscribe to access Wallet Tracker.', locked: true }, { status: 403 });
    }
    if (TRACKED_WALLETS.length === 0) {
      return NextResponse.json({
        success: true,
        alerts: [],
        message: 'Wallet tracker is not configured yet.',
      });
    }

    const apiKey = process.env.HELIUS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        alerts: [],
        error: 'Wallet tracker is not available right now. Please try again later.',
      }, { status: 503 });
    }

    // For each tracked wallet, get recent token mints they swapped
    const mintToWallets: Record<string, Set<string>> = {};
    for (const w of TRACKED_WALLETS) {
      const buys = await getRecentTokenBuysForWallet(w.address, LIMIT_PER_WALLET, MAX_AGE_MS);
      for (const b of buys) {
        if (!mintToWallets[b.mint]) mintToWallets[b.mint] = new Set();
        mintToWallets[b.mint].add(w.address);
      }
      await new Promise((r) => setTimeout(r, 100)); // rate limit
    }

    // Mints that 3+ tracked wallets touched
    const alertMints = Object.entries(mintToWallets)
      .filter(([, wallets]) => wallets.size >= MIN_BUYERS)
      .sort((a, b) => b[1].size - a[1].size)
      .slice(0, 30);

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
      await new Promise((r) => setTimeout(r, 150)); // DexScreener rate limit
    }

    return NextResponse.json({
      success: true,
      alerts,
      walletsTracked: TRACKED_WALLETS.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, alerts: [], error: error.message },
      { status: 500 }
    );
  }
}
