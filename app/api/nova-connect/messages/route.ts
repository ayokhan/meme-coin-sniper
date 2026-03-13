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

    // community feed: top-level posts + replies
    const db = prisma as any;
    const topLevel: any[] = await db.novaConnectMessage.findMany({
      where: {
        roomType: 'community',
        deletedAt: null,
        parentMessageId: null,
      },
      orderBy: { createdAt: 'asc' },
      take,
      include: {
        fromUser: { select: { id: true, name: true, email: true, novaConnectDisplayName: true } },
      },
    });
    const parentIds = topLevel.map((m) => m.id);
    const replies: any[] = parentIds.length
      ? await db.novaConnectMessage.findMany({
          where: {
            roomType: 'community',
            deletedAt: null,
            parentMessageId: { in: parentIds },
          },
          orderBy: { createdAt: 'asc' },
          include: {
            fromUser: { select: { id: true, name: true, email: true, novaConnectDisplayName: true } },
          },
        })
      : [];
    const repliesByParent = new Map<string, any[]>();
    for (const r of replies) {
      const pid = r.parentMessageId;
      if (!repliesByParent.has(pid)) repliesByParent.set(pid, []);
      repliesByParent.get(pid)!.push(r);
    }
    const mapMsg = (m: any) => ({
      id: m.id,
      parentMessageId: m.parentMessageId ?? undefined,
      roomType: m.roomType,
      fromUserId: m.fromUserId,
      content: m.content,
      imageUrl: m.imageUrl,
      createdAt: m.createdAt,
      fromDisplayName: m.fromUser.novaConnectDisplayName || m.fromUser.name || m.fromUser.email?.split('@')[0] || 'Trader',
    });
    const messages = topLevel.slice().reverse().map((m) => ({
      ...mapMsg(m),
      replies: (repliesByParent.get(m.id) ?? []).map(mapMsg),
    }));
    return NextResponse.json({ success: true, messages });
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
    const isOwner = !!(session.user as { isOwner?: boolean }).isOwner;
    const novaConnectAllowedByAdmin = !!(session.user as { novaConnectAllowedByAdmin?: boolean }).novaConnectAllowedByAdmin;
    const canUseDm = isPaid || isOwner || novaConnectAllowedByAdmin;
    const body = await request.json().catch(() => ({}));
    const scope = typeof body.scope === 'string' ? body.scope : 'community';
    const content = typeof body.content === 'string' ? body.content.trim() : '';
    const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl.trim() : '';
    const toUserId = typeof body.toUserId === 'string' ? body.toUserId.trim() || null : null;
    const parentMessageId = typeof body.parentMessageId === 'string' ? body.parentMessageId.trim() || null : null;

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
    // DMs require Pro/VIP or owner or admin-allowed NovaConnect
    if (scope === 'dm' && !canUseDm) {
      return NextResponse.json(
        { success: false, error: 'Upgrade to Pro or VIP to chat with users, or ask an admin to allow NovaConnect for you.' },
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
        parentMessageId: scope === 'community' ? parentMessageId : null,
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
    const isOwner = !!(session.user as { isOwner?: boolean }).isOwner;
    const isCommunityRep = !!(session.user as { novaConnectCommunityRep?: boolean }).novaConnectCommunityRep;
    const db = prisma as any;
    const msg = await db.novaConnectMessage.findUnique({
      where: { id: messageId },
      select: { id: true, fromUserId: true, roomType: true },
    });
    if (!msg) {
      return NextResponse.json({ success: false, error: 'Message not found.' }, { status: 404 });
    }
    const isAuthor = msg.fromUserId === userId;
    const canDelete = isOwner || isAuthor || (isCommunityRep && msg.roomType === 'community');
    if (!canDelete) {
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

/** PATCH - Edit a message (author only for content; owner/rep can delete but not edit others). */
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
    }
    const userId = (session.user as { id: string }).id;
    const body = await request.json().catch(() => ({}));
    const messageId = typeof body.id === 'string' ? body.id.trim() : null;
    const content = typeof body.content === 'string' ? body.content.trim() : '';
    if (!messageId) {
      return NextResponse.json({ success: false, error: 'Message id required.' }, { status: 400 });
    }
    const db = prisma as any;
    const msg = await db.novaConnectMessage.findUnique({
      where: { id: messageId },
      select: { id: true, fromUserId: true, roomType: true, deletedAt: true },
    });
    if (!msg || msg.deletedAt) {
      return NextResponse.json({ success: false, error: 'Message not found.' }, { status: 404 });
    }
    if (msg.fromUserId !== userId) {
      return NextResponse.json({ success: false, error: 'Only the author can edit this message.' }, { status: 403 });
    }
    if (content.length === 0) {
      return NextResponse.json({ success: false, error: 'Content is required.' }, { status: 400 });
    }
    await db.novaConnectMessage.update({
      where: { id: messageId },
      data: { content },
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('NovaConnect messages PATCH error:', e);
    return NextResponse.json({ success: false, error: 'Failed to update message.' }, { status: 500 });
  }
}
