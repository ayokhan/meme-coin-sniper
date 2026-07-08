import { NextResponse } from 'next/server';
import { getSurgeSolanaPairs, type DexPair, type SurgeWindow } from '@/lib/api-clients/dexscreener';
import { getSessionAndSubscription } from '@/lib/auth-server';
import { checkGoHuntingRefreshLimit } from '@/lib/go-hunting-refresh-limit';
import { pairToMemeToken } from '@/lib/meme-token-out';

const WINDOW_LABELS: Record<string, string> = {
  m5: '5m',
  m15: '15m',
  m30: '30m',
  h1: '1h',
  h6: '6h',
  h24: '24h',
};

function pairToSurgeToken(pair: DexPair) {
  const vol1 = pair.volume?.h1 ?? null;
  const vol6 = pair.volume?.h6 ?? null;
  const vol24 = pair.volume?.h24 ?? 0;
  const vol1hNum = vol1 ?? vol6 ?? vol24 ?? 0;
  return {
    ...pairToMemeToken(pair),
    volume5m: vol1hNum > 0 ? vol1hNum / 12 : null,
    volume15m: vol1hNum > 0 ? vol1hNum / 4 : null,
    volume30m: vol1hNum > 0 ? vol1hNum / 2 : null,
    volume1h: vol1 != null && vol1 > 0 ? vol1 : null,
    volume6h: vol6 != null && vol6 > 0 ? vol6 : null,
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
    const { isPaid } = await getSessionAndSubscription();
    if (!isPaid) {
      return NextResponse.json({ success: false, error: 'Subscribe to access Surge.', locked: true }, { status: 403 });
    }

    const limitCheck = await checkGoHuntingRefreshLimit(request);
    if (!limitCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: limitCheck.message,
          limitReached: true,
          retryAfterSeconds: limitCheck.retryAfterSeconds,
        },
        { status: 429, headers: { 'Retry-After': String(limitCheck.retryAfterSeconds) } }
      );
    }

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
    const tokens = pairs.map(pairToSurgeToken);
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
