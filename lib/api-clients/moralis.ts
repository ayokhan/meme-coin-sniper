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

const MORALIS_RETRIES = 2;
const MORALIS_BACKOFF_MS = 800;

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MORALIS_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (attempt < MORALIS_RETRIES) {
        await new Promise((r) => setTimeout(r, MORALIS_BACKOFF_MS * (attempt + 1)));
      }
    }
  }
  throw lastErr;
}

export async function getPumpFunNewTokens(limit = 50): Promise<MoralisNewToken[]> {
  if (!MORALIS_API_KEY) {
    return [];
  }
  try {
    return await withRetry(async () => {
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
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('Moralis pump.fun new tokens error:', msg);
    return [];
  }
}

export function isMoralisConfigured(): boolean {
  return Boolean(MORALIS_API_KEY);
}

/** Wallet swap from Moralis – mint involved and when (used for buys and sells). */
export type MoralisWalletSwap = {
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
 * Internal helper: get recent swaps for a wallet from Moralis with a given transactionTypes filter.
 */
async function getWalletSwapsInternal(
  walletAddress: string,
  limit = 50,
  maxAgeMs = 24 * 60 * 60 * 1000,
  transactionTypes: string
): Promise<MoralisWalletSwap[]> {
  if (!MORALIS_API_KEY) return [];

  try {
    const res = await withRetry(() =>
      axios.get<{ result?: MoralisSwapResult[] }>(
        `${MORALIS_GATEWAY}/account/mainnet/${walletAddress}/swaps`,
        {
          params: {
            limit: Math.min(limit, 100),
            order: 'DESC',
            transactionTypes,
          },
          headers: {
            Accept: 'application/json',
            'X-API-Key': MORALIS_API_KEY,
          },
          timeout: 15000,
        }
      )
    );

    const swaps = res.data?.result ?? [];
    const cutoff = Date.now() - maxAgeMs;
    const seen = new Map<string, MoralisWalletSwap>();

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
    console.warn('Moralis getWalletSwapsInternal error:', e instanceof Error ? e.message : e);
    return [];
  }
}

/**
 * Get recent BUY swaps only for a wallet from Moralis.
 * Uses GET /account/mainnet/:address/swaps with transactionTypes=buy.
 * Used by alerts logic (3+ wallets buying same token, first-buy alerts).
 */
export async function getWalletBuySwapsFromMoralis(
  walletAddress: string,
  limit = 50,
  maxAgeMs = 24 * 60 * 60 * 1000
): Promise<MoralisWalletSwap[]> {
  return getWalletSwapsInternal(walletAddress, limit, maxAgeMs, 'buy');
}

/**
 * Get recent BUY and SELL swaps for a wallet from Moralis.
 * Uses transactionTypes=buy,sell. Used by the live trades UI so you see all swaps.
 */
export async function getWalletSwapsFromMoralis(
  walletAddress: string,
  limit = 50,
  maxAgeMs = 24 * 60 * 60 * 1000
): Promise<MoralisWalletSwap[]> {
  return getWalletSwapsInternal(walletAddress, limit, maxAgeMs, 'buy,sell');
}
