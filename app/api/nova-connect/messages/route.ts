import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getFeatureFlag, FEATURE_FLAG_KEYS } from '@/lib/feature-flags';

const PAGE_LIMIT = 100;

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get('scope') ?? 'community';
    const otherUserId = searchParams.get('userId');
    const take = Math.min(PAGE_LIMIT, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10) || 50));

    const userId = (session.user as { id: string }).id;
    if (scope === 'dm') {
      if (!otherUserId) {
        return NextResponse.json({ success: false, error: 'userId required for dm scope.' }, { status: 400 });
      }
      const db = prisma as any;
      const messages: any[] = await db.novaConnectMessage.findMany({
        where: {
          roomType: 'dm',
          deletedAt: null,
          OR: [
            { fromUserId: userId, toUserId: otherUserId },
            { fromUserId: otherUserId, toUserId: userId },
          ],
        },
        orderBy: { createdAt: 'asc' },
        take,
        include: {
          fromUser: { select: { id: true, name: true, email: true, novaConnectDisplayName: true } },
        },
      });
      return NextResponse.json({
        success: true,
        messages: messages.map((m) => ({
          id: m.id,
          roomType: m.roomType,
          fromUserId: m.fromUserId,
          toUserId: m.toUserId,
          content: m.content,
          imageUrl: m.imageUrl,
          createdAt: m.createdAt,
          fromDisplayName: m.fromUser.novaConnectDisplayName || m.fromUser.name || m.fromUser.email?.split('@')[0] || 'Trader',
        })),
      });
    }

    // community feed
    const db = prisma as any;
    const messages: any[] = await db.novaConnectMessage.findMany({
      where: {
        roomType: 'community',
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        fromUser: { select: { id: true, name: true, email: true, novaConnectDisplayName: true } },
      },
    });
    return NextResponse.json({
      success: true,
      messages: messages
        .slice()
        .reverse()
        .map((m) => ({
          id: m.id,
          roomType: m.roomType,
          fromUserId: m.fromUserId,
          content: m.content,
          imageUrl: m.imageUrl,
          createdAt: m.createdAt,
          fromDisplayName: m.fromUser.novaConnectDisplayName || m.fromUser.name || m.fromUser.email?.split('@')[0] || 'Trader',
        })),
    });
  } catch (e) {
    console.error('NovaConnect messages GET error:', e);
    return NextResponse.json({ success: false, error: 'Failed to load messages.' }, { status: 500 });
  }
}

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
    const isPaid = !!(session.user as { isPaid?: boolean }).isPaid;
    const body = await request.json().catch(() => ({}));
    const scope = typeof body.scope === 'string' ? body.scope : 'community';
    const content = typeof body.content === 'string' ? body.content.trim() : '';
    const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl.trim() : '';
    const toUserId = typeof body.toUserId === 'string' ? body.toUserId.trim() || null : null;

    const db = prisma as any;
    const me = await db.user.findUnique({
      where: { id: userId },
      select: { novaConnectOptIn: true, novaConnectEnabled: true },
    });
    if (!me || !me.novaConnectEnabled) {
      return NextResponse.json({ success: false, error: 'NovaConnect is disabled for this user.' }, { status: 403 });
    }
    if (!me.novaConnectOptIn) {
      return NextResponse.json({ success: false, error: 'You have left NovaConnect. Rejoin from profile to post.' }, { status: 403 });
    }
    if (!content && !imageUrl) {
      return NextResponse.json({ success: false, error: 'Message or image URL is required.' }, { status: 400 });
    }
    // Free users: can read but not send messages
    if (!isPaid) {
      return NextResponse.json(
        { success: false, error: 'Upgrade to Pro or VIP to post or message. Free users can read only.' },
        { status: 403 },
      );
    }

    if (scope === 'dm') {
      if (!toUserId) {
        return NextResponse.json({ success: false, error: 'toUserId required for private messages.' }, { status: 400 });
      }
      const other = await db.user.findUnique({
        where: { id: toUserId },
        select: { id: true, novaConnectEnabled: true, novaConnectOptIn: true },
      });
      if (!other || !other.novaConnectEnabled || !other.novaConnectOptIn) {
        return NextResponse.json({ success: false, error: 'User is not available on NovaConnect.' }, { status: 400 });
      }
      // Respect block lists: if either side has blocked the other, do not allow DM
      const block = await db.novaConnectBlock.findFirst({
        where: {
          OR: [
            { blockerUserId: userId, blockedUserId: toUserId },
            { blockerUserId: toUserId, blockedUserId: userId },
          ],
        },
      });
      if (block) {
        return NextResponse.json(
          { success: false, error: 'Direct messages are blocked between these users.' },
          { status: 403 },
        );
      }
      const msg = await db.novaConnectMessage.create({
        data: {
          roomType: 'dm',
          fromUserId: userId,
          toUserId,
          content,
          imageUrl: imageUrl || null,
        },
      });
      return NextResponse.json({ success: true, id: msg.id });
    }

    const msg = await db.novaConnectMessage.create({
      data: {
        roomType: 'community',
        fromUserId: userId,
        content,
        imageUrl: imageUrl || null,
      },
    });
    return NextResponse.json({ success: true, id: msg.id });
  } catch (e) {
    console.error('NovaConnect messages POST error:', e);
    return NextResponse.json({ success: false, error: 'Failed to send message.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
    }
    const userId = (session.user as { id: string }).id;
    const search = new URL(request.url);
    const messageId = search.searchParams.get('id');
    if (!messageId) {
      return NextResponse.json({ success: false, error: 'Message id required.' }, { status: 400 });
    }
    // Only owner (session.isOwner) or author can delete
    const isOwner = !!(session.user as { isOwner?: boolean }).isOwner;
    const db = prisma as any;
    const msg = await db.novaConnectMessage.findUnique({
      where: { id: messageId },
      select: { id: true, fromUserId: true },
    });
    if (!msg) {
      return NextResponse.json({ success: false, error: 'Message not found.' }, { status: 404 });
    }
    if (!isOwner && msg.fromUserId !== userId) {
      return NextResponse.json({ success: false, error: 'Not authorized to delete this message.' }, { status: 403 });
    }
    await db.novaConnectMessage.update({
      where: { id: messageId },
      data: { deletedAt: new Date(), deletedById: userId },
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('NovaConnect messages DELETE error:', e);
    return NextResponse.json({ success: false, error: 'Failed to delete message.' }, { status: 500 });
  }
}

