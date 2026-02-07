import { NextResponse } from 'next/server';
import { TRACKED_WALLETS } from '@/lib/config/ct-wallets';
import { getSessionAndSubscription } from '@/lib/auth-server';
import { getRecentTokenBuysForWallet } from '@/lib/api-clients/helius';
import { getSolanaToken } from '@/lib/api-clients/dexscreener';

const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h
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

/** GET - Recent buys from each tracked wallet (Pro). Proves wallet tracker is working. */
export async function GET() {
  try {
    const { isPaid } = await getSessionAndSubscription();
    if (!isPaid) {
      return NextResponse.json({ success: false, error: 'Subscribe to view live wallet trades.', locked: true }, { status: 403 });
    }
    if (TRACKED_WALLETS.length === 0) {
      return NextResponse.json({ success: true, trades: [], message: 'No wallets configured.' });
    }
    if (!process.env.HELIUS_API_KEY) {
      return NextResponse.json({ success: false, trades: [], error: 'Wallet trades not available.' }, { status: 503 });
    }

    const allTrades: WalletTrade[] = [];

    for (const w of TRACKED_WALLETS) {
      const buys = await getRecentTokenBuysForWallet(w.address, BUYS_PER_WALLET, MAX_AGE_MS);
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
