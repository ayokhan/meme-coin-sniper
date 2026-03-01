import { NextResponse } from 'next/server';
import { getSessionAndSubscription } from '@/lib/auth-server';
import { runAiAnalysisBsc } from '@/lib/ai-analyze-bsc';
import { recordAiAnalysis } from '@/lib/usage';

function isValidBscAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  const trimmed = address.trim();
  return /^0x[0-9a-fA-F]{40}$/.test(trimmed);
}

export async function POST(request: Request) {
  try {
    const { isPaid, userId } = await getSessionAndSubscription();
    if (!isPaid) {
      return NextResponse.json({ success: false, error: 'Subscribe to use NovaStaris AI Agent (BSC).', locked: true }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const contractAddress = (body.contractAddress ?? body.ca ?? '').trim();
    if (!contractAddress) {
      return NextResponse.json(
        { success: false, error: 'Missing contractAddress or ca in request body.' },
        { status: 400 }
      );
    }
    if (!isValidBscAddress(contractAddress)) {
      return NextResponse.json(
        { success: false, error: 'Invalid BSC contract address (expect 0x + 40 hex chars).' },
        { status: 400 }
      );
    }

    const amountUsd = typeof body.amountUsd === 'number' && Number.isFinite(body.amountUsd) && body.amountUsd > 0 ? body.amountUsd : undefined;

    const result = await runAiAnalysisBsc(contractAddress, amountUsd != null ? { amountUsd } : undefined);

    if (userId) await recordAiAnalysis(userId).catch(() => {});

    return NextResponse.json({
      success: true,
      score: result.score,
      signal: result.signal,
      reasons: result.reasons,
      amountRiskNote: result.amountRiskNote,
      recommendations: result.recommendations,
      tokenInfo: result.tokenInfo,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'NovaStaris AI Agent (BSC) failed';
    console.error('AI analyze BSC error:', error);
    const isOverloaded = /overloaded|529/i.test(message);
    const friendlyMessage = isOverloaded
      ? 'AI is temporarily overloaded. Please try again in a minute.'
      : message;
    const status = message.includes('not found') ? 404 : message.includes('not configured') ? 503 : isOverloaded ? 503 : 500;
    return NextResponse.json({ success: false, error: friendlyMessage }, { status });
  }
}
