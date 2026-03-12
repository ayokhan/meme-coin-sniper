import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getFeatureFlag, FEATURE_FLAG_KEYS } from '@/lib/feature-flags';

/** POST - Report a user or message in NovaConnect. Body: { reportedUserId, messageId?, reason, screenshotUrl? } */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
    }
    const novaConnectOn = await getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_CONNECT);
    if (!novaConnectOn) {
      return NextResponse.json({ success: false, error: 'NovaConnect is disabled.' }, { status: 403 });
    }
    const reporterUserId = (session.user as { id: string }).id;
    const body = await request.json().catch(() => ({}));
    const reportedUserId = typeof body.reportedUserId === 'string' ? body.reportedUserId.trim() : '';
    const messageId = typeof body.messageId === 'string' ? body.messageId.trim() || null : null;
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    const screenshotUrl = typeof body.screenshotUrl === 'string' ? body.screenshotUrl.trim() || null : null;

    if (!reportedUserId || !reason) {
      return NextResponse.json(
        { success: false, error: 'reportedUserId and reason are required.' },
        { status: 400 },
      );
    }

    const db = prisma as any;
    const reported = await db.user.findUnique({
      where: { id: reportedUserId },
      select: { id: true },
    });
    if (!reported) {
      return NextResponse.json({ success: false, error: 'Reported user not found.' }, { status: 404 });
    }

    if (messageId) {
      const msg = await db.novaConnectMessage.findUnique({
        where: { id: messageId },
        select: { id: true },
      });
      if (!msg) {
        return NextResponse.json({ success: false, error: 'Message not found.' }, { status: 404 });
      }
    }

    await db.novaConnectReport.create({
      data: {
        reporterUserId,
        reportedUserId,
        messageId,
        screenshotUrl,
        reason: reason.slice(0, 1000),
      },
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('NovaConnect report POST error:', e);
    return NextResponse.json({ success: false, error: 'Failed to submit report.' }, { status: 500 });
  }
}

