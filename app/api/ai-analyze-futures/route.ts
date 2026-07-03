import { NextResponse } from 'next/server';
import { getSessionAndSubscription } from '@/lib/auth-server';
import { runFuturesAnalysis, type ChartAnalysisType } from '@/lib/ai-analyze-futures';
import { fetchUnifiedMarketReadForSymbol } from '@/lib/nova-market-read-snapshot';
import { assertAiAgentAccess, recordAiAgentUsage } from '@/lib/ai-agent-quota';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

function parseNum(s: string | null): number | null {
  if (s == null || s.trim() === '') return null;
  const n = parseFloat(s.trim());
  return Number.isFinite(n) ? n : null;
}

export async function POST(request: Request) {
  try {
    const { session, isPaid, userId } = await getSessionAndSubscription();
    const access = await assertAiAgentAccess(session, isPaid, 'chart_analysis');
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

    const formData = await request.formData();
    const chartFile = formData.get('chart') as File | null;
    const chartTypeRaw = (formData.get('chartType') as string | null)?.trim()?.toLowerCase();
    const chartType: ChartAnalysisType = chartTypeRaw === 'meme' ? 'meme' : 'perp';
    const symbol = (formData.get('symbol') as string | null)?.trim() ?? '';
    const marginVal = parseNum((formData.get('margin') as string | null) ?? '');
    const leverageVal = parseNum((formData.get('leverage') as string | null) ?? '');
    const tradeTimeframe = (formData.get('tradeTimeframe') as string | null)?.trim() ?? '';
    const chartTimeframe = (formData.get('chartTimeframe') as string | null)?.trim() ?? '';
    const riskAmount = parseNum((formData.get('riskAmount') as string | null) ?? '');
    const directionRaw = (formData.get('direction') as string | null)?.trim()?.toLowerCase();

    if (!chartFile || typeof chartFile === 'string') {
      return NextResponse.json(
        { success: false, error: 'Please upload a chart image (required).' },
        { status: 400 }
      );
    }
    if (!symbol) {
      return NextResponse.json(
        { success: false, error: chartType === 'meme' ? 'Token symbol is required (e.g. PEPE).' : 'Symbol is required (e.g. BTC/USDC).' },
        { status: 400 }
      );
    }
    if (marginVal == null || marginVal <= 0) {
      return NextResponse.json(
        { success: false, error: 'Amount to invest must be a positive number.' },
        { status: 400 }
      );
    }
    if (chartType === 'perp') {
      if (leverageVal == null || leverageVal < 1 || leverageVal > 125) {
        return NextResponse.json(
          { success: false, error: 'Leverage must be between 1 and 125 for perp charts.' },
          { status: 400 }
        );
      }
    } else if (leverageVal != null && (leverageVal < 1 || leverageVal > 125)) {
      return NextResponse.json(
        { success: false, error: 'If provided, leverage must be between 1 and 125.' },
        { status: 400 }
      );
    }
    if (!tradeTimeframe) {
      return NextResponse.json(
        { success: false, error: 'Trade timeframe is required (e.g. Scalp, Swing).' },
        { status: 400 }
      );
    }
    if (!chartTimeframe) {
      return NextResponse.json(
        { success: false, error: 'Chart timeframe is required (e.g. 5m, 15m, 4h).' },
        { status: 400 }
      );
    }

    if (chartFile.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: 'Chart image must be under 10 MB.' },
        { status: 400 }
      );
    }
    const mediaType = chartFile.type as string;
    if (!ALLOWED_TYPES.includes(mediaType)) {
      return NextResponse.json(
        { success: false, error: 'Chart must be PNG, JPEG, WebP, or GIF.' },
        { status: 400 }
      );
    }

    const arrayBuffer = await chartFile.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    const direction: 'long' | 'short' | null =
      chartType === 'perp' && (directionRaw === 'long' || directionRaw === 'short') ? directionRaw : null;
    const imageMediaType = mediaType as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';

    const analysisParams = {
      chartType,
      symbol,
      margin: marginVal,
      leverage: chartType === 'perp' ? leverageVal! : leverageVal,
      tradeTimeframe,
      chartTimeframe,
      riskAmount: riskAmount != null && riskAmount > 0 ? riskAmount : null,
      direction,
    };

    const result = await runFuturesAnalysis(base64, imageMediaType, analysisParams);
    const marketRead =
      chartType === 'perp' ? await fetchUnifiedMarketReadForSymbol(symbol).catch(() => null) : null;

    if (userId) await recordAiAgentUsage(userId, 'chart_analysis').catch(() => {});

    return NextResponse.json({
      success: true,
      chartType: result.chartType,
      score: result.score,
      signal: result.signal,
      tradeDirection: result.tradeDirection,
      reasons: result.reasons,
      recommendations: result.recommendations,
      marketRead,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Chart analysis failed';
    console.error('AI analyze futures error:', error);
    const status =
      message.includes('not configured') ? 503 :
      message.includes('not found') ? 404 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
