import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isOwnerSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

/** POST - Send a message as live support agent. Owner-only. Customer sees "Support Agent". */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerSession(session)) {
      return NextResponse.json({ success: false, error: 'Not authorized.' }, { status: 403 });
    }

    const body = await req.json();
    const { sessionId, content } = body as { sessionId?: string; content?: string };
    const sid = typeof sessionId === 'string' ? sessionId.trim() : '';
    const text = typeof content === 'string' ? content.trim() : '';
    if (!sid || !text) {
      return NextResponse.json({ success: false, error: 'sessionId and content required.' }, { status: 400 });
    }

    const chatSession = await prisma.chatSession.findUnique({ where: { id: sid } });
    if (!chatSession) {
      return NextResponse.json({ success: false, error: 'Session not found.' }, { status: 404 });
    }

    await prisma.$transaction([
      prisma.chatSession.update({
        where: { id: sid },
        data: { status: 'live' },
      }),
      prisma.chatMessage.create({
        data: { sessionId: sid, role: 'agent', content: text },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Admin chat message error:', e);
    return NextResponse.json({ success: false, error: 'Failed to send message.' }, { status: 500 });
  }
}
