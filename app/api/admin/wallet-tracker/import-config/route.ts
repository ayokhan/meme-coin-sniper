import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isOwnerEmail } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { TRACKED_WALLETS } from '@/lib/config/ct-wallets';

const db = prisma as unknown as {
  trackedWallet?: {
    upsert: (args: {
      where: { address: string };
      create: { address: string; label?: string | null };
      update: { label?: string | null };
    }) => Promise<unknown>;
  };
};

/** POST - Import all wallets from config into DB (upsert: add missing, update labels). Does not remove existing DB wallets. Admin only. */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerEmail(session?.user?.email ?? null)) {
      return NextResponse.json({ success: false, error: 'Admin only.' }, { status: 403 });
    }
    if (!db.trackedWallet) {
      return NextResponse.json({ success: false, error: 'Wallet tracker table not available.' }, { status: 503 });
    }
    let added = 0;
    for (const w of TRACKED_WALLETS) {
      await db.trackedWallet!.upsert({
        where: { address: w.address },
        create: { address: w.address, label: w.label ?? null },
        update: { label: w.label ?? null },
      });
      added++;
    }
    return NextResponse.json({
      success: true,
      message: `Imported ${added} wallets from config. Existing wallets kept; new ones added.`,
      count: added,
    });
  } catch (e) {
    console.error('Admin wallet-tracker import-config:', e);
    return NextResponse.json({ success: false, error: 'Import failed.' }, { status: 500 });
  }
}
