import { NextResponse } from 'next/server';
import { getSessionAndSubscription } from '@/lib/auth-server';
import { runFuturesAnalysis } from '@/lib/ai-analyze-futures';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

function parseNum(s: string | null): number | null {
  if (s == null || s.trim() === '') return null;
  const n = parseFloat(s.trim());
  return Number.isFinite(n) ? n : null;
}

export async function POST(request: Request) {
  try {
    const { isPaid } = await getSessionAndSubscription();
    if (!isPaid) {
      return NextResponse.json(
        { success: false, error: 'Subscribe to use Crypto Futures AI Analysis.', locked: true },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const chartFile = formData.get('chart') as File | null;
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
        { success: false, error: 'Symbol is required (e.g. BTC/USDC).' },
        { status: 400 }
      );
    }
    if (marginVal == null || marginVal <= 0) {
      return NextResponse.json(
        { success: false, error: 'Margin (amount to invest) must be a positive number.' },
        { status: 400 }
      );
    }
    if (leverageVal == null || leverageVal < 1 || leverageVal > 125) {
      return NextResponse.json(
        { success: false, error: 'Leverage must be between 1 and 125.' },
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

    const direction =
      directionRaw === 'long' || directionRaw === 'short' ? directionRaw : null;
    const imageMediaType = mediaType as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';

    const result = await runFuturesAnalysis(
      base64,
      imageMediaType,
      {
        symbol,
        margin: marginVal,
        leverage: leverageVal,
        tradeTimeframe,
        chartTimeframe,
        riskAmount: riskAmount != null && riskAmount > 0 ? riskAmount : null,
        direction,
      }
    );

    return NextResponse.json({
      success: true,
      score: result.score,
      signal: result.signal,
      reasons: result.reasons,
      recommendations: result.recommendations,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Futures analysis failed';
    console.error('AI analyze futures error:', error);
    const status =
      message.includes('not configured') ? 503 :
      message.includes('not found') ? 404 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
