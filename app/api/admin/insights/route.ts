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
    const dateParam = url.searchParams.get('date'); // YYYY-MM-DD for single-day view
    let since: Date;
    let singleDate: string | null = null;
    let days = 30;
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      singleDate = dateParam;
      since = new Date(dateParam + 'T00:00:00.000Z');
      const end = new Date(since);
      end.setUTCDate(end.getUTCDate() + 1);
      const events = await prisma.analyticsEvent.findMany({
        where: { createdAt: { gte: since, lt: end } },
        orderBy: { createdAt: 'desc' },
        take: 50000,
      }) as Array<{ path: string; country: string | null; city: string | null; deviceType: string | null; browser: string | null; os: string | null; createdAt: Date }>;
      const byCountry: Record<string, number> = {};
      const byCity: Record<string, number> = {};
      const byDate: Record<string, number> = {};
      const byDevice: Record<string, number> = {};
      const byPath: Record<string, number> = {};
      const byBrowser: Record<string, number> = {};
      const byOs: Record<string, number> = {};
      let total = 0;
      for (const e of events) {
        total++;
        const dateKey = e.createdAt.toISOString().slice(0, 10);
        byDate[dateKey] = (byDate[dateKey] ?? 0) + 1;
        const c = e.country ?? 'Unknown';
        byCountry[c] = (byCountry[c] ?? 0) + 1;
        const cityLabel = e.city && e.country ? `${e.city}, ${e.country}` : e.city ?? (e.country ? `Unknown, ${e.country}` : null);
        if (cityLabel) byCity[cityLabel] = (byCity[cityLabel] ?? 0) + 1;
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
        days: 0,
        all: false,
        date: singleDate,
        total,
        byCountry: Object.entries(byCountry).sort(sortByCount),
        byCity: Object.entries(byCity).sort(sortByCount),
        byDate: Object.entries(byDate).sort((a, b) => b[0].localeCompare(a[0])),
        byDevice: Object.entries(byDevice).sort(sortByCount),
        byPath: Object.entries(byPath).sort(sortByCount),
        byBrowser: Object.entries(byBrowser).sort(sortByCount),
        byOs: Object.entries(byOs).sort(sortByCount),
      });
    }
    const allParam = url.searchParams.get('all');
    if (allParam === '1' || allParam === 'true') {
      const events = await prisma.analyticsEvent.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50000,
      }) as Array<{ path: string; country: string | null; city: string | null; deviceType: string | null; browser: string | null; os: string | null; createdAt: Date }>;
      const byCountry: Record<string, number> = {};
      const byCity: Record<string, number> = {};
      const byDate: Record<string, number> = {};
      const byDevice: Record<string, number> = {};
      const byPath: Record<string, number> = {};
      const byBrowser: Record<string, number> = {};
      const byOs: Record<string, number> = {};
      let total = 0;
      for (const e of events) {
        total++;
        const dateKey = e.createdAt.toISOString().slice(0, 10);
        byDate[dateKey] = (byDate[dateKey] ?? 0) + 1;
        const c = e.country ?? 'Unknown';
        byCountry[c] = (byCountry[c] ?? 0) + 1;
        const cityLabel = e.city && e.country ? `${e.city}, ${e.country}` : e.city ?? (e.country ? `Unknown, ${e.country}` : null);
        if (cityLabel) byCity[cityLabel] = (byCity[cityLabel] ?? 0) + 1;
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
      const byDateSorted = Object.entries(byDate).sort((a, b) => b[0].localeCompare(a[0]));
      return NextResponse.json({
        success: true,
        days: -1,
        all: true,
        date: null,
        total,
        byCountry: Object.entries(byCountry).sort(sortByCount),
        byCity: Object.entries(byCity).sort(sortByCount),
        byDate: byDateSorted,
        byDevice: Object.entries(byDevice).sort(sortByCount),
        byPath: Object.entries(byPath).sort(sortByCount),
        byBrowser: Object.entries(byBrowser).sort(sortByCount),
        byOs: Object.entries(byOs).sort(sortByCount),
      });
    }
    days = Math.min(90, Math.max(1, parseInt(url.searchParams.get('days') ?? '30', 10) || 30));
    since = new Date();
    since.setDate(since.getDate() - days);

    const events = await prisma.analyticsEvent.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 50000,
    }) as Array<{ path: string; country: string | null; city: string | null; deviceType: string | null; browser: string | null; os: string | null; createdAt: Date }>;

    const byCountry: Record<string, number> = {};
    const byCity: Record<string, number> = {};
    const byDate: Record<string, number> = {};
    const byDevice: Record<string, number> = {};
    const byPath: Record<string, number> = {};
    const byBrowser: Record<string, number> = {};
    const byOs: Record<string, number> = {};
    let total = 0;
    for (const e of events) {
      total++;
      const dateKey = e.createdAt.toISOString().slice(0, 10); // YYYY-MM-DD
      byDate[dateKey] = (byDate[dateKey] ?? 0) + 1;
      const c = e.country ?? 'Unknown';
      byCountry[c] = (byCountry[c] ?? 0) + 1;
      const cityLabel = e.city && e.country ? `${e.city}, ${e.country}` : e.city ?? (e.country ? `Unknown, ${e.country}` : null);
      if (cityLabel) {
        byCity[cityLabel] = (byCity[cityLabel] ?? 0) + 1;
      }
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
    const byDateSorted = Object.entries(byDate).sort((a, b) => b[0].localeCompare(a[0])); // newest date first
    return NextResponse.json({
      success: true,
      days,
      all: false,
      date: null,
      total,
      byCountry: Object.entries(byCountry).sort(sortByCount),
      byCity: Object.entries(byCity).sort(sortByCount),
      byDate: byDateSorted,
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
