import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isOwnerEmail } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getFeatureFlag, FEATURE_FLAG_KEYS } from '@/lib/feature-flags';
import { FIRST_BUY_LOOKBACK_MINUTES } from '@/lib/wallet-tracker-config';

const KEY = 'first_buy';
const ALLOWED_LOOKBACK = new Set(FIRST_BUY_LOOKBACK_MINUTES);

type PrismaWithAlertRule = typeof prisma & {
  alertRule?: {
    findUnique: (args: { where: { key: string } }) => Promise<{ maxAgeHours: number; maxAlerts: number } | null>;
    upsert: (args: unknown) => Promise<unknown>;
  };
};

/** GET - First-buy alert rules and feature flag (owner only). */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerEmail(session?.user?.email ?? null)) {
      return NextResponse.json({ success: false, error: 'Admin only.' }, { status: 403 });
    }
    const db = prisma as unknown as PrismaWithAlertRule;
    const [row, firstBuyEnabled] = await Promise.all([
      db.alertRule ? db.alertRule.findUnique({ where: { key: KEY } }) : null,
      getFeatureFlag(FEATURE_FLAG_KEYS.OWNER_FIRST_BUY_ALERTS),
    ]);
    const raw = row?.maxAgeHours;
    const lookbackMinutes = (raw != null && (FIRST_BUY_LOOKBACK_MINUTES as readonly number[]).includes(raw)) ? raw : 15;
    const rules = row
      ? { lookbackMinutes, maxAlerts: row.maxAlerts }
      : { lookbackMinutes: 15, maxAlerts: 50 };
    return NextResponse.json({ success: true, rules, firstBuyEnabled });
  } catch (e) {
    console.error('Admin first-buy rules GET:', e);
    return NextResponse.json({ success: false, error: 'Failed to load rules.' }, { status: 500 });
  }
}

/** PUT - Update first-buy rules (owner only). */
export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerEmail(session?.user?.email ?? null)) {
      return NextResponse.json({ success: false, error: 'Admin only.' }, { status: 403 });
    }
    const body = await request.json().catch(() => ({}));
    const lookbackMinutes = typeof body.lookbackMinutes === 'number' && ALLOWED_LOOKBACK.has(body.lookbackMinutes) ? body.lookbackMinutes : undefined;
    const maxAlerts = typeof body.maxAlerts === 'number' ? Math.max(5, Math.min(200, Math.round(body.maxAlerts))) : undefined;
    const db = prisma as unknown as PrismaWithAlertRule;
    if (db.alertRule) {
      await db.alertRule.upsert({
        where: { key: KEY },
        create: {
          key: KEY,
          minBuyers: 1,
          maxAgeHours: lookbackMinutes ?? 15,
          maxAlerts: maxAlerts ?? 50,
        },
        update: {
          ...(lookbackMinutes != null && { maxAgeHours: lookbackMinutes }),
          ...(maxAlerts != null && { maxAlerts }),
        },
      } as { where: { key: string }; create: { key: string; minBuyers: number; maxAgeHours: number; maxAlerts: number }; update: { maxAgeHours?: number; maxAlerts?: number } });
    }
    return NextResponse.json({ success: true, message: 'First-buy rules updated.' });
  } catch (e) {
    console.error('Admin first-buy rules PUT:', e);
    return NextResponse.json({ success: false, error: 'Failed to update rules.' }, { status: 500 });
  }
}
