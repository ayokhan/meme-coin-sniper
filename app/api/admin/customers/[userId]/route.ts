import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isOwnerSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

/** PATCH - Update user flags (e.g. tradingBotOnDemand). Owner only. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
    }
    if (!isOwnerSession(session)) {
      return NextResponse.json({ success: false, error: 'Not authorized.' }, { status: 403 });
    }
    const { userId } = await params;
    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID required.' }, { status: 400 });
    }
    const body = await request.json().catch(() => ({}));
    const tradingBotOnDemand = body.tradingBotOnDemand;
    const polymarketBotOnDemand = body.polymarketBotOnDemand;
    const propFirmBotOnDemand = body.propFirmBotOnDemand;
    const novaUltimateOnDemand = body.novaUltimateOnDemand;
    const ctScanOnDemand = body.ctScanOnDemand;
    const ctScanOnDemandExpiresAt = body.ctScanOnDemandExpiresAt;
    const memeCoinsTraderOnDemand = body.memeCoinsTraderOnDemand;
    const memeCoinsTraderOnDemandExpiresAt = body.memeCoinsTraderOnDemandExpiresAt;
    const newsletterOptIn = body.newsletterOptIn;
    const novaConnectEnabled = body.novaConnectEnabled;
    const novaConnectCommunityRep = body.novaConnectCommunityRep;
    const novaConnectAllowedByAdmin = body.novaConnectAllowedByAdmin;
    const coachUser = body.coachUser;
    const customersViewerAdmin = body.customersViewerAdmin;
    const rulesAccepted = body.rulesAccepted;
    const updates: {
      tradingBotOnDemand?: boolean;
      polymarketBotOnDemand?: boolean;
      propFirmBotOnDemand?: boolean;
      novaUltimateOnDemand?: boolean;
      ctScanOnDemand?: boolean;
      ctScanOnDemandExpiresAt?: Date | null;
      memeCoinsTraderOnDemand?: boolean;
      memeCoinsTraderOnDemandExpiresAt?: Date | null;
      newsletterOptIn?: boolean;
      novaConnectEnabled?: boolean;
      novaConnectCommunityRep?: boolean;
      novaConnectAllowedByAdmin?: boolean;
      coachUser?: boolean;
      customersViewerAdmin?: boolean;
      novaConnectRulesAcceptedAt?: Date | null;
    } = {};
    if (typeof tradingBotOnDemand === 'boolean') updates.tradingBotOnDemand = tradingBotOnDemand;
    if (typeof polymarketBotOnDemand === 'boolean') updates.polymarketBotOnDemand = polymarketBotOnDemand;
    if (typeof propFirmBotOnDemand === 'boolean') updates.propFirmBotOnDemand = propFirmBotOnDemand;
    if (typeof novaUltimateOnDemand === 'boolean') updates.novaUltimateOnDemand = novaUltimateOnDemand;
    if (typeof ctScanOnDemand === 'boolean') updates.ctScanOnDemand = ctScanOnDemand;
    if (ctScanOnDemandExpiresAt !== undefined) {
      updates.ctScanOnDemandExpiresAt = ctScanOnDemandExpiresAt ? new Date(ctScanOnDemandExpiresAt) : null;
    }
    if (typeof memeCoinsTraderOnDemand === 'boolean') updates.memeCoinsTraderOnDemand = memeCoinsTraderOnDemand;
    if (memeCoinsTraderOnDemandExpiresAt !== undefined) {
      updates.memeCoinsTraderOnDemandExpiresAt = memeCoinsTraderOnDemandExpiresAt ? new Date(memeCoinsTraderOnDemandExpiresAt) : null;
    }
    if (typeof newsletterOptIn === 'boolean') updates.newsletterOptIn = newsletterOptIn;
    if (typeof novaConnectEnabled === 'boolean') updates.novaConnectEnabled = novaConnectEnabled;
    if (typeof novaConnectCommunityRep === 'boolean') updates.novaConnectCommunityRep = novaConnectCommunityRep;
    if (typeof novaConnectAllowedByAdmin === 'boolean') updates.novaConnectAllowedByAdmin = novaConnectAllowedByAdmin;
    if (typeof coachUser === 'boolean') updates.coachUser = coachUser;
    if (typeof customersViewerAdmin === 'boolean') updates.customersViewerAdmin = customersViewerAdmin;
    if (typeof rulesAccepted === 'boolean') {
      updates.novaConnectRulesAcceptedAt = rulesAccepted ? new Date() : null;
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Provide at least one of: tradingBotOnDemand, polymarketBotOnDemand, propFirmBotOnDemand, novaUltimateOnDemand, ctScanOnDemand, ctScanOnDemandExpiresAt, memeCoinsTraderOnDemand, memeCoinsTraderOnDemandExpiresAt, newsletterOptIn, novaConnectEnabled, novaConnectCommunityRep, novaConnectAllowedByAdmin, coachUser, customersViewerAdmin, rulesAccepted (boolean).',
      }, { status: 400 });
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
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
    }
    if (!isOwnerSession(session)) {
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
