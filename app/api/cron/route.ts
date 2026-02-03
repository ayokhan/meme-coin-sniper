import { NextResponse } from 'next/server';

/**
 * Vercel Cron hits this route on schedule (see vercel.json).
 * Set CRON_SECRET in Vercel env; when set, Vercel sends it as Authorization: Bearer <CRON_SECRET>.
 */
export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const base = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  const results: { scan?: { ok: boolean; message?: string }; scanTwitter?: { ok: boolean; message?: string } } = {};

  try {
    const scanRes = await fetch(`${base}/api/scan?source=birdeye`, { cache: 'no-store' });
    const scanData = await scanRes.json().catch(() => ({}));
    results.scan = { ok: scanData.success === true, message: scanData.error ?? scanData.hint };
  } catch (e) {
    results.scan = { ok: false, message: e instanceof Error ? e.message : 'Request failed' };
  }

  try {
    const twitterRes = await fetch(`${base}/api/scan-twitter`, { cache: 'no-store' });
    const twitterData = await twitterRes.json().catch(() => ({}));
    results.scanTwitter = { ok: twitterData.success === true, message: twitterData.error };
  } catch (e) {
    results.scanTwitter = { ok: false, message: e instanceof Error ? e.message : 'Request failed' };
  }

  return NextResponse.json({ success: true, cron: results });
}
