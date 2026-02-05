import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionAndSubscription } from '@/lib/auth-server';

const FREE_LIMIT = 5;

export async function GET(request: Request) {
  try {
    const { isPaid } = await getSessionAndSubscription();
    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source');
    // CT Scan (Twitter) is paid-only
    if (source === 'twitter' && !isPaid) {
      return NextResponse.json({ success: false, error: 'Subscribe to access CT Scan.', locked: true }, { status: 403 });
    }
    const where: { chain: string; source?: string } = { chain: 'solana' };
    if (source) where.source = source;
    const take = isPaid ? 80 : FREE_LIMIT;
    const rows = await prisma.token.findMany({
      where,
      orderBy: { viralScore: 'desc' },
      take,
    });
    const tokens = rows.map((row) => {
      const r = row as Record<string, unknown>;
      const breakdown = r.scoreBreakdown as { twitterData?: { mentions?: number; uniqueAccounts?: number } } | null | undefined;
      const kolCount = breakdown?.twitterData?.uniqueAccounts ?? breakdown?.twitterData?.mentions ?? undefined;
      return { ...r, kolCount };
    });
    return NextResponse.json({ success: true, tokens });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
