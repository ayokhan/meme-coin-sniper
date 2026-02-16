import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isOwnerSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

/** GET - List AI feedback (owner-only). Query: outcome=good|bad, limit=number. */
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerSession(session)) {
      return NextResponse.json({ success: false, error: 'Not authorized.' }, { status: 403 });
    }
    const url = new URL(req.url);
    const outcome = url.searchParams.get('outcome');
    const limit = Math.min(500, Math.max(1, parseInt(url.searchParams.get('limit') ?? '200', 10) || 200));
    const where = outcome === 'good' || outcome === 'bad' ? { outcome } : {};
    const list = await prisma.aiAnalysisFeedback.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    }) as Array<{ id: string; contractAddress: string; outcome: string; note: string | null; score: number | null; signal: string | null; createdAt: Date }>;
    return NextResponse.json({ success: true, feedback: list });
  } catch (e) {
    console.error('AI feedback list error:', e);
    return NextResponse.json({ success: false, error: 'Failed to load feedback.' }, { status: 500 });
  }
}

/** POST - Submit feedback on an AI analysis (owner-only). */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerSession(session)) {
      return NextResponse.json({ success: false, error: 'Not authorized.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const contractAddress = typeof body.contractAddress === 'string' ? body.contractAddress.trim() : '';
    const outcome = body.outcome === 'good' || body.outcome === 'bad' ? body.outcome : null;
    if (!contractAddress || !outcome) {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid contractAddress and outcome (good/bad).' },
        { status: 400 }
      );
    }

    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 1000) : null;
    const score = typeof body.score === 'number' && Number.isFinite(body.score) ? Math.round(body.score) : null;
    const signal = body.signal === 'buy' || body.signal === 'no_buy' ? body.signal : null;
    const userId = session?.user ? (session.user as { id?: string }).id ?? null : null;

    await prisma.aiAnalysisFeedback.create({
      data: { contractAddress, outcome, note, score, signal, userId },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('AI feedback error:', e);
    return NextResponse.json({ success: false, error: 'Failed to save feedback.' }, { status: 500 });
  }
}
