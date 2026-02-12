import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';

const SESSION_COOKIE = 'novastaris_chat_session';

/** POST - Get or create a chat session. Returns sessionId, status, and messages. */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const sessionId = (body.sessionId as string)?.trim() || null;
    const cookieStore = await cookies();

    if (sessionId) {
      const session = await prisma.chatSession.findUnique({
        where: { id: sessionId },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      });
      if (session) {
        return NextResponse.json({
          success: true,
          sessionId: session.id,
          status: session.status,
          customerName: session.customerName,
          customerEmail: session.customerEmail,
          messages: session.messages.map((m) => ({ id: m.id, role: m.role, content: m.content, createdAt: m.createdAt })),
        });
      }
    }

    const newSession = await prisma.chatSession.create({
      data: { status: 'nja' },
      include: { messages: true },
    });
    const res = NextResponse.json({
      success: true,
      sessionId: newSession.id,
      status: newSession.status,
      customerName: newSession.customerName,
      customerEmail: newSession.customerEmail,
      messages: [],
    });
    res.cookies.set(SESSION_COOKIE, newSession.id, { path: '/', maxAge: 60 * 60 * 24 * 7, httpOnly: true, sameSite: 'lax' });
    return res;
  } catch (e) {
    console.error('Chat session error:', e);
    return NextResponse.json({ success: false, error: 'Failed to get session.' }, { status: 500 });
  }
}
