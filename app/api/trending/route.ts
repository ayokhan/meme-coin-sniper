import { NextResponse } from 'next/server';
import { getTrendingSolanaPairs, extractSocials, type DexPair } from '@/lib/api-clients/dexscreener';
import { getSessionAndSubscription } from '@/lib/auth-server';

const FREE_LIMIT = 10;

/** Map DexPair to the same Token-like shape the dashboard table expects. */
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
} {
  const socials = extractSocials(pair);
  const liq = pair.liquidity?.usd ?? 0;
  const vol = pair.volume?.h24 ?? 0;
  const change = pair.priceChange?.h24 ?? pair.priceChange?.h6 ?? 0;
  // Simple trending score 0–50 from liquidity + volume + price change (no GoPlus call)
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
  };
}

export async function GET() {
  try {
    const { isPaid } = await getSessionAndSubscription();
    const pairs = await getTrendingSolanaPairs(isPaid ? 80 : FREE_LIMIT);
    const tokens = pairs.map(pairToToken);
    return NextResponse.json({ success: true, tokens });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
