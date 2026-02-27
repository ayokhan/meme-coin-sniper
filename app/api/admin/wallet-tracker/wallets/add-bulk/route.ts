import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isOwnerEmail } from '@/lib/auth';
import { prisma } from '@/lib/db';

const db = prisma as unknown as {
  trackedWallet?: {
    findUnique: (args: { where: { address: string } }) => Promise<{ id: string } | null>;
    create: (args: { data: { address: string; label?: string | null; firstBuyEnabled?: boolean; active?: boolean } }) => Promise<unknown>;
  };
};

function isValidSolanaAddress(addr: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr.trim());
}

/** POST - Add multiple tracked wallets. Body: { wallets: Array<{ address: string, label?: string }> }. Admin only. */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerEmail(session?.user?.email ?? null)) {
      return NextResponse.json({ success: false, error: 'Admin only.' }, { status: 403 });
    }
    const body = await request.json().catch(() => ({}));
    const raw = body.wallets;
    const items: { address: string; label?: string | null }[] = Array.isArray(raw)
      ? raw.map((w: unknown) => {
          if (typeof w === 'string') return { address: w.trim(), label: null };
          if (w && typeof w === 'object' && 'address' in w) return { address: String((w as { address: string }).address).trim(), label: (w as { label?: string }).label ?? null };
          if (w && typeof w === 'object' && 'trackedWalletAddress' in w) return { address: String((w as { trackedWalletAddress: string }).trackedWalletAddress).trim(), label: (w as { name?: string }).name ?? null };
          return { address: '', label: null };
        }).filter((x: { address: string }) => x.address.length > 0)
      : [];
    if (items.length === 0) {
      return NextResponse.json({ success: false, error: 'Provide a "wallets" array with at least one { address } or { trackedWalletAddress }.' }, { status: 400 });
    }
    if (!db.trackedWallet) {
      return NextResponse.json({ success: true, added: 0, skipped: items.length, message: 'No tracked wallets in DB.' });
    }
    let added = 0;
    let skipped = 0;
    for (const { address, label } of items) {
      if (!isValidSolanaAddress(address)) {
        skipped++;
        continue;
      }
      const existing = await db.trackedWallet!.findUnique({ where: { address } });
      if (existing) {
        skipped++;
        continue;
      }
      await db.trackedWallet!.create({
        data: { address, label: typeof label === 'string' ? label.trim() || null : null, firstBuyEnabled: true, active: true },
      });
      added++;
    }
    return NextResponse.json({
      success: true,
      added,
      skipped,
      message: `${added} wallet(s) added.${skipped > 0 ? ` ${skipped} skipped (invalid or already tracked).` : ''}`,
    });
  } catch (e) {
    console.error('Admin wallet-tracker wallets add-bulk:', e);
    return NextResponse.json({ success: false, error: 'Failed to add wallets.' }, { status: 500 });
  }
}
