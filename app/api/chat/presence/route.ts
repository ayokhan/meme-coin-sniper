import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isOwnerSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

const ONLINE_MS = 5 * 60 * 1000; // 5 min

/** GET - Check if live support agent is online */
export async function GET() {
  try {
    const row = await prisma.agentPresence.findUnique({ where: { id: 'default' } });
    const online = row ? Date.now() - row.lastSeenAt.getTime() < ONLINE_MS : false;
    return NextResponse.json({ online });
  } catch (e) {
    console.error('Chat presence get error:', e);
    return NextResponse.json({ online: false });
  }
}

/** POST - Agent heartbeat (owner only). Call every ~20s when dashboard or admin chat is open. */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerSession(session)) {
      return NextResponse.json({ success: false, error: 'Not authorized.' }, { status: 403 });
    }
    const now = new Date();
    await prisma.agentPresence.upsert({
      where: { id: 'default' },
      create: { id: 'default', lastSeenAt: now },
      update: { lastSeenAt: now },
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Chat presence post error:', e);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
