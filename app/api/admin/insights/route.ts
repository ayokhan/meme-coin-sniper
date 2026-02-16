import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isOwnerSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

/** GET - Aggregated app insights (country, device, path). Owner-only. */
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerSession(session)) {
      return NextResponse.json({ success: false, error: 'Not authorized.' }, { status: 403 });
    }

    const url = new URL(req.url);
    const days = Math.min(90, Math.max(1, parseInt(url.searchParams.get('days') ?? '30', 10) || 30));
    const since = new Date();
    since.setDate(since.getDate() - days);

    const events = await prisma.analyticsEvent.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 50000,
    }) as Array<{ path: string; country: string | null; deviceType: string | null; browser: string | null; os: string | null; createdAt: Date }>;

    const byCountry: Record<string, number> = {};
    const byDevice: Record<string, number> = {};
    const byPath: Record<string, number> = {};
    const byBrowser: Record<string, number> = {};
    const byOs: Record<string, number> = {};
    let total = 0;
    for (const e of events) {
      total++;
      const c = e.country ?? 'Unknown';
      byCountry[c] = (byCountry[c] ?? 0) + 1;
      const d = e.deviceType ?? 'Unknown';
      byDevice[d] = (byDevice[d] ?? 0) + 1;
      const p = e.path || '/';
      byPath[p] = (byPath[p] ?? 0) + 1;
      const b = e.browser ?? 'Unknown';
      byBrowser[b] = (byBrowser[b] ?? 0) + 1;
      const o = e.os ?? 'Unknown';
      byOs[o] = (byOs[o] ?? 0) + 1;
    }

    const sortByCount = (a: [string, number], b: [string, number]) => b[1] - a[1];
    return NextResponse.json({
      success: true,
      days,
      total,
      byCountry: Object.entries(byCountry).sort(sortByCount),
      byDevice: Object.entries(byDevice).sort(sortByCount),
      byPath: Object.entries(byPath).sort(sortByCount),
      byBrowser: Object.entries(byBrowser).sort(sortByCount),
      byOs: Object.entries(byOs).sort(sortByCount),
    });
  } catch (e) {
    console.error('Admin insights error:', e);
    return NextResponse.json({ success: false, error: 'Failed to load insights.' }, { status: 500 });
  }
}
