import { NextResponse } from 'next/server';
import { getNewSolanaPairs, extractSocials, type DexPair } from '@/lib/api-clients/dexscreener';

/** Live new pairs (by pair creation time). Max age in minutes; default 60 = last hour. */
function pairToToken(pair: DexPair) {
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
    volume24h: vol > 0 ? vol : null,
    txnsBuys24h: txns ? txns.buys : null,
    txnsSells24h: txns ? txns.sells : null,
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const maxAgeMinutes = Math.min(parseInt(searchParams.get('maxAgeMinutes') || '60', 10), 1440); // cap 24h
    const minLiquidity = parseInt(searchParams.get('minLiquidity') || '2000', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 80);
    const pairs = await getNewSolanaPairs(minLiquidity, maxAgeMinutes);
    const tokens = pairs.slice(0, limit).map(pairToToken);
    return NextResponse.json({
      success: true,
      tokens,
      maxAgeMinutes,
      description: `New pairs: created in last ${maxAgeMinutes}m (live from DexScreener).`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'New pairs failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
