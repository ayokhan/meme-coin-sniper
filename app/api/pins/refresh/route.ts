import { NextResponse } from 'next/server';
import { getSessionAndSubscription } from '@/lib/auth-server';
import { prisma } from '@/lib/db';
import { runAiAnalysis } from '@/lib/ai-analyze';
import { runAiAnalysisEvm } from '@/lib/ai-analyze-bsc';
import { assertAiAgentAccess, recordAiAgentUsage } from '@/lib/ai-agent-quota';

/**
 * POST /api/pins/refresh — run AI re-analysis for one pinned token and save result.
 * Counts toward Meme Coins Agent daily quota (Solana, BSC, and ETH combined).
 */
export async function POST(request: Request) {
  try {
    const { session, userId, isPaid } = await getSessionAndSubscription();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Sign in to refresh pins.', locked: true }, { status: 401 });
    }

    const access = await assertAiAgentAccess(session, isPaid, 'meme_agent');
    if (!access.ok) {
      return NextResponse.json(
        {
          success: false,
          error: access.error,
          locked: access.locked,
          limitReached: access.limitReached,
          used: access.used,
          limit: access.limit,
        },
        { status: access.status }
      );
    }

    const body = await request.json().catch(() => ({}));
    const contractAddress = (body.contractAddress ?? body.ca ?? '').trim();
    if (!contractAddress) {
      return NextResponse.json({ success: false, error: 'Missing contractAddress.' }, { status: 400 });
    }

    const prismaPins = prisma as unknown as {
      pinnedToken: {
        findUnique: (args: { where: { userId_contractAddress: { userId: string; contractAddress: string } } }) => Promise<{ id: string; chain: string; symbol: string | null; name: string | null } | null>;
        update: (args: unknown) => Promise<unknown>;
      };
    };
    const pin = await prismaPins.pinnedToken.findUnique({
      where: { userId_contractAddress: { userId, contractAddress } },
    });
    if (!pin) {
      return NextResponse.json({ success: false, error: 'Pin not found.' }, { status: 404 });
    }

    const chain =
      pin.chain === 'bsc'
        ? 'bsc'
        : pin.chain === 'ethereum'
          ? 'ethereum'
          : pin.chain === 'robinhood'
            ? 'robinhood'
            : pin.chain === 'hyperevm'
              ? 'hyperevm'
              : 'solana';
    const result =
      chain === 'solana'
        ? await runAiAnalysis(contractAddress)
        : await runAiAnalysisEvm(contractAddress, chain);

    await recordAiAgentUsage(userId, 'meme_agent').catch(() => {});

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
