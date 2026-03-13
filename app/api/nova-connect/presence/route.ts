import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getFeatureFlag, FEATURE_FLAG_KEYS } from '@/lib/feature-flags';

/** POST - heartbeat to update presence. Body: { status?: "online" | "away" | "busy" | "offline" } */
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
    const rawStatus = typeof body.status === 'string' ? body.status.trim().toLowerCase() : '';
    const status = ['online', 'away', 'busy', 'offline'].includes(rawStatus) ? rawStatus : 'online';
    const db = prisma as any;
    const now = new Date();
    await db.novaConnectPresence.upsert({
      where: { userId },
      create: { userId, status, lastSeenAt: now },
      update: { status, lastSeenAt: now },
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('NovaConnect presence POST error:', e);
    return NextResponse.json({ success: false, error: 'Failed to update presence.' }, { status: 500 });
  }
}

