/**
 * Birdeye API – use "new listing" to catch coins before they go viral.
 * Docs: https://docs.birdeye.so/reference/get-defi-v2-tokens-new_listing
 * Set BIRDEYE_API_KEY in .env.local (get key from Birdeye dashboard).
 */

import axios from 'axios';

const BIRDEYE_BASE = 'https://public-api.birdeye.so';
const BIRDEYE_API_KEY = process.env.BIRDEYE_API_KEY;

export interface BirdeyeNewToken {
  address: string;
  symbol?: string;
  name?: string;
  decimals?: number;
  liquidity?: number;
  mc?: number;
  v24hUSD?: number;
  v24hChangePercent?: number;
  lastTradeUnixTime?: number;
  [key: string]: unknown;
}

export interface BirdeyeNewListingResponse {
  success: boolean;
  data?: {
    tokens?: BirdeyeNewToken[];
    total?: number;
    [key: string]: unknown;
  };
}

/**
 * Get newly listed Solana tokens (first liquidity added recently).
 * Requires time_to (Unix seconds); optional limit and meme_platform_enabled.
 */
/** Birdeye API allows limit 1–20 only. */
const BIRDEYE_LIMIT_MAX = 20;

export async function getNewListings(limit = 50): Promise<BirdeyeNewToken[]> {
  if (!BIRDEYE_API_KEY) {
    console.warn('Birdeye: BIRDEYE_API_KEY not set – add it to .env.local for new listings');
    return [];
  }
  try {
    const time_to = Math.floor(Date.now() / 1000);
    const limitParam = Math.min(Math.max(1, Math.floor(limit)), BIRDEYE_LIMIT_MAX);
    const res = await axios.get<BirdeyeNewListingResponse>(
      `${BIRDEYE_BASE}/defi/v2/tokens/new_listing`,
      {
        params: {
          time_to,
          limit: limitParam,
          meme_platform_enabled: true,
        },
        headers: {
          'X-API-KEY': BIRDEYE_API_KEY,
          'x-chain': 'solana',
          accept: 'application/json',
        },
        timeout: 15000,
      }
    );
    const data = res.data?.data;
    const tokens = Array.isArray(data) ? data : (data?.tokens ?? []);
    return Array.isArray(tokens) ? tokens : [];
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = axios.isAxiosError(e) ? e.response?.status : undefined;
    const body = axios.isAxiosError(e) ? e.response?.data : undefined;
    console.error('Birdeye new_listing error:', msg, status ? `status=${status}` : '', body ? JSON.stringify(body).slice(0, 200) : '');
    return [];
  }
}

export function isBirdeyeConfigured(): boolean {
  return Boolean(BIRDEYE_API_KEY);
}

/** Search tokens by symbol/name; returns first Solana token address or null. Used to resolve $TICKER from Twitter to contract. */
export async function searchTokenBySymbol(symbol: string): Promise<string | null> {
  if (!BIRDEYE_API_KEY || !symbol?.trim()) return null;
  const query = symbol.replace(/^\$/, '').trim();
  if (!query) return null;
  try {
    const res = await axios.get<{ data?: { tokens?: Array<{ address?: string; symbol?: string; chain?: string }> } }>(
      `${BIRDEYE_BASE}/defi/v3/search`,
      {
        params: { keyword: query },
        headers: {
          'X-API-KEY': BIRDEYE_API_KEY,
          'x-chain': 'solana',
          accept: 'application/json',
        },
        timeout: 10000,
      }
    );
    const tokens = res.data?.data?.tokens ?? [];
    const solana = tokens.find((t) => (t.chain ?? 'solana').toLowerCase() === 'solana');
    return solana?.address ?? tokens[0]?.address ?? null;
  } catch (e) {
    console.warn('Birdeye search error for', query, e instanceof Error ? e.message : e);
    return null;
  }
}
