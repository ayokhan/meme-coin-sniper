import axios from 'axios';

const DEXSCREENER_BASE = 'https://api.dexscreener.com/latest';
const DEXSCREENER_API_KEY = process.env.DEXSCREENER_API_KEY;

export interface DexPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceNative: string;
  priceUsd: string;
  txns: {
    h24: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h1: { buys: number; sells: number };
  };
  volume: {
    h24: number;
    h6: number;
    h1: number;
  };
  priceChange: {
    h24: number;
    h6: number;
    h1: number;
  };
  liquidity: {
    usd: number;
    base: number;
    quote: number;
  };
  fdv: number;
  pairCreatedAt: number;
  info?: {
    socials?: Array<{ type: string; url: string }>;
    websites?: Array<{ url: string }>;
  };
}

export interface DexScreenerResponse {
  pairs: DexPair[];
}

export async function getNewSolanaPairs(
  minLiquidity: number = 5000,
  maxAgeMinutes: number = 60
): Promise<DexPair[]> {
  try {
    const headers: any = { 'Accept': 'application/json' };
    if (DEXSCREENER_API_KEY) headers['X-API-Key'] = DEXSCREENER_API_KEY;

    const response = await axios.get<DexScreenerResponse>(
      `${DEXSCREENER_BASE}/dex/pairs/solana`,
      { headers, timeout: 15000 }
    );

    if (!response.data.pairs) return [];

    const now = Date.now();
    const maxAge = maxAgeMinutes * 60 * 1000;

    return response.data.pairs
      .filter(pair => {
        const age = now - pair.pairCreatedAt;
        return age <= maxAge && 
               pair.liquidity?.usd >= minLiquidity &&
               pair.volume?.h24 > 100 &&
               ['raydium', 'orca', 'meteora'].includes(pair.dexId.toLowerCase()) &&
               pair.baseToken.symbol.length <= 15 &&
               pair.txns?.h24?.buys > 5;
      })
      .sort((a, b) => b.pairCreatedAt - a.pairCreatedAt);

  } catch (error: any) {
    console.error('DexScreener error:', error.message);
    return [];
  }
}

export async function getTrendingSolanaPairs(limit: number = 20): Promise<DexPair[]> {
  try {
    const headers: any = { 'Accept': 'application/json' };
    if (DEXSCREENER_API_KEY) headers['X-API-Key'] = DEXSCREENER_API_KEY;

    const response = await axios.get<DexScreenerResponse>(
      `${DEXSCREENER_BASE}/dex/pairs/solana`,
      { headers }
    );

    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);

    return response.data.pairs
      .filter(pair => {
        return pair.pairCreatedAt > oneDayAgo &&
               pair.volume?.h24 > 5000 &&
               pair.priceChange?.h6 > 20 &&
               pair.liquidity?.usd > 10000;
      })
      .sort((a, b) => b.priceChange.h6 - a.priceChange.h6)
      .slice(0, limit);

  } catch (error: any) {
    console.error('Error fetching trending:', error.message);
    return [];
  }
}

export async function getSolanaToken(mintAddress: string): Promise<DexPair | null> {
  try {
    const headers: any = { 'Accept': 'application/json' };
    if (DEXSCREENER_API_KEY) headers['X-API-Key'] = DEXSCREENER_API_KEY;

    const response = await axios.get<DexScreenerResponse>(
      `${DEXSCREENER_BASE}/dex/tokens/${mintAddress}`,
      { headers }
    );

    const solanaPairs = response.data.pairs.filter(p => p.chainId === 'solana');
    if (solanaPairs.length === 0) return null;

    return solanaPairs.sort((a, b) => b.liquidity.usd - a.liquidity.usd)[0];

  } catch (error: any) {
    console.error('Token lookup error:', error.message);
    return null;
  }
}

export function extractSocials(pair: DexPair) {
  const socials = {
    website: null as string | null,
    twitter: null as string | null,
    telegram: null as string | null,
  };

  if (pair.info?.websites?.[0]) socials.website = pair.info.websites[0].url;

  if (pair.info?.socials) {
    pair.info.socials.forEach(social => {
      const type = social.type.toLowerCase();
      if (type === 'twitter') socials.twitter = social.url;
      if (type === 'telegram') socials.telegram = social.url;
    });
  }

  return socials;
}

export function getQualityScore(pair: DexPair): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  if (pair.liquidity.usd > 50000) {
    score += 25;
    reasons.push('✅ Strong liquidity');
  } else if (pair.liquidity.usd > 20000) {
    score += 15;
  } else if (pair.liquidity.usd > 10000) {
    score += 10;
  } else {
    reasons.push('⚠️ Low liquidity');
  }

  const volumeRatio = pair.volume.h24 / pair.liquidity.usd;
  if (volumeRatio > 1 && volumeRatio < 10) {
    score += 20;
    reasons.push('✅ Healthy volume');
  } else if (volumeRatio > 10) {
    reasons.push('⚠️ Suspicious volume');
  }

  const buyRatio = pair.txns.h24.buys / (pair.txns.h24.buys + pair.txns.h24.sells);
  if (buyRatio > 0.4 && buyRatio < 0.7) {
    score += 15;
    reasons.push('✅ Balanced trading');
  } else if (buyRatio < 0.3) {
    reasons.push('⚠️ More sells than buys');
  }

  const socials = extractSocials(pair);
  if (socials.twitter || socials.telegram) {
    score += 10;
    reasons.push('✅ Has socials');
  }

  return { score, reasons };
}