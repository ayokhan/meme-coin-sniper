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
