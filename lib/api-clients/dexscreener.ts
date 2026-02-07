import axios from 'axios';
import WebSocket from 'ws';

const DEXSCREENER_BASE = 'https://api.dexscreener.com';
const DEXSCREENER_WS = 'wss://io.dexscreener.com/dex/screener/pairs/h24/1';

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

function toMs(createdAt: number): number {
  return createdAt < 1e12 ? createdAt * 1000 : createdAt;
}

/** Fetch Solana pairs via search (official API has no "all pairs" endpoint). More queries = more pairs. */
async function fetchSolanaPairsViaSearch(extraQueries: string[] = []): Promise<DexPair[]> {
  const queries = [
    'SOL', 'USDC', 'BONK', 'WIF', 'PEPE', 'DOGE', 'FLOKI', 'POPCAT', 'MEW', 'SLERF', 'SHIB',
    'MEME', 'TOSHI', 'NEIRO', 'MOODENG', 'FARTCOIN', 'MOG', 'TURBO',
    'solana', 'pump', 'raydium', 'jup', 'meme coin', 'new token', 'pump.fun', 'pumpswap',
    ...extraQueries
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

export async function getNewSolanaPairs(minLiquidity = 500, maxAgeMinutes = 120): Promise<DexPair[]> {
  try {
    const pairs = await fetchSolanaPairsViaSearch();
    const now = Date.now();
    const usd = (p: DexPair) => p.liquidity?.usd ?? 0;
    const vol = (p: DexPair) => p.volume?.h24 ?? 0;
    const dexOk = (p: DexPair) => ['raydium', 'orca', 'meteora', 'pump.fun', 'pumpswap'].includes((p.dexId || '').toLowerCase());
    const eligible = pairs
      .filter((p) => usd(p) >= minLiquidity && (vol(p) > 0 || usd(p) >= minLiquidity) && dexOk(p))
      .sort((a, b) => toMs(b.pairCreatedAt) - toMs(a.pairCreatedAt));
    const inWindow = eligible.filter((p) => (now - toMs(p.pairCreatedAt)) <= maxAgeMinutes * 60000);
    const fallbackMinutes = Math.min(maxAgeMinutes * 2, 120);
    const inFallback = eligible.filter((p) => (now - toMs(p.pairCreatedAt)) <= fallbackMinutes * 60000);
    const source = inWindow.length > 0 ? inWindow : inFallback.length > 0 ? inFallback : eligible;
    return source.slice(0, 300);
  } catch {
    return [];
  }
}

/** WS pair message shape (DexScreener streams slightly different fields). */
interface WsPair {
  chainId?: string;
  dexId?: string;
  pairAddress?: string;
  baseToken?: { address?: string; name?: string; symbol?: string };
  liquidity?: { usd?: number };
  priceUsd?: string;
  pairCreatedAt?: number;
  txns?: { h24?: { buys?: number; sells?: number }; h6?: { buys?: number; sells?: number }; h1?: { buys?: number; sells?: number }; m5?: { buys?: number; sells?: number } };
  priceChange?: { h24?: number; h6?: number; h1?: number; m5?: number };
  volume?: { h24?: number; h6?: number; h1?: number };
  marketCap?: number;
  profile?: { website?: string; twitter?: string; header?: string; linkCount?: number; imgKey?: string };
}

function wsPairToDexPair(p: WsPair): DexPair | null {
  if (!p?.baseToken?.address || p.chainId !== 'solana') return null;
  const createdAt = p.pairCreatedAt != null ? (p.pairCreatedAt < 1e12 ? p.pairCreatedAt * 1000 : p.pairCreatedAt) : 0;
  const profile = p.profile ?? {};
  const socials = [];
  if (profile.twitter) socials.push({ type: 'twitter', url: profile.twitter, platform: 'twitter' });
  return {
    chainId: 'solana',
    dexId: p.dexId ?? '',
    pairAddress: p.pairAddress ?? '',
    baseToken: {
      address: p.baseToken.address,
      name: p.baseToken.name ?? '—',
      symbol: p.baseToken.symbol ?? '—',
    },
    priceUsd: p.priceUsd ?? '0',
    txns: p.txns
      ? {
          h24: p.txns.h24 ? { buys: p.txns.h24.buys ?? 0, sells: p.txns.h24.sells ?? 0 } : undefined,
          h6: p.txns.h6 ? { buys: p.txns.h6.buys ?? 0, sells: p.txns.h6.sells ?? 0 } : undefined,
          h1: p.txns.h1 ? { buys: p.txns.h1.buys ?? 0, sells: p.txns.h1.sells ?? 0 } : undefined,
        }
      : undefined,
    volume: p.volume ? { h24: p.volume.h24 ?? 0, h6: p.volume?.h6, h1: p.volume?.h1 } : undefined,
    priceChange: p.priceChange ? { h24: p.priceChange.h24 ?? 0, h6: p.priceChange.h6, h1: p.priceChange.h1 } : undefined,
    liquidity: p.liquidity ? { usd: p.liquidity.usd ?? 0 } : undefined,
    fdv: p.marketCap,
    pairCreatedAt: createdAt,
    info: {
      websites: profile.website ? [{ url: profile.website }] : undefined,
      socials: socials.length > 0 ? socials : undefined,
    },
  };
}

/**
 * Fetch newest Solana pairs from DexScreener WebSocket (rank by pairCreatedAt desc).
 * Returns up to 200 pairs. Falls back to [] on timeout or error.
 */
export function getNewSolanaPairsFromWebSocket(timeoutMs = 12000): Promise<DexPair[]> {
  return new Promise((resolve) => {
    const url = `${DEXSCREENER_WS}?rankBy[key]=pairCreatedAt&rankBy[order]=desc`;
    const ws = new WebSocket(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NovaStaris/1.0)',
        Origin: 'https://dexscreener.com',
      },
    });
    const t = setTimeout(() => {
      try { ws.close(); } catch { /* noop */ }
      resolve([]);
    }, timeoutMs);
    ws.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString()) as { type?: string; pairs?: WsPair[] };
        if (msg.type === 'pairs' && Array.isArray(msg.pairs)) {
          clearTimeout(t);
          ws.close();
          const pairs = msg.pairs.map(wsPairToDexPair).filter((x): x is DexPair => x != null);
          resolve(pairs.slice(0, 300));
        }
      } catch {
        // ignore parse errors
      }
    });
    ws.on('error', () => {
      clearTimeout(t);
      try { ws.close(); } catch { /* noop */ }
      resolve([]);
    });
    ws.on('close', () => clearTimeout(t));
  });
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
