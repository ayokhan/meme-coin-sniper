import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isOwnerEmail } from '@/lib/auth';
import { prisma } from '@/lib/db';

const db = prisma as unknown as {
  trackedWallet?: {
    findMany: (args: { orderBy: { createdAt: string } }) => Promise<Array<{ id: string; address: string; label: string | null; firstBuyEnabled: boolean }>>;
    findUnique: (args: { where: { address: string } }) => Promise<{ id: string } | null>;
    create: (args: { data: { address: string; label?: string | null; firstBuyEnabled?: boolean } }) => Promise<unknown>;
    updateMany: (args: { where: { address: string }; data: { firstBuyEnabled: boolean } }) => Promise<unknown>;
    deleteMany: (args: { where: { address: string } }) => Promise<unknown>;
  };
};

function isValidSolanaAddress(addr: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr.trim());
}

/** GET - List tracked wallets. Admin only. */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerEmail(session?.user?.email ?? null)) {
      return NextResponse.json({ success: false, error: 'Admin only.' }, { status: 403 });
    }
    const rows = db.trackedWallet ? await db.trackedWallet.findMany({ orderBy: { createdAt: 'asc' } }) : [];
    const wallets = rows.map((r) => ({ id: r.id, address: r.address, label: r.label, firstBuyEnabled: r.firstBuyEnabled ?? true }));
    return NextResponse.json({ success: true, wallets });
  } catch (e) {
    console.error('Admin wallet-tracker wallets GET:', e);
    return NextResponse.json({ success: false, error: 'Failed to load wallets.' }, { status: 500 });
  }
}

/** POST - Add a tracked wallet. Admin only. */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerEmail(session?.user?.email ?? null)) {
      return NextResponse.json({ success: false, error: 'Admin only.' }, { status: 403 });
    }
    const body = await request.json().catch(() => ({}));
    const address = (body.address ?? '').trim();
    const label = typeof body.label === 'string' ? body.label.trim() || null : null;
    if (!address) {
      return NextResponse.json({ success: false, error: 'Address is required.' }, { status: 400 });
    }
    if (!isValidSolanaAddress(address)) {
      return NextResponse.json({ success: false, error: 'Invalid Solana address.' }, { status: 400 });
    }
    const existing = db.trackedWallet ? await db.trackedWallet.findUnique({ where: { address } }) : null;
    if (existing) {
      return NextResponse.json({ success: false, error: 'Wallet already tracked.' }, { status: 400 });
    }
    if (db.trackedWallet) await db.trackedWallet.create({ data: { address, label, firstBuyEnabled: true } });
    return NextResponse.json({ success: true, message: 'Wallet added.' });
  } catch (e) {
    console.error('Admin wallet-tracker wallets POST:', e);
    return NextResponse.json({ success: false, error: 'Failed to add wallet.' }, { status: 500 });
  }
}

/** PATCH - Update first-buy alert for one wallet. Body: { address, firstBuyEnabled }. Admin only. */
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerEmail(session?.user?.email ?? null)) {
      return NextResponse.json({ success: false, error: 'Admin only.' }, { status: 403 });
    }
    const body = await request.json().catch(() => ({}));
    const address = (body.address ?? '').trim();
    const firstBuyEnabled = typeof body.firstBuyEnabled === 'boolean' ? body.firstBuyEnabled : undefined;
    if (!address) {
      return NextResponse.json({ success: false, error: 'Address is required.' }, { status: 400 });
    }
    if (firstBuyEnabled === undefined) {
      return NextResponse.json({ success: false, error: 'firstBuyEnabled (boolean) is required.' }, { status: 400 });
    }
    if (db.trackedWallet) await db.trackedWallet.updateMany({ where: { address }, data: { firstBuyEnabled } });
    return NextResponse.json({ success: true, message: 'Updated.', firstBuyEnabled });
  } catch (e) {
    console.error('Admin wallet-tracker wallets PATCH:', e);
    return NextResponse.json({ success: false, error: 'Failed to update.' }, { status: 500 });
  }
}

/** DELETE - Remove a tracked wallet. Admin only. Query: ?address=xxx */
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerEmail(session?.user?.email ?? null)) {
      return NextResponse.json({ success: false, error: 'Admin only.' }, { status: 403 });
    }
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address')?.trim();
    if (!address) {
      return NextResponse.json({ success: false, error: 'Address is required.' }, { status: 400 });
    }
    if (db.trackedWallet) await db.trackedWallet.deleteMany({ where: { address } });
    return NextResponse.json({ success: true, message: 'Wallet removed.' });
  } catch (e) {
    console.error('Admin wallet-tracker wallets DELETE:', e);
    return NextResponse.json({ success: false, error: 'Failed to remove wallet.' }, { status: 500 });
  }
}
