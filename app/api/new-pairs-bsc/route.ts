import { NextResponse } from 'next/server';
import { getNewBscPairs, extractSocials, type DexPair } from '@/lib/api-clients/dexscreener';

const BSC_DEX_IDS_FINAL = ['pancakeswap', 'pancakeswap_v2', 'pancakeswap_v3', 'biswap', 'apeswap', 'thena'];
const BSC_DEX_IDS_MIGRATED = ['pancakeswap', 'pancakeswap_v2', 'pancakeswap_v3', 'biswap', 'apeswap', 'thena'];

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

  const createdAt = pair.pairCreatedAt != null ? (pair.pairCreatedAt < 1e12 ? pair.pairCreatedAt * 1000 : pair.pairCreatedAt) : Date.now();
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
    launchedAt: new Date(createdAt).toISOString(),
    volume24h: vol > 0 ? vol : null,
    txnsBuys24h: txns ? txns.buys : null,
    txnsSells24h: txns ? txns.sells : null,
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const maxAgeMinutes = Math.min(parseInt(searchParams.get('maxAgeMinutes') || '120', 10), 1440);
    const view = (searchParams.get('view') || 'new_pairs') as 'new_pairs' | 'final_stretch' | 'migrated';
    const minLiquidity = view === 'new_pairs' ? 200 : 500;
    const limit = Math.min(300, parseInt(searchParams.get('limit') || '150', 10));
    const effectiveMaxAge = view === 'new_pairs' ? Math.min(maxAgeMinutes, 120) : maxAgeMinutes;

    const pairs = await getNewBscPairs(minLiquidity, effectiveMaxAge);

    let filteredPairs = pairs;
    if (view === 'final_stretch') {
      filteredPairs = pairs.filter((p) =>
        BSC_DEX_IDS_FINAL.some((d) => (p.dexId || '').toLowerCase().includes(d))
      );
    } else if (view === 'migrated') {
      filteredPairs = pairs.filter((p) =>
        BSC_DEX_IDS_MIGRATED.some((d) => (p.dexId || '').toLowerCase().includes(d))
      );
    }

    const byPair = new Map<string, TokenOut>();
    for (const pair of filteredPairs) {
      const t = pairToToken(pair);
      const key = pair.pairAddress ?? t.contractAddress;
      byPair.set(key, t);
    }

    let tokens = Array.from(byPair.values())
      .sort((a, b) => new Date(b.launchedAt).getTime() - new Date(a.launchedAt).getTime())
      .slice(0, limit);

    const viewLabel = view === 'new_pairs' ? 'New pairs' : view === 'final_stretch' ? 'Final Stretch' : 'Migrated';
    return NextResponse.json({
      success: true,
      tokens,
      maxAgeMinutes: effectiveMaxAge,
      view,
      description: `BSC Go Hunting · ${viewLabel}: last ${effectiveMaxAge}m (AI viral score on each).`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'BSC new pairs failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
