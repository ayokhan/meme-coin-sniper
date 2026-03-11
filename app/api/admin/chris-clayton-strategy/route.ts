import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isOwnerSession } from '@/lib/auth';
import { runChrisClaytonStrategy } from '@/lib/ai-chris-clayton';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerSession(session)) {
      return NextResponse.json({ success: false, error: 'Owner only.' }, { status: 403 });
    }

    const formData = await request.formData();
    const chartFile = formData.get('chart') as File | null;
    const symbol = (formData.get('symbol') as string | null)?.trim() ?? '';
    const assetTypeRaw = (formData.get('assetType') as string | null)?.trim()?.toLowerCase();

    if (!chartFile || typeof chartFile === 'string') {
      return NextResponse.json(
        { success: false, error: 'Please upload a chart image (required).' },
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
    const imageMediaType = mediaType as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';
    const assetType = assetTypeRaw === 'gold' ? 'gold' : 'crypto';

    const result = await runChrisClaytonStrategy(base64, imageMediaType, {
      symbol: symbol || undefined,
      assetType,
    });

    return NextResponse.json({
      success: true,
      signal: result.signal,
      confluenceScore: result.confluenceScore,
      entry: result.entry,
      tp1: result.tp1,
      tp2: result.tp2,
      sl: result.sl,
      componentScores: result.componentScores,
      summary: result.summary,
      reasons: result.reasons,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Chris Clayton analysis failed';
    console.error('Chris Clayton Strategy API error:', error);
    const status =
      message.includes('not configured') ? 503 :
      message.includes('not found') ? 404 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
