import { NextResponse } from 'next/server';
import { getSessionAndSubscription } from '@/lib/auth-server';
import { prisma } from '@/lib/db';
import { runAiAnalysis } from '@/lib/ai-analyze';

/**
 * POST /api/pins/refresh — run AI re-analysis for one pinned token and save result.
 * Body: { contractAddress }. User must own the pin. Use when cron is not frequent enough.
 */
export async function POST(request: Request) {
  try {
    const { userId, isPaid } = await getSessionAndSubscription();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Sign in to refresh pins.', locked: true }, { status: 401 });
    }
    if (!isPaid) {
      return NextResponse.json({ success: false, error: 'Subscribe to use this.', locked: true }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const contractAddress = (body.contractAddress ?? body.ca ?? '').trim();
    if (!contractAddress) {
      return NextResponse.json({ success: false, error: 'Missing contractAddress.' }, { status: 400 });
    }

    const prismaPins = prisma as unknown as {
      pinnedToken: {
        findUnique: (args: { where: { userId_contractAddress: { userId: string; contractAddress: string } } }) => Promise<{ id: string; symbol: string | null; name: string | null } | null>;
        update: (args: unknown) => Promise<unknown>;
      };
    };
    const pin = await prismaPins.pinnedToken.findUnique({
      where: { userId_contractAddress: { userId, contractAddress } },
    });
    if (!pin) {
      return NextResponse.json({ success: false, error: 'Pin not found.' }, { status: 404 });
    }

    const result = await runAiAnalysis(contractAddress);

    await prismaPins.pinnedToken.update({
      where: { id: pin.id },
      data: {
        lastAnalyzedAt: new Date(),
        analysisResult: result as unknown as Record<string, unknown>,
        symbol: result.tokenInfo?.symbol ?? pin.symbol,
        name: result.tokenInfo?.name ?? pin.name,
      },
    });

    return NextResponse.json({
      success: true,
      result: {
        score: result.score,
        signal: result.signal,
        reasons: result.reasons,
        recommendations: result.recommendations,
        tokenInfo: result.tokenInfo,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Refresh failed';
    const status = message.includes('not found') ? 404 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
