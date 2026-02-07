import { NextResponse } from 'next/server';
import { getNewSolanaPairs, getNewSolanaPairsFromWebSocket, extractSocials, type DexPair } from '@/lib/api-clients/dexscreener';
import { getNewListings } from '@/lib/api-clients/birdeye';
import { getPumpFunNewTokens, type MoralisNewToken } from '@/lib/api-clients/moralis';
import { getSessionAndSubscription } from '@/lib/auth-server';

const FREE_LIMIT = 50;
const PAID_LIMIT = 300;

type TokenOut = {
  id: string;
  symbol: string;
  name: string;
  contractAddress: string;
  viralScore: number;
  liquidity: number | null;
  priceUSD: number | null;
  pairAddress: string | null;
  twitter: string | null;
  telegram: string | null;
  website: string | null;
  launchedAt: string;
  volume24h: number | null;
  txnsBuys24h: number | null;
  txnsSells24h: number | null;
};

/** Live new pairs (by pair creation time). */
function pairToToken(pair: DexPair): TokenOut {
  const socials = extractSocials(pair);
  const liq = pair.liquidity?.usd ?? 0;
  const vol = pair.volume?.h24 ?? 0;
  const change = pair.priceChange?.h24 ?? pair.priceChange?.h6 ?? 0;
  const txns = pair.txns?.h24 ?? pair.txns?.h6 ?? pair.txns?.h1;
  let score = 0;
  if (liq >= 50000) score += 15;
  else if (liq >= 20000) score += 10;
  else if (liq >= 5000) score += 5;
  if (vol >= 20000) score += 10;
  else if (vol >= 5000) score += 5;
  if (change >= 50) score += 15;
  else if (change >= 20) score += 10;
  score += (socials.website ? 2 : 0) + (socials.twitter ? 3 : 0) + (socials.telegram ? 2 : 0);

  return {
    id: pair.pairAddress ?? pair.baseToken.address,
    symbol: pair.baseToken.symbol,
    name: pair.baseToken.name,
    contractAddress: pair.baseToken.address,
    viralScore: Math.min(50, score),
    liquidity: liq > 0 ? liq : null,
    priceUSD: pair.priceUsd ? parseFloat(pair.priceUsd) : null,
    pairAddress: pair.pairAddress,
    twitter: socials.twitter,
    telegram: socials.telegram,
    website: socials.website,
    launchedAt: new Date(pair.pairCreatedAt < 1e12 ? pair.pairCreatedAt * 1000 : pair.pairCreatedAt).toISOString(),
    volume24h: vol > 0 ? vol : null,
    txnsBuys24h: txns ? txns.buys : null,
    txnsSells24h: txns ? txns.sells : null,
  };
}

/** Convert Birdeye new listing to TokenOut (no pair/socials; viralScore from liquidity/volume). */
function birdeyeToToken(addr: string, symbol?: string, name?: string, liquidity?: number, v24h?: number): TokenOut {
  let score = 0;
  const liq = liquidity ?? 0;
  if (liq >= 50000) score += 15;
  else if (liq >= 20000) score += 10;
  else if (liq >= 5000) score += 5;
  if ((v24h ?? 0) >= 20000) score += 10;
  else if ((v24h ?? 0) >= 5000) score += 5;
  return {
    id: addr,
    symbol: symbol ?? '—',
    name: name ?? '—',
    contractAddress: addr,
    viralScore: Math.min(50, score),
    liquidity: liq > 0 ? liq : null,
    priceUSD: null,
    pairAddress: null,
    twitter: null,
    telegram: null,
    website: null,
    launchedAt: new Date().toISOString(),
    volume24h: v24h ?? null,
    txnsBuys24h: null,
    txnsSells24h: null,
  };
}

/** Convert Moralis Pump.fun new token to TokenOut. */
function moralisToToken(m: MoralisNewToken): TokenOut {
  const liq = m.liquidity != null ? parseFloat(String(m.liquidity)) : 0;
  let score = 0;
  if (liq >= 50000) score += 15;
  else if (liq >= 20000) score += 10;
  else if (liq >= 5000) score += 5;
  const launchedAt = m.createdAt ? new Date(m.createdAt).toISOString() : new Date().toISOString();
  return {
    id: `moralis:${m.tokenAddress}`,
    symbol: m.symbol ?? '—',
    name: m.name ?? '—',
    contractAddress: m.tokenAddress,
    viralScore: Math.min(50, score),
    liquidity: liq > 0 ? liq : null,
    priceUSD: m.priceUsd != null ? parseFloat(String(m.priceUsd)) : null,
    pairAddress: null,
    twitter: null,
    telegram: null,
    website: null,
    launchedAt,
    volume24h: null,
    txnsBuys24h: null,
    txnsSells24h: null,
  };
}

const PUMP_DEX_IDS = ['pump.fun', 'pumpswap'];
const MIGRATED_DEX_IDS = ['raydium', 'orca', 'meteora'];

export async function GET(request: Request) {
  try {
    const { isPaid } = await getSessionAndSubscription();
    const { searchParams } = new URL(request.url);
    const maxAgeMinutes = Math.min(parseInt(searchParams.get('maxAgeMinutes') || '120', 10), 1440);
    const minLiqParam = parseInt(searchParams.get('minLiquidity') || '0', 10);
    const view = (searchParams.get('view') || 'new_pairs') as 'new_pairs' | 'final_stretch' | 'migrated';
    const minLiquidity = view === 'new_pairs' ? Math.max(0, Math.min(minLiqParam || 200, 10000)) : Math.max(0, minLiqParam || 500);
    const requestedLimit = parseInt(searchParams.get('limit') || '150', 10);
    const limit = isPaid ? Math.min(PAID_LIMIT, Math.max(100, requestedLimit)) : Math.min(FREE_LIMIT, requestedLimit);
    const effectiveMaxAge = view === 'new_pairs' ? Math.min(maxAgeMinutes, 120) : maxAgeMinutes;

    const [wsPairs, searchPairs, birdeyeListings, moralisListings] = await Promise.all([
      view === 'new_pairs' ? getNewSolanaPairsFromWebSocket(10000) : Promise.resolve([]),
      getNewSolanaPairs(minLiquidity, effectiveMaxAge),
      getNewListings(20).catch(() => []),
      view === 'new_pairs' ? getPumpFunNewTokens(50).catch(() => []) : Promise.resolve([]),
    ]);

    const pairs = view === 'new_pairs' && wsPairs.length > 0 ? wsPairs : searchPairs;

    let filteredPairs = pairs;
    if (view === 'final_stretch') {
      filteredPairs = pairs.filter((p) => PUMP_DEX_IDS.includes((p.dexId || '').toLowerCase()));
    } else if (view === 'migrated') {
      filteredPairs = pairs.filter((p) => MIGRATED_DEX_IDS.includes((p.dexId || '').toLowerCase()));
    }

    const byPair = new Map<string, TokenOut>();
    for (const pair of filteredPairs) {
      const t = pairToToken(pair);
      const key = pair.pairAddress ?? t.contractAddress;
      byPair.set(key, t);
    }
    if (view === 'new_pairs') {
      const haveContract = new Set(Array.from(byPair.values(), (t) => t.contractAddress));
      for (const b of birdeyeListings) {
        const addr = b.address;
        if (!addr || haveContract.has(addr)) continue;
        haveContract.add(addr);
        byPair.set(`birdeye:${addr}`, birdeyeToToken(addr, b.symbol, b.name, b.liquidity, b.v24hUSD));
      }
      for (const m of moralisListings) {
        const addr = m.tokenAddress;
        if (!addr || haveContract.has(addr)) continue;
        haveContract.add(addr);
        byPair.set(`moralis:${addr}`, moralisToToken(m));
      }
    }

    let tokens = Array.from(byPair.values())
      .sort((a, b) => new Date(b.launchedAt).getTime() - new Date(a.launchedAt).getTime());

    if (view === 'new_pairs' && tokens.length > 1) {
      let seed = Date.now();
      const next = () => { const x = Math.sin(seed++) * 10000; return x - Math.floor(x); };
      const out = [...tokens];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      tokens = out;
    }

    tokens = tokens.slice(0, limit);

    const viewLabel = view === 'new_pairs' ? 'New pairs' : view === 'final_stretch' ? 'Final Stretch' : 'Migrated';
    return NextResponse.json({
      success: true,
      tokens,
      maxAgeMinutes: effectiveMaxAge,
      view,
      description: `Go Hunting · ${viewLabel}: last ${effectiveMaxAge}m (AI viral score on each).`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'New pairs failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
