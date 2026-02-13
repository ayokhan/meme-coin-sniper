import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isOwnerSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

const VALID_STATUSES = ['new', 'pending', 'assigned', 'open', 'resolved'] as const;

/** GET - List all support tickets. Owner-only. */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
    }
    if (!isOwnerSession(session)) {
      return NextResponse.json({ success: false, error: 'Not authorized. Only owners can view support tickets.' }, { status: 403 });
    }

    const tickets = await prisma.supportTicket.findMany({
      orderBy: { createdAt: 'desc' },
    }) as Array<{ id: string; supportNumber: string; title: string; message: string; name: string; email: string; source: string; status: string; createdAt: Date }>;

    return NextResponse.json({
      success: true,
      tickets: tickets.map((t) => ({
        id: t.id,
        supportNumber: t.supportNumber,
        title: t.title,
        message: t.message,
        name: t.name,
        email: t.email,
        source: t.source,
        status: t.status ?? 'new',
        createdAt: t.createdAt,
      })),
    });
  } catch (e) {
    console.error('Admin support list error:', e);
    return NextResponse.json({ success: false, error: 'Failed to load tickets.' }, { status: 500 });
  }
}

/** PATCH - Update support ticket status. Owner-only. */
export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
    }
    if (!isOwnerSession(session)) {
      return NextResponse.json({ success: false, error: 'Not authorized.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const ticketId = typeof body.ticketId === 'string' ? body.ticketId.trim() : '';
    const status = typeof body.status === 'string' ? body.status.trim().toLowerCase() : '';
    if (!ticketId) {
      return NextResponse.json({ success: false, error: 'ticketId required.' }, { status: 400 });
    }
    if (!VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
      return NextResponse.json({ success: false, error: `status must be one of: ${VALID_STATUSES.join(', ')}.` }, { status: 400 });
    }

    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Admin support PATCH error:', e);
    return NextResponse.json({ success: false, error: 'Failed to update ticket.' }, { status: 500 });
  }
}

/** DELETE - Delete a support ticket (removes from DB). Owner-only. */
export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
    }
    if (!isOwnerSession(session)) {
      return NextResponse.json({ success: false, error: 'Not authorized.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const ticketId = typeof body.ticketId === 'string' ? body.ticketId.trim() : '';
    if (!ticketId) {
      return NextResponse.json({ success: false, error: 'ticketId required.' }, { status: 400 });
    }

    await prisma.supportTicket.delete({
      where: { id: ticketId },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Admin support DELETE error:', e);
    return NextResponse.json({ success: false, error: 'Failed to delete ticket.' }, { status: 500 });
  }
}
