import { NextResponse } from 'next/server';
import { getSessionAndSubscription } from '@/lib/auth-server';
import { monitorCTAccounts } from '@/lib/api-clients/twitter';

/** GET - Recent tweets from tracked CT accounts (Pro). Proves CT scan is working. */
export async function GET() {
  try {
    const { isPaid } = await getSessionAndSubscription();
    if (!isPaid) {
      return NextResponse.json({ success: false, error: 'Subscribe to view live CT tweets.', locked: true }, { status: 403 });
    }
    if (!process.env.APIFY_API_TOKEN) {
      return NextResponse.json({
        success: false,
        tweets: [],
        error: 'CT tweets are not available right now.',
      }, { status: 503 });
    }

    // Last 2 hours of tweets from tracked accounts
    const tweets = await monitorCTAccounts(undefined, 2);

    // Newest first, normalize for UI
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
