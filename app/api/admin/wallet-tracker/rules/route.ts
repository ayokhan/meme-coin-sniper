import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isOwnerEmail } from '@/lib/auth';
import { prisma } from '@/lib/db';

const KEY = 'wallet_tracker';
type PrismaWithAlertRule = typeof prisma & { alertRule?: { findUnique: (args: unknown) => Promise<{ minBuyers: number; maxAgeHours: number; maxAlerts: number } | null>; upsert: (args: unknown) => Promise<unknown> } };

/** GET - Get alert rules. Admin only. */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerEmail(session?.user?.email ?? null)) {
      return NextResponse.json({ success: false, error: 'Admin only.' }, { status: 403 });
    }
    const db = prisma as unknown as PrismaWithAlertRule;
    const row = db.alertRule ? await db.alertRule.findUnique({ where: { key: KEY } }) : null;
    const rules = row
      ? { minBuyers: row.minBuyers, maxAgeHours: row.maxAgeHours, maxAlerts: row.maxAlerts }
      : { minBuyers: 3, maxAgeHours: 24, maxAlerts: 30 };
    return NextResponse.json({ success: true, rules });
  } catch (e) {
    console.error('Admin wallet-tracker rules GET:', e);
    return NextResponse.json({ success: false, error: 'Failed to load rules.' }, { status: 500 });
  }
}

/** PUT - Update alert rules. Admin only. */
export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerEmail(session?.user?.email ?? null)) {
      return NextResponse.json({ success: false, error: 'Admin only.' }, { status: 403 });
    }
    const body = await request.json().catch(() => ({}));
    const minBuyers = typeof body.minBuyers === 'number' ? Math.max(1, Math.min(20, Math.round(body.minBuyers))) : undefined;
    const maxAgeHours = typeof body.maxAgeHours === 'number' ? Math.max(1, Math.min(168, Math.round(body.maxAgeHours))) : undefined;
    const maxAlerts = typeof body.maxAlerts === 'number' ? Math.max(5, Math.min(100, Math.round(body.maxAlerts))) : undefined;
    const db = prisma as unknown as PrismaWithAlertRule;
    if (db.alertRule) await db.alertRule.upsert({
      where: { key: KEY },
      create: {
        key: KEY,
        minBuyers: minBuyers ?? 3,
        maxAgeHours: maxAgeHours ?? 24,
        maxAlerts: maxAlerts ?? 30,
      },
      update: {
        ...(minBuyers != null && { minBuyers }),
        ...(maxAgeHours != null && { maxAgeHours }),
        ...(maxAlerts != null && { maxAlerts }),
      },
    });
    return NextResponse.json({ success: true, message: 'Rules updated.' });
  } catch (e) {
    console.error('Admin wallet-tracker rules PUT:', e);
    return NextResponse.json({ success: false, error: 'Failed to update rules.' }, { status: 500 });
  }
}
