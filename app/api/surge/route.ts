import { NextResponse } from 'next/server';
import { getSurgeSolanaPairs, extractSocials, type DexPair } from '@/lib/api-clients/dexscreener';

function pairToToken(pair: DexPair, minVol: number): {
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
  volume1h: number | null;
} {
  const socials = extractSocials(pair);
  const liq = pair.liquidity?.usd ?? 0;
  const vol24 = pair.volume?.h24 ?? 0;
  const vol1 = pair.volume?.h1 ?? null;
  const change = pair.priceChange?.h24 ?? pair.priceChange?.h6 ?? 0;
  let score = 0;
  if (vol24 >= 100000) score += 25;
  else if (vol24 >= 50000) score += 20;
  else if (vol24 >= 20000) score += 15;
  if (liq >= 50000) score += 15;
  else if (liq >= 20000) score += 10;
  if (change >= 50) score += 15;
  else if (change >= 20) score += 10;
  score += (socials.website ? 2 : 0) + (socials.twitter ? 3 : 0) + (socials.telegram ? 2 : 0);

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
    launchedAt: new Date(pair.pairCreatedAt).toISOString(),
    volume24h: vol24 > 0 ? vol24 : null,
    volume1h: vol1 != null && vol1 > 0 ? vol1 : null,
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const minVol = parseInt(searchParams.get('minVolume') || '20000', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '30', 10), 50);
    const pairs = await getSurgeSolanaPairs(minVol, limit);
    const tokens = pairs.map((p) => pairToToken(p, minVol));
    return NextResponse.json({
      success: true,
      tokens,
      minVolume24h: minVol,
      description: `Pairs with ≥$${(minVol / 1000).toFixed(0)}k 24h volume (surge movers)`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
