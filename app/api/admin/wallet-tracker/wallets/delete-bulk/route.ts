import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isOwnerEmail } from '@/lib/auth';
import { prisma } from '@/lib/db';

const db = prisma as unknown as {
  trackedWallet?: { deleteMany: (args: { where: { address: string } }) => Promise<{ count: number }> };
};

/** POST - Remove multiple tracked wallets by address. Body: { addresses: string[] }. Admin only. */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerEmail(session?.user?.email ?? null)) {
      return NextResponse.json({ success: false, error: 'Admin only.' }, { status: 403 });
    }
    const body = await request.json().catch(() => ({}));
    const raw = body.addresses;
    const addresses: string[] = Array.isArray(raw)
      ? raw.map((a: unknown) => String(a).trim()).filter((a: string) => a.length > 0)
      : [];
    if (addresses.length === 0) {
      return NextResponse.json({ success: false, error: 'At least one address is required in "addresses" array.' }, { status: 400 });
    }
    if (!db.trackedWallet) {
      return NextResponse.json({ success: true, deleted: 0, message: 'No tracked wallets in DB.' });
    }
    let deleted = 0;
    for (const address of addresses) {
      const result = await db.trackedWallet!.deleteMany({ where: { address } });
      deleted += result.count;
    }
    return NextResponse.json({
      success: true,
      deleted,
      message: `${deleted} wallet(s) removed.`,
    });
  } catch (e) {
    console.error('Admin wallet-tracker wallets delete-bulk:', e);
    return NextResponse.json({ success: false, error: 'Failed to remove wallets.' }, { status: 500 });
  }
}
