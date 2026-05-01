import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isOwnerSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

/** GET - Live transfers after `after` (ISO). Owner-only. Used to alert owners when customers join live queue. */
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerSession(session)) {
      return NextResponse.json({ success: false, error: 'Not authorized.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const afterRaw = searchParams.get('after');
    if (!afterRaw) {
      return NextResponse.json({ success: false, error: 'after (ISO timestamp) required.' }, { status: 400 });
    }
    const afterDate = new Date(afterRaw);
    if (Number.isNaN(afterDate.getTime())) {
      return NextResponse.json({ success: false, error: 'Invalid after timestamp.' }, { status: 400 });
    }

    const rows = await prisma.chatSession.findMany({
      where: {
        status: 'live',
        liveTransferAt: { gt: afterDate },
      },
      orderBy: { liveTransferAt: 'asc' },
    });

    type Row = { id: string; customerName: string | null; customerEmail: string | null; liveTransferAt: Date | null };
    const list = rows as Row[];

    return NextResponse.json({
      success: true,
      transfers: list
        .filter((r) => r.liveTransferAt != null)
        .map((r) => ({
          sessionId: r.id,
          customerName: r.customerName,
          customerEmail: r.customerEmail,
          liveTransferAt: r.liveTransferAt!.toISOString(),
        })),
    });
  } catch (e) {
    console.error('Admin live-transfers error:', e);
    return NextResponse.json({ success: false, error: 'Failed to load transfers.' }, { status: 500 });
  }
}
