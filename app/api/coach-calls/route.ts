import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isOwnerSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { sendTelegramMessage, escapeHtml } from '@/lib/telegram';

/** GET - List coach calls (VIP or owner). Newest first. */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const tier = (session?.user as { tier?: 'pro' | 'vip' } | undefined)?.tier ?? null;
    const isVip = tier === 'vip';
    if (!session?.user || (!isVip && !isOwnerSession(session))) {
      return NextResponse.json({ success: false, error: 'VIP access required.' }, { status: 403 });
    }
    const calls = await prisma.coachCall.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({
      success: true,
      calls: calls.map((c) => ({
        id: c.id,
        title: c.title,
        content: c.content,
        createdAt: c.createdAt,
      })),
    });
  } catch (e) {
    console.error('Coach calls list error:', e);
    return NextResponse.json({ success: false, error: 'Failed to load.' }, { status: 500 });
  }
}

/** POST - Create coach call (owner or coach user). Sends Telegram notification if configured. */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const isCoachUser = !!(session?.user as { isCoachUser?: boolean } | undefined)?.isCoachUser;
    if (!isOwnerSession(session) && !isCoachUser) {
      return NextResponse.json({ success: false, error: 'Not authorized.' }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const title = typeof body.title === 'string' ? body.title.trim() : null;
    const content = typeof body.content === 'string' ? body.content.trim() : '';
    if (!content) {
      return NextResponse.json({ success: false, error: 'Content is required.' }, { status: 400 });
    }
    const call = await prisma.coachCall.create({
      data: { title: title || undefined, content },
    });
    const dateStr = new Date(call.createdAt).toLocaleString();
    const safeTitle = title ? escapeHtml(title) : '';
    const safeContent = escapeHtml(content);
    const telegramText = `📢 <b>Coach Call</b>\n${safeTitle ? `📌 ${safeTitle}\n` : ''}${safeContent}\n\n🕐 <em>${escapeHtml(dateStr)}</em>`;
    await sendTelegramMessage(telegramText);
    return NextResponse.json({
      success: true,
      call: { id: call.id, title: call.title, content: call.content, createdAt: call.createdAt },
    });
  } catch (e) {
    console.error('Coach call create error:', e);
    return NextResponse.json({ success: false, error: 'Failed to post.' }, { status: 500 });
  }
}

/** DELETE - Delete coach call (owner only). */
export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerSession(session)) {
      return NextResponse.json({ success: false, error: 'Not authorized.' }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const id = typeof body.id === 'string' ? body.id.trim() : '';
    if (!id) {
      return NextResponse.json({ success: false, error: 'id required.' }, { status: 400 });
    }
    await prisma.coachCall.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Coach call delete error:', e);
    return NextResponse.json({ success: false, error: 'Failed to delete.' }, { status: 500 });
  }
}
