import axios from 'axios';

const DEXSCREENER_BASE = 'https://api.dexscreener.com';

export interface DexPair {
  chainId: string;
  dexId: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken?: { address: string; name: string; symbol: string };
  priceUsd: string;
  txns?: { h24?: { buys: number; sells: number }; h6?: { buys: number; sells: number }; h1?: { buys: number; sells: number } };
  volume?: { h24: number; h6?: number; h1?: number };
  priceChange?: { h24: number; h6?: number; h1?: number };
  liquidity?: { usd: number; base?: number; quote?: number };
  fdv?: number;
  pairCreatedAt: number;
  info?: { socials?: Array<{ type?: string; platform?: string; url?: string; handle?: string }>; websites?: Array<{ url: string }> };
}

/** Fetch Solana pairs via search (official API has no "all pairs" endpoint). More queries = more pairs. */
async function fetchSolanaPairsViaSearch(extraQueries: string[] = []): Promise<DexPair[]> {
  const queries = [
    'SOL', 'USDC', 'BONK', 'WIF', 'PEPE', 'DOGE', 'FLOKI', 'POPCAT', 'MEW', 'SLERF', 'SHIB',
    'MEME', 'TOSHI', 'NEIRO', 'MOODENG', 'FARTCOIN', 'MOG', 'TURBO', ...extraQueries
  ];
  const seen = new Set<string>();
  const all: DexPair[] = [];
  for (const q of queries) {
    try {
      const res = await axios.get<{ pairs?: DexPair[] }>(`${DEXSCREENER_BASE}/latest/dex/search`, {
        params: { q },
        timeout: 15000,
      });
      const pairs = res.data?.pairs ?? [];
      for (const p of pairs) {
        if (p.chainId !== 'solana') continue;
        if (seen.has(p.pairAddress)) continue;
        seen.add(p.pairAddress);
        all.push(p);
      }
    } catch {
      // skip failed query
    }
  }
  return all;
}

export async function getNewSolanaPairs(minLiquidity = 5000, maxAgeMinutes = 60): Promise<DexPair[]> {
  try {
    const pairs = await fetchSolanaPairsViaSearch();
    const now = Date.now();
    const usd = (p: DexPair) => p.liquidity?.usd ?? 0;
    const vol = (p: DexPair) => p.volume?.h24 ?? 0;
    const dexOk = (p: DexPair) => ['raydium', 'orca', 'meteora', 'pump.fun', 'pumpswap'].includes((p.dexId || '').toLowerCase());
    const eligible = pairs
      .filter((p) => usd(p) >= minLiquidity && vol(p) > 100 && dexOk(p))
      .sort((a, b) => b.pairCreatedAt - a.pairCreatedAt);
    const inWindow = eligible.filter((p) => (now - p.pairCreatedAt) <= maxAgeMinutes * 60000);
    const source = inWindow.length > 0 ? inWindow : eligible;
    return source.slice(0, 80);
  } catch {
    return [];
  }
}

/** Trending = live movers by 24h volume + price change (distinct from "new pairs" which is DB scan result). */
export async function getTrendingSolanaPairs(limit = 20): Promise<DexPair[]> {
  try {
    const pairs = await fetchSolanaPairsViaSearch();
    const usd = (p: DexPair) => p.liquidity?.usd ?? 0;
    const vol = (p: DexPair) => p.volume?.h24 ?? 0;
    const change = (p: DexPair) => p.priceChange?.h24 ?? p.priceChange?.h6 ?? 0;
    const dexOk = (p: DexPair) => ['raydium', 'orca', 'meteora', 'pump.fun', 'pumpswap'].includes((p.dexId || '').toLowerCase());
    // Min 24h volume so "trending" = real movers, not just any pair
    return pairs
      .filter((p) => dexOk(p) && usd(p) >= 2000 && vol(p) >= 5000)
      .sort((a, b) => (vol(b) * (1 + (change(b) ?? 0) / 100)) - (vol(a) * (1 + (change(a) ?? 0) / 100)))
      .slice(0, limit);
  } catch {
    return [];
  }
}

export type SurgeWindow = 'm5' | 'm15' | 'm30' | 'h1' | 'h6' | 'h24';

/** Surge = high volume in a time window. DexScreener provides h1, h6, h24; 5m/15m/30m are estimated from 1h. */
export function getVolumeForWindow(pair: DexPair, window: SurgeWindow): number {
  const vol1h = pair.volume?.h1 ?? pair.volume?.h6 ?? pair.volume?.h24 ?? 0;
  const vol6h = pair.volume?.h6 ?? pair.volume?.h24 ?? 0;
  const vol24h = pair.volume?.h24 ?? 0;
  switch (window) {
    case 'm5':  return vol1h / 12;       // estimated 5m from 1h
    case 'm15': return vol1h / 4;        // estimated 15m from 1h
    case 'm30': return vol1h / 2;        // estimated 30m from 1h
    case 'h1':  return vol1h;
    case 'h6':  return vol6h;
    case 'h24': return vol24h;
    default:   return vol24h;
  }
}

export async function getSurgeSolanaPairs(
  window: SurgeWindow,
  minVolume: number,
  limit = 80
): Promise<DexPair[]> {
  try {
    const pairs = await fetchSolanaPairsViaSearch();
    const usd = (p: DexPair) => p.liquidity?.usd ?? 0;
    const vol = (p: DexPair) => getVolumeForWindow(p, window);
    const dexOk = (p: DexPair) => ['raydium', 'orca', 'meteora', 'pump.fun', 'pumpswap'].includes((p.dexId || '').toLowerCase());
    return pairs
      .filter((p) => dexOk(p) && usd(p) >= 1000 && vol(p) >= minVolume)
      .sort((a, b) => vol(b) - vol(a))
      .slice(0, limit);
  } catch {
    return [];
  }
}

export async function getSolanaToken(mintAddress: string): Promise<DexPair | null> {
  try {
    const response = await axios.get<DexPair[] | { pairs?: DexPair[] }>(`https://api.dexscreener.com/tokens/v1/solana/${mintAddress}`, { timeout: 15000 });
    const raw = response.data;
    const pairs = Array.isArray(raw) ? raw : (raw?.pairs ?? []);
    const solanaPairs = pairs.filter((p) => p.chainId === 'solana');
    if (solanaPairs.length === 0) return null;
    const usd = (p: DexPair) => p.liquidity?.usd ?? 0;
    return solanaPairs.sort((a, b) => usd(b) - usd(a))[0];
  } catch {
    return null;
  }
}

export function extractSocials(pair: DexPair) {
  const socials = pair.info?.socials ?? [];
  const byType = (name: string) =>
    socials.find((s) => (s.type ?? s.platform ?? '').toLowerCase() === name);
  const twitter = byType('twitter');
  const telegram = byType('telegram');
  return {
    website: pair.info?.websites?.[0]?.url ?? null,
    twitter: (twitter?.url ?? (twitter?.handle ? `https://twitter.com/${twitter.handle}` : null)) ?? null,
    telegram: (telegram?.url ?? (telegram?.handle ? `https://t.me/${telegram.handle}` : null)) ?? null,
  };
}

export function getQualityScore(pair: DexPair) {
  let score = 0;
  const reasons: string[] = [];
  const liq = pair.liquidity?.usd ?? 0;
  const vol = pair.volume?.h24 ?? 0;
  const txns = pair.txns?.h24;
  if (liq > 50000) { score += 25; reasons.push('✅ Strong liquidity'); }
  if (liq > 0) {
    const volumeRatio = vol / liq;
    if (volumeRatio > 1 && volumeRatio < 10) { score += 20; reasons.push('✅ Healthy volume'); }
  }
  if (txns && txns.buys + txns.sells > 0) {
    const buyRatio = txns.buys / (txns.buys + txns.sells);
    if (buyRatio > 0.4 && buyRatio < 0.7) { score += 15; reasons.push('✅ Balanced'); }
  }
  return { score, reasons };
}
