import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isOwnerSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

const ONLINE_MS = 5 * 60 * 1000; // 5 min

/** GET - Check if live support agent is online (no cache so customers see current status). */
export async function GET() {
  try {
    const row = await prisma.agentPresence.findUnique({ where: { id: 'default' } });
    const online = row ? Date.now() - row.lastSeenAt.getTime() < ONLINE_MS : false;
    return NextResponse.json({ online }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (e) {
    console.error('Chat presence get error:', e);
    return NextResponse.json({ online: false }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  }
}

/** POST - Agent heartbeat (owner only). Body { offline: true } = mark agent offline now (e.g. on sign out). */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerSession(session)) {
      return NextResponse.json({ success: false, error: 'Not authorized.' }, { status: 403 });
    }
    let offline = false;
    try {
      const body = await req.json().catch(() => ({}));
      offline = !!body.offline;
    } catch {
      // no body
    }
    if (offline) {
      const past = new Date(Date.now() - ONLINE_MS - 60000);
      await prisma.agentPresence.upsert({
        where: { id: 'default' },
        create: { id: 'default', lastSeenAt: past },
        update: { lastSeenAt: past },
      });
      return NextResponse.json({ success: true, offline: true });
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
