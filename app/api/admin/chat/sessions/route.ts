import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { canAccessLiveChatAgentSession, canDeleteAdminChatSession } from '@/lib/admin-access';
import { prisma } from '@/lib/db';

/** GET - List chat sessions (nja and live). Owner or live chat agent admin. */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!canAccessLiveChatAgentSession(session)) {
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
      messages: Array<{ id: string; role: string; content: string; agentDisplayName: string | null; createdAt: Date }>;
    }>;

    return NextResponse.json({
      success: true,
      canDelete: canDeleteAdminChatSession(session),
      sessions: sessions.map((s) => ({
        id: s.id,
        status: s.status,
        customerName: s.customerName,
        customerEmail: s.customerEmail,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        messages: s.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          agentDisplayName: m.agentDisplayName,
          createdAt: m.createdAt,
        })),
      })),
    });
  } catch (e) {
    console.error('Admin chat sessions error:', e);
    return NextResponse.json({ success: false, error: 'Failed to load sessions.' }, { status: 500 });
  }
}

/** DELETE - Delete a chat session and all its messages. Owner only. */
export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!canDeleteAdminChatSession(session)) {
      return NextResponse.json({ success: false, error: 'Not authorized.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
    if (!sessionId) {
      return NextResponse.json({ success: false, error: 'sessionId required.' }, { status: 400 });
    }

    await prisma.chatSession.delete({
      where: { id: sessionId },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Admin chat sessions DELETE error:', e);
    return NextResponse.json({ success: false, error: 'Failed to delete chat.' }, { status: 500 });
  }
}
