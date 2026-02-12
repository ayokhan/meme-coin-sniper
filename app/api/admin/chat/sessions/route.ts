import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isOwnerEmail } from '@/lib/auth';
import { prisma } from '@/lib/db';

/** GET - List chat sessions (nja and live). Owner-only. */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email ?? null;
    if (!email || !isOwnerEmail(email)) {
      return NextResponse.json({ success: false, error: 'Not authorized.' }, { status: 403 });
    }

    const sessions = await prisma.chatSession.findMany({
      where: { status: { in: ['nja', 'live'] } },
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: { orderBy: { createdAt: 'asc' }, take: 50 },
      },
    }) as Array<{
      id: string;
      status: string;
      customerName: string | null;
      customerEmail: string | null;
      createdAt: Date;
      updatedAt: Date;
      messages: Array<{ id: string; role: string; content: string; createdAt: Date }>;
    }>;

    return NextResponse.json({
      success: true,
      sessions: sessions.map((s) => ({
        id: s.id,
        status: s.status,
        customerName: s.customerName,
        customerEmail: s.customerEmail,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        messages: s.messages.map((m) => ({ id: m.id, role: m.role, content: m.content, createdAt: m.createdAt })),
      })),
    });
  } catch (e) {
    console.error('Admin chat sessions error:', e);
    return NextResponse.json({ success: false, error: 'Failed to load sessions.' }, { status: 500 });
  }
}
