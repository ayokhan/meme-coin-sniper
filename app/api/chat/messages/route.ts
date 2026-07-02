import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { DEFAULT_SUPPORT_AGENT_NAME } from '@/lib/support-agent';

/** GET - List messages for a session. ?sessionId= */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');
    if (!sessionId) {
      return NextResponse.json({ success: false, error: 'sessionId required.' }, { status: 400 });
    }
    const messages = await prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    }) as Array<{ id: string; role: string; content: string; agentDisplayName: string | null; createdAt: Date }>;
    return NextResponse.json({
      success: true,
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        agentDisplayName: m.role === 'agent' ? (m.agentDisplayName ?? DEFAULT_SUPPORT_AGENT_NAME) : null,
        createdAt: m.createdAt,
      })),
    });
  } catch (e) {
    console.error('Chat messages error:', e);
    return NextResponse.json({ success: false, error: 'Failed to load messages.' }, { status: 500 });
  }
}
