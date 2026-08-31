import { NextResponse } from 'next/server';
import { getSessionAndSubscription } from '@/lib/auth-server';
import { runAiAnalysis } from '@/lib/ai-analyze';
import { runAiAnalysisEvm } from '@/lib/ai-analyze-bsc';
import { assertAiAgentAccess, recordAiAgentUsage } from '@/lib/ai-agent-quota';
import { resolveMemeAgentContract, type MemeAgentChainMode } from '@/lib/meme-contract-detect';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

type AiSnapshot = {
  signal: string;
  score: number;
  tokenInfo: { priceUsd?: number | null; priceChange24hPct?: number };
};

function fingerprintFromAnalysis(r: AiSnapshot): string {
  const px = r.tokenInfo.priceUsd ?? 0;
  const ch = r.tokenInfo.priceChange24hPct ?? 0;
  return `${r.signal}|${r.score}|${px.toFixed(6)}|${ch.toFixed(2)}`;
}

type Body = {
  chain?: string;
  contract?: string;
  previousFingerprint?: string | null;
  amountUsd?: number;
};

/** Logged-in users: poll-friendly full token AI snapshot. Each poll counts toward Meme Coins Agent daily quota (Solana, BSC, and ETH combined). */
export async function POST(request: Request) {
  try {
    const { session, isPaid, userId } = await getSessionAndSubscription();
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

    const body = (await request.json().catch(() => ({}))) as Body;
    const contract = String(body.contract ?? '').trim();
    if (!contract) {
      return NextResponse.json({ success: false, error: 'Enter a contract address.' }, { status: 400 });
    }

    const amountUsd =
      typeof body.amountUsd === 'number' && Number.isFinite(body.amountUsd) && body.amountUsd > 0 ? body.amountUsd : undefined;

    const mode: MemeAgentChainMode =
      body.chain === 'bsc' ||
      body.chain === 'ethereum' ||
      body.chain === 'robinhood' ||
      body.chain === 'hyperevm' ||
      body.chain === 'solana' ||
      body.chain === 'auto'
        ? body.chain
        : 'auto';
    const resolved = await resolveMemeAgentContract(contract, mode);
    if (!resolved.ok) {
      return NextResponse.json({ success: false, error: resolved.error }, { status: 400 });
    }
    const chain = resolved.chain;

    const result =
      chain === 'solana'
        ? await runAiAnalysis(resolved.contractAddress, amountUsd != null ? { amountUsd } : undefined)
        : await runAiAnalysisEvm(resolved.contractAddress, chain, amountUsd != null ? { amountUsd } : undefined);

    if (userId) await recordAiAgentUsage(userId, 'meme_agent').catch(() => {});

    const fingerprint = fingerprintFromAnalysis(result);
    const prev = typeof body.previousFingerprint === 'string' ? body.previousFingerprint.trim() : '';
    const changed = !!prev && prev !== fingerprint;
    const message = changed
      ? 'The AI snapshot changed since your last refresh — consider taking profit, tightening stops, or exiting; reassess before staying in.'
      : 'No material change in this AI snapshot versus the last poll — if your plan still matches the market, you might remain in the trade; always follow your own risk rules.';

    return NextResponse.json({
      success: true,
      chain,
      fingerprint,
      previousFingerprint: prev || null,
      snapshotChanged: changed,
      suggestion: changed ? 'reassess' : 'hold',
      message,
      result,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'AI monitor failed';
    console.error('ai-analyze-monitor:', e);
    const isOverloaded = /overloaded|529/i.test(message);
    const friendly = isOverloaded ? 'AI is temporarily overloaded. Please try again in a minute.' : message;
    const status = message.includes('not found') ? 404 : message.includes('not configured') ? 503 : isOverloaded ? 503 : 500;
    return NextResponse.json({ success: false, error: friendly }, { status });
  }
}
