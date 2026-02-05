import { NextResponse } from 'next/server';
import { getSurgeSolanaPairs, extractSocials, type DexPair, type SurgeWindow } from '@/lib/api-clients/dexscreener';

const WINDOW_LABELS: Record<string, string> = {
  m5: '5m',
  m15: '15m',
  m30: '30m',
  h1: '1h',
  h6: '6h',
  h24: '24h',
};

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
  volume5m: number | null;
  volume15m: number | null;
  volume30m: number | null;
  volume1h: number | null;
  volume6h: number | null;
  volume24h: number | null;
} {
  const socials = extractSocials(pair);
  const liq = pair.liquidity?.usd ?? 0;
  const vol1 = pair.volume?.h1 ?? null;
  const vol6 = pair.volume?.h6 ?? null;
  const vol24 = pair.volume?.h24 ?? 0;
  const vol1hNum = vol1 ?? vol6 ?? vol24 ?? 0;
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
    volume5m: vol1hNum > 0 ? vol1hNum / 12 : null,
    volume15m: vol1hNum > 0 ? vol1hNum / 4 : null,
    volume30m: vol1hNum > 0 ? vol1hNum / 2 : null,
    volume1h: vol1 != null && vol1 > 0 ? vol1 : null,
    volume6h: vol6 != null && vol6 > 0 ? vol6 : null,
    volume24h: vol24 > 0 ? vol24 : null,
  };
}

/** Default min volume (USD) per window so short windows show more surging coins. */
function defaultMinVolumeForWindow(window: SurgeWindow): number {
  switch (window) {
    case 'm5': return 2000;
    case 'm15': return 5000;
    case 'm30': return 10000;
    case 'h1': return 15000;
    case 'h6': return 20000;
    case 'h24': return 20000;
    default: return 20000;
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const windowParam = (searchParams.get('window') || 'h24').toLowerCase();
    const window: SurgeWindow =
      windowParam === 'm5' || windowParam === '5m' ? 'm5'
      : windowParam === 'm15' || windowParam === '15m' ? 'm15'
      : windowParam === 'm30' || windowParam === '30m' ? 'm30'
      : windowParam === 'h1' || windowParam === '1h' ? 'h1'
      : windowParam === 'h6' || windowParam === '6h' ? 'h6'
      : 'h24';
    const minVolParam = searchParams.get('minVolume');
    const minVol = minVolParam != null ? parseInt(minVolParam, 10) : defaultMinVolumeForWindow(window);
    const limit = Math.min(parseInt(searchParams.get('limit') || '80', 10), 100);
    const pairs = await getSurgeSolanaPairs(window, minVol, limit);
    const tokens = pairs.map(pairToToken);
    const label = WINDOW_LABELS[window] || '24h';
    return NextResponse.json({
      success: true,
      tokens,
      window,
      windowLabel: label,
      minVolume: minVol,
      description: `Surge: ≥$${(minVol / 1000).toFixed(0)}k volume in last ${label}`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Surge failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
