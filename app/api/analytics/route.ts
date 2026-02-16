import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { parseUserAgent } from '@/lib/ua-parse';

/** POST - Record a page view (path, country, device). Called from client on navigation. */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const path = typeof body.path === 'string' ? body.path.trim().slice(0, 500) : '/';
    const country = (req.headers.get('x-vercel-ip-country') ?? req.headers.get('cf-ipcountry') ?? null) || null;
    const cityRaw = req.headers.get('x-vercel-ip-city') ?? req.headers.get('cf-ipcity') ?? null;
    const city = (typeof cityRaw === 'string' ? cityRaw.trim().slice(0, 200) : null) || null;
    const ua = req.headers.get('user-agent') ?? null;
    const { deviceType, browser, os } = parseUserAgent(ua);
    const session = await getServerSession(authOptions);
    const userId = session?.user ? (session.user as { id?: string }).id ?? null : null;

    await prisma.analyticsEvent.create({
      data: { path, country, city, deviceType, browser, os, userId },
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Analytics record error:', e);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
