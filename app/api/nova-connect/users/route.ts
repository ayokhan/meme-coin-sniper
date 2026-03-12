import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getFeatureFlag, FEATURE_FLAG_KEYS } from '@/lib/feature-flags';

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
    const meId = (session.user as { id: string }).id;
    const [users, presences] = await Promise.all([
      prisma.user.findMany({
        where: { novaConnectEnabled: true, novaConnectOptIn: true },
        select: {
          id: true,
          name: true,
          email: true,
          novaConnectDisplayName: true,
          novaConnectAvatarUrl: true,
          novaConnectStatus: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.novaConnectPresence.findMany({
        select: { userId: true, status: true, lastSeenAt: true },
      }),
    ]);
    const presenceByUser = new Map(presences.map((p) => [p.userId, p]));
    const now = Date.now();
    const result = users.map((u) => {
      const baseName = u.novaConnectDisplayName || u.name || u.email?.split('@')[0] || 'Trader';
      const p = presenceByUser.get(u.id);
      let status = u.novaConnectStatus || 'online';
      if (p) {
        const ageMs = now - p.lastSeenAt.getTime();
        if (ageMs > 10 * 60 * 1000) status = 'offline';
        else status = p.status;
      }
      return {
        id: u.id,
        displayName: baseName,
        avatarUrl: u.novaConnectAvatarUrl,
        status,
        me: u.id === meId,
      };
    });
    return NextResponse.json({ success: true, users: result });
  } catch (e) {
    console.error('NovaConnect users GET error:', e);
    return NextResponse.json({ success: false, error: 'Failed to load NovaConnect users.' }, { status: 500 });
  }
}

