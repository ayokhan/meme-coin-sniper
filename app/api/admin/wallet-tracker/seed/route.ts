import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isOwnerEmail } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { TRACKED_WALLETS } from '@/lib/config/ct-wallets';

/** POST - Seed tracked wallets and alert rules from config if DB is empty. Admin only. */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerEmail(session?.user?.email ?? null)) {
      return NextResponse.json({ success: false, error: 'Admin only.' }, { status: 403 });
    }
    const existing = await prisma.trackedWallet.count();
    if (existing > 0) {
      return NextResponse.json({ success: true, message: 'Already seeded.', count: existing });
    }
    for (const w of TRACKED_WALLETS) {
      await prisma.trackedWallet.upsert({
        where: { address: w.address },
        create: { address: w.address, label: w.label },
        update: {},
      });
    }
    await prisma.alertRule.upsert({
      where: { key: 'wallet_tracker' },
      create: { key: 'wallet_tracker', minBuyers: 3, maxAgeHours: 24, maxAlerts: 30 },
      update: {},
    });
    return NextResponse.json({
      success: true,
      message: `Seeded ${TRACKED_WALLETS.length} wallets and default rules.`,
      count: TRACKED_WALLETS.length,
    });
  } catch (e) {
    console.error('Admin wallet-tracker seed:', e);
    return NextResponse.json({ success: false, error: 'Seed failed.' }, { status: 500 });
  }
}
