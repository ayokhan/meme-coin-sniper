import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getFeatureFlag, FEATURE_FLAG_KEYS } from '@/lib/feature-flags';

/** GET - List users this account has blocked on NovaConnect. */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
    }
    const novaConnectOn = await getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_CONNECT);
    if (!novaConnectOn) {
      return NextResponse.json({ success: false, error: 'NovaConnect is disabled.' }, { status: 403 });
    }
    const userId = (session.user as { id: string }).id;
    const db = prisma as any;
    const blocks = await db.novaConnectBlock.findMany({
      where: { blockerUserId: userId },
      select: { blockedUserId: true, createdAt: true },
    });
    return NextResponse.json({ success: true, blocks });
  } catch (e) {
    console.error('NovaConnect block GET error:', e);
    return NextResponse.json({ success: false, error: 'Failed to load block list.' }, { status: 500 });
  }
}

/** POST - Block a user. Body: { blockedUserId } */
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
    const userId = (session.user as { id: string }).id;
    const body = await request.json().catch(() => ({}));
    const blockedUserId = typeof body.blockedUserId === 'string' ? body.blockedUserId.trim() : '';
    if (!blockedUserId) {
      return NextResponse.json({ success: false, error: 'blockedUserId is required.' }, { status: 400 });
    }
    if (blockedUserId === userId) {
      return NextResponse.json({ success: false, error: 'You cannot block yourself.' }, { status: 400 });
    }
    const db = prisma as any;
    await db.novaConnectBlock.upsert({
      where: { blockerUserId_blockedUserId: { blockerUserId: userId, blockedUserId } },
      create: { blockerUserId: userId, blockedUserId },
      update: {},
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('NovaConnect block POST error:', e);
    return NextResponse.json({ success: false, error: 'Failed to block user.' }, { status: 500 });
  }
}

/** DELETE - Unblock a user. Body: { blockedUserId } */
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
    }
    const novaConnectOn = await getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_CONNECT);
    if (!novaConnectOn) {
      return NextResponse.json({ success: false, error: 'NovaConnect is disabled.' }, { status: 403 });
    }
    const userId = (session.user as { id: string }).id;
    const body = await request.json().catch(() => ({}));
    const blockedUserId = typeof body.blockedUserId === 'string' ? body.blockedUserId.trim() : '';
    if (!blockedUserId) {
      return NextResponse.json({ success: false, error: 'blockedUserId is required.' }, { status: 400 });
    }
    const db = prisma as any;
    await db.novaConnectBlock.deleteMany({
      where: { blockerUserId: userId, blockedUserId },
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('NovaConnect block DELETE error:', e);
    return NextResponse.json({ success: false, error: 'Failed to unblock user.' }, { status: 500 });
  }
}

