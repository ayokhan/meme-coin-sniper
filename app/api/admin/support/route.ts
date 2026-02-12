import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isOwnerEmail } from '@/lib/auth';
import { prisma } from '@/lib/db';

/** GET - List all support tickets. Owner-only. */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email ?? null;
    if (!email) {
      return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
    }
    if (!isOwnerEmail(email)) {
      return NextResponse.json({ success: false, error: 'Not authorized. Only owners can view support tickets.' }, { status: 403 });
    }

    const tickets = await prisma.supportTicket.findMany({
      orderBy: { createdAt: 'desc' },
    });

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
        createdAt: t.createdAt,
      })),
    });
  } catch (e) {
    console.error('Admin support list error:', e);
    return NextResponse.json({ success: false, error: 'Failed to load tickets.' }, { status: 500 });
  }
}
