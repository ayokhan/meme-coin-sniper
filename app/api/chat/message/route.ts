import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/** POST - Add a message (role: customer or nja). Optionally update session customerName/customerEmail. */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { sessionId, role, content, customerName, customerEmail } = body as {
      sessionId?: string;
      role?: string;
      content?: string;
      customerName?: string;
      customerEmail?: string;
    };
    const sid = typeof sessionId === 'string' ? sessionId.trim() : '';
    const r = role === 'nja' ? 'nja' : 'customer';
    const text = typeof content === 'string' ? content.trim() : '';
    if (!sid || !text) {
      return NextResponse.json({ success: false, error: 'sessionId and content required.' }, { status: 400 });
    }

    const session = await prisma.chatSession.findUnique({ where: { id: sid } });
    if (!session) {
      return NextResponse.json({ success: false, error: 'Session not found.' }, { status: 404 });
    }
    if (session.status === 'submitted') {
      return NextResponse.json({ success: false, error: 'This conversation has been submitted.' }, { status: 400 });
    }

    const updateData: { customerName?: string; customerEmail?: string } = {};
    if (typeof customerName === 'string' && customerName.trim()) updateData.customerName = customerName.trim();
    if (typeof customerEmail === 'string' && customerEmail.trim()) updateData.customerEmail = customerEmail.trim();

    await prisma.$transaction([
      ...(Object.keys(updateData).length
        ? [prisma.chatSession.update({ where: { id: sid }, data: updateData })]
        : []),
      prisma.chatMessage.create({
        data: { sessionId: sid, role: r, content: text },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Chat message error:', e);
    return NextResponse.json({ success: false, error: 'Failed to send message.' }, { status: 500 });
  }
}
