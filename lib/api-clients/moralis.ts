/**
 * Moralis API – new Pump.fun tokens as fallback when Birdeye fails.
 * Docs: https://docs.moralis.com/web3-data-api/solana/reference/get-new-tokens-by-exchange
 * Set MORALIS_API_KEY in .env.local.
 */

import axios from 'axios';

const MORALIS_SOLANA_BASE = 'https://solana-gateway.moralis.io';
const MORALIS_API_KEY = process.env.MORALIS_API_KEY;

export interface MoralisNewToken {
  tokenAddress: string;
  name?: string;
  symbol?: string;
  logo?: string;
  decimals?: string;
  priceNative?: string;
  priceUsd?: string;
  liquidity?: string;
  fullyDilutedValuation?: string;
  createdAt?: string;
}

export interface MoralisNewTokensResponse {
  cursor?: string;
  pageSize?: string;
  page?: string;
  result?: MoralisNewToken[];
}

/**
 * Get newly listed Pump.fun tokens (Solana mainnet).
 * Returns tokens in a shape compatible with scan: { address }.
 */
export async function getNewPumpFunTokens(limit = 50): Promise<Array<{ address: string }>> {
  if (!MORALIS_API_KEY) {
    console.warn('Moralis: MORALIS_API_KEY not set – add to .env.local for Pump.fun fallback');
    return [];
  }
  try {
    const res = await axios.get<MoralisNewTokensResponse>(
      `${MORALIS_SOLANA_BASE}/token/mainnet/exchange/pumpfun/new`,
      {
        params: { limit },
        headers: {
          'Accept': 'application/json',
          'X-API-Key': MORALIS_API_KEY,
        },
        timeout: 15000,
      }
    );
    const result = res.data?.result ?? [];
    return (Array.isArray(result) ? result : [])
      .filter((t) => t?.tokenAddress)
      .map((t) => ({ address: t.tokenAddress }));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = axios.isAxiosError(e) ? e.response?.status : undefined;
    console.error('Moralis new Pump.fun tokens error:', msg, status ? `status=${status}` : '');
    return [];
  }
}

export function isMoralisConfigured(): boolean {
  return Boolean(MORALIS_API_KEY);
}
