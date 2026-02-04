import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source'); // 'twitter' = CT scan results only
    const where: { chain: string; source?: string } = { chain: 'solana' };
    if (source) where.source = source;
    const rows = await prisma.token.findMany({
      where,
      orderBy: { viralScore: 'desc' },
      take: 50,
    });
    const tokens = rows.map((t) => {
      const breakdown = t.scoreBreakdown as { twitterData?: { mentions?: number; uniqueAccounts?: number } } | null;
      const kolCount = breakdown?.twitterData?.uniqueAccounts ?? breakdown?.twitterData?.mentions ?? undefined;
      return { ...t, kolCount };
    });
    return NextResponse.json({ success: true, tokens });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
