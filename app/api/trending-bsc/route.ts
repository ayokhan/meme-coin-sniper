import { NextResponse } from 'next/server';
import { getTrendingBscPairs, extractSocials, type DexPair } from '@/lib/api-clients/dexscreener';

function pairToToken(pair: DexPair): {
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
} {
  const socials = extractSocials(pair);
  const liq = pair.liquidity?.usd ?? 0;
  const vol = pair.volume?.h24 ?? 0;
  const change = pair.priceChange?.h24 ?? pair.priceChange?.h6 ?? 0;
  const txns = pair.txns?.h24 ?? pair.txns?.h6 ?? pair.txns?.h1;
  let score = 0;
  if (liq >= 50000) score += 15;
  else if (liq >= 20000) score += 10;
  else if (liq >= 10000) score += 5;
  if (vol >= 50000) score += 15;
  else if (vol >= 20000) score += 10;
  else if (vol >= 5000) score += 5;
  if (change >= 50) score += 15;
  else if (change >= 20) score += 10;
  else if (change > 0) score += 5;
  score += (socials.website ? 2 : 0) + (socials.twitter ? 3 : 0) + (socials.telegram ? 2 : 0);

  const createdAt = pair.pairCreatedAt != null ? (pair.pairCreatedAt < 1e12 ? pair.pairCreatedAt * 1000 : pair.pairCreatedAt) : Date.now();
  return {
    id: pair.baseToken.address,
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

export async function GET() {
  try {
    const pairs = await getTrendingBscPairs(80);
    const tokens = pairs.map(pairToToken);
    return NextResponse.json({ success: true, tokens });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'BSC trending failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
