import { NextResponse } from 'next/server';
import { getSessionAndSubscription } from '@/lib/auth-server';
import { runAiAnalysis } from '@/lib/ai-analyze';

function isValidSolanaAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address.trim());
}

export async function POST(request: Request) {
  try {
    const { isPaid } = await getSessionAndSubscription();
    if (!isPaid) {
      return NextResponse.json({ success: false, error: 'Subscribe to use NovaStaris AI Analysis.', locked: true }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const contractAddress = (body.contractAddress ?? body.ca ?? '').trim();
    if (!contractAddress) {
      return NextResponse.json(
        { success: false, error: 'Missing contractAddress or ca in request body.' },
        { status: 400 }
      );
    }
    if (!isValidSolanaAddress(contractAddress)) {
      return NextResponse.json(
        { success: false, error: 'Invalid Solana contract address.' },
        { status: 400 }
      );
    }

    const result = await runAiAnalysis(contractAddress);

    return NextResponse.json({
      success: true,
      score: result.score,
      signal: result.signal,
      reasons: result.reasons,
      recommendations: result.recommendations,
      tokenInfo: result.tokenInfo,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'AI analysis failed';
    console.error('AI analyze error:', error);
    const status = message.includes('not found') ? 404 : message.includes('not configured') ? 503 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
