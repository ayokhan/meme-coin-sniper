import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isOwnerSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

/** GET - Get current user's Telegram ID (if set), or list all (owner only). */
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email && !session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
    }
    const url = new URL(req.url);
    const list = url.searchParams.get('list') === 'true';
    if (list && isOwnerSession(session)) {
      const rows = await prisma.userTelegram.findMany({
        include: { user: { select: { email: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json({
        success: true,
        list: rows.map((r) => ({
          userId: r.userId,
          telegramId: r.telegramId,
          email: (r.user as { email: string | null }).email,
          name: (r.user as { name: string | null }).name,
          createdAt: r.createdAt,
        })),
      });
    }
    const userId = (session.user as { id?: string }).id;
    if (!userId) {
      return NextResponse.json({ success: true, telegramId: null });
    }
    const row = await prisma.userTelegram.findUnique({ where: { userId } });
    return NextResponse.json({ success: true, telegramId: row?.telegramId ?? null });
  } catch (e) {
    console.error('Telegram ID get error:', e);
    return NextResponse.json({ success: false, error: 'Failed to load.' }, { status: 500 });
  }
}

/** POST - Set Telegram ID for current user (e.g. @username or numeric id). */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;
    if (!session?.user || !userId) {
      return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
    }
    const body = await req.json().catch(() => ({}));
    const telegramId = typeof body.telegramId === 'string' ? body.telegramId.trim() : '';
    if (!telegramId) {
      return NextResponse.json({ success: false, error: 'Telegram ID is required (e.g. @username or your numeric ID).' }, { status: 400 });
    }
    await prisma.userTelegram.upsert({
      where: { userId },
      create: { userId, telegramId },
      update: { telegramId },
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Telegram ID save error:', e);
    return NextResponse.json({ success: false, error: 'Failed to save.' }, { status: 500 });
  }
}
