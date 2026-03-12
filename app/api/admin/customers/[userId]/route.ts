import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isOwnerEmail } from '@/lib/auth';
import { prisma } from '@/lib/db';

/** PATCH - Update user flags (e.g. tradingBotOnDemand). Owner only. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email ?? null;
    if (!email) {
      return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
    }
    if (!isOwnerEmail(email)) {
      return NextResponse.json({ success: false, error: 'Not authorized.' }, { status: 403 });
    }
    const { userId } = await params;
    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID required.' }, { status: 400 });
    }
    const body = await request.json().catch(() => ({}));
    const tradingBotOnDemand = body.tradingBotOnDemand;
    const newsletterOptIn = body.newsletterOptIn;
    const novaConnectEnabled = body.novaConnectEnabled;
    const updates: { tradingBotOnDemand?: boolean; newsletterOptIn?: boolean; novaConnectEnabled?: boolean } = {};
    if (typeof tradingBotOnDemand === 'boolean') updates.tradingBotOnDemand = tradingBotOnDemand;
    if (typeof newsletterOptIn === 'boolean') updates.newsletterOptIn = newsletterOptIn;
    if (typeof novaConnectEnabled === 'boolean') updates.novaConnectEnabled = novaConnectEnabled;
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: 'Provide tradingBotOnDemand, newsletterOptIn and/or novaConnectEnabled (boolean).' }, { status: 400 });
    }
    await (prisma as any).user.update({
      where: { id: userId },
      data: updates,
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Admin PATCH customer error:', e);
    return NextResponse.json({ success: false, error: 'Failed to update.' }, { status: 500 });
  }
}

/** DELETE - Remove a customer (owner only). Cascades to accounts and subscriptions. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email ?? null;
    if (!email) {
      return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
    }
    if (!isOwnerEmail(email)) {
      return NextResponse.json({ success: false, error: 'Not authorized.' }, { status: 403 });
    }

    const { userId } = await params;
    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID required.' }, { status: 400 });
    }

    await prisma.user.delete({ where: { id: userId } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Admin delete customer error:', e);
    return NextResponse.json({ success: false, error: 'Failed to delete customer.' }, { status: 500 });
  }
}
