/**
 * Moralis Solana API – new Pump.fun tokens.
 * Docs: https://docs.moralis.com/web3-data-api/solana/tutorials/get-new-pump-fun-tokens
 * Set MORALIS_API_KEY in .env.local for new pump.fun tokens (up to 100 per request).
 */

import axios from 'axios';

const MORALIS_GATEWAY = 'https://solana-gateway.moralis.io';
const MORALIS_API_KEY = process.env.MORALIS_API_KEY;

export interface MoralisNewToken {
  tokenAddress: string;
  name?: string;
  symbol?: string;
  logo?: string | null;
  decimals?: string;
  priceNative?: string;
  priceUsd?: string;
  liquidity?: string;
  fullyDilutedValuation?: string;
  createdAt?: string;
  [key: string]: unknown;
}

export interface MoralisNewTokensResponse {
  result?: MoralisNewToken[];
  cursor?: string;
}

export async function getPumpFunNewTokens(limit = 50): Promise<MoralisNewToken[]> {
  if (!MORALIS_API_KEY) {
    return [];
  }
  try {
    const res = await axios.get<MoralisNewTokensResponse>(
      `${MORALIS_GATEWAY}/token/mainnet/exchange/pumpfun/new`,
      {
        params: { limit: Math.min(100, Math.max(1, limit)) },
        headers: {
          'Accept': 'application/json',
          'X-API-Key': MORALIS_API_KEY,
        },
        timeout: 15000,
      }
    );
    const list = res.data?.result ?? [];
    return Array.isArray(list) ? list : [];
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('Moralis pump.fun new tokens error:', msg);
    return [];
  }
}

export function isMoralisConfigured(): boolean {
  return Boolean(MORALIS_API_KEY);
}

/** Wallet buy from Moralis swaps – mint received and when */
export type MoralisWalletBuy = {
  mint: string;
  timestamp: number;
  signature?: string;
};

/** Moralis swap result item (Solana) */
type MoralisSwapResult = {
  transactionHash?: string;
  blockTimestamp?: string;
  transactionType?: string;
  tokenMint?: string;
  tokenAddress?: string;
  baseToken?: string;
  pairAddress?: string;
  [key: string]: unknown;
};

/**
 * Get recent BUY swaps for a wallet from Moralis.
 * Uses GET /account/mainnet/:address/swaps with transactionTypes=buy.
 */
export async function getWalletBuySwapsFromMoralis(
  walletAddress: string,
  limit = 50,
  maxAgeMs = 24 * 60 * 60 * 1000
): Promise<MoralisWalletBuy[]> {
  if (!MORALIS_API_KEY) return [];

  try {
    const res = await axios.get<{ result?: MoralisSwapResult[] }>(
      `${MORALIS_GATEWAY}/account/mainnet/${walletAddress}/swaps`,
      {
        params: {
          limit: Math.min(limit, 100),
          order: 'DESC',
          transactionTypes: 'buy',
        },
        headers: {
          Accept: 'application/json',
          'X-API-Key': MORALIS_API_KEY,
        },
        timeout: 15000,
      }
    );

    const swaps = res.data?.result ?? [];
    const cutoff = Date.now() - maxAgeMs;
    const seen = new Map<string, MoralisWalletBuy>();

    for (const s of swaps) {
      const ts = s.blockTimestamp ? new Date(s.blockTimestamp).getTime() : 0;
      if (ts < cutoff) continue;

      const mint =
        s.tokenMint ?? s.tokenAddress ?? (typeof s.baseToken === 'string' ? s.baseToken : '');
      if (!mint) continue;

      if (!seen.has(mint)) {
        seen.set(mint, {
          mint,
          timestamp: ts || Date.now(),
          signature: s.transactionHash ?? undefined,
        });
      }
    }

    return Array.from(seen.values()).sort((a, b) => b.timestamp - a.timestamp);
  } catch (e) {
    console.warn('Moralis getWalletBuySwaps error:', e instanceof Error ? e.message : e);
    return [];
  }
}
