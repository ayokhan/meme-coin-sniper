import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

const ONLINE_MS = 2 * 60 * 1000;

function generateSupportNumber(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = 'NV-SUP-';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

/** POST - Request live agent. If agent online -> status=live. Else create support ticket and status=submitted. */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { sessionId, customerName, customerEmail, preferSubmit } = body as {
      sessionId?: string;
      customerName?: string;
      customerEmail?: string;
      preferSubmit?: boolean;
    };
    const sid = typeof sessionId === 'string' ? sessionId.trim() : '';
    if (!sid) {
      return NextResponse.json({ success: false, error: 'sessionId required.' }, { status: 400 });
    }
    const wantTicketOnly = !!preferSubmit;

    const session = await prisma.chatSession.findUnique({
      where: { id: sid },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    }) as { status: string; customerName: string | null; customerEmail: string | null; messages: Array<{ role: string; content: string }> } | null;
    if (!session) {
      return NextResponse.json({ success: false, error: 'Session not found.' }, { status: 404 });
    }
    if (session.status === 'submitted') {
      return NextResponse.json({ success: false, error: 'Already submitted.' }, { status: 400 });
    }

    const name = (typeof customerName === 'string' ? customerName.trim() : '') || session.customerName || 'Customer';
    const email = (typeof customerEmail === 'string' ? customerEmail.trim() : '') || session.customerEmail || '';

    const presence = await prisma.agentPresence.findUnique({ where: { id: 'default' } });
    const online = !wantTicketOnly && (presence ? Date.now() - presence.lastSeenAt.getTime() < ONLINE_MS : false);

    if (online) {
      await prisma.chatSession.update({ where: { id: sid }, data: { status: 'live', customerName: name, customerEmail: email || undefined } });
      return NextResponse.json({ success: true, transferred: true });
    }

    const customerMessages = session.messages.filter((m) => m.role === 'customer');
    const summary = customerMessages.length
      ? customerMessages.map((m) => m.content).join('\n')
      : 'No message content';
    const lastCustomer = customerMessages[customerMessages.length - 1];
    const title = lastCustomer?.content.slice(0, 80) || 'Chat support request';

    let supportNumber = generateSupportNumber();
    let exists = await prisma.supportTicket.findUnique({ where: { supportNumber } });
    while (exists) {
      supportNumber = generateSupportNumber();
      exists = await prisma.supportTicket.findUnique({ where: { supportNumber } });
    }

    await prisma.$transaction([
      prisma.supportTicket.create({
        data: {
          supportNumber,
          title,
          message: summary,
          name,
          email: email || 'no-email@chat.novastaris',
          source: 'chat',
        },
      }),
      prisma.chatSession.update({
        where: { id: sid },
        data: { status: 'submitted', customerName: name, customerEmail: email || undefined },
      }),
    ]);

    return NextResponse.json({ success: true, transferred: false, supportNumber });
  } catch (e) {
    console.error('Request live error:', e);
    return NextResponse.json({ success: false, error: 'Failed to process request.' }, { status: 500 });
  }
}
