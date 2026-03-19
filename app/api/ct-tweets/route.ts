import { NextResponse } from 'next/server';
import { getSessionAndSubscription } from '@/lib/auth-server';
import { monitorCTAccounts } from '@/lib/api-clients/twitter';
import { canAccessCtScan } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** GET - Recent tweets from tracked CT accounts (Pro). Requires APIFY_API_TOKEN in Vercel. */
export async function GET() {
  try {
    const { tier, session } = await getSessionAndSubscription();
    if (tier !== 'vip' || !canAccessCtScan(session)) {
      return NextResponse.json({ success: false, error: 'VIP + on-demand access required for CT Scan.', locked: true }, { status: 403 });
    }
    if (!process.env.APIFY_API_TOKEN) {
      return NextResponse.json({
        success: false,
        tweets: [],
        error: 'CT Scan needs APIFY_API_TOKEN. Add it in Vercel → Settings → Environment Variables (get a token from apify.com).',
      }, { status: 503 });
    }

    const tweets = await monitorCTAccounts(undefined, 2);
    const sorted = [...tweets].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return NextResponse.json({
      success: true,
      tweets: sorted.map((t) => ({
        id: t.id,
        text: t.text,
        author: { username: t.author.username, followers: t.author.followers, verified: t.author.verified },
        created_at: t.created_at,
        metrics: t.metrics,
        url: t.id ? `https://x.com/${t.author.username}/status/${t.id}` : `https://x.com/${t.author.username}`,
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, tweets: [], error: error?.message ?? 'Failed to load CT tweets' },
      { status: 500 }
    );
  }
}
