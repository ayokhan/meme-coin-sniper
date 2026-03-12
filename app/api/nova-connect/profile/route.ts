import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getFeatureFlag, FEATURE_FLAG_KEYS } from '@/lib/feature-flags';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
    }
    const novaConnectOn = await getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_CONNECT);
    const db = prisma as any;
    const user = await db.user.findUnique({
      where: { id: (session.user as { id: string }).id },
      select: {
        id: true,
        name: true,
        email: true,
        novaConnectOptIn: true,
        novaConnectEnabled: true,
        novaConnectDisplayName: true,
        novaConnectAvatarUrl: true,
        novaConnectStatus: true,
        novaConnectRulesAcceptedAt: true,
      },
    });
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found.' }, { status: 404 });
    }
    return NextResponse.json({
      success: true,
      novaConnectOn,
      profile: {
        id: user.id,
        displayName: user.novaConnectDisplayName || user.name || user.email?.split('@')[0] || 'Trader',
        avatarUrl: user.novaConnectAvatarUrl ?? null,
        status: user.novaConnectStatus,
        optIn: user.novaConnectOptIn,
        enabled: user.novaConnectEnabled,
        rulesAccepted: !!user.novaConnectRulesAcceptedAt,
        rulesAcceptedAt: user.novaConnectRulesAcceptedAt ?? null,
      },
    });
  } catch (e) {
    console.error('NovaConnect profile GET error:', e);
    return NextResponse.json({ success: false, error: 'Failed to load NovaConnect profile.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
    }
    const novaConnectOn = await getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_CONNECT);
    if (!novaConnectOn) {
      return NextResponse.json({ success: false, error: 'NovaConnect is disabled.' }, { status: 403 });
    }
    const userId = (session.user as { id: string }).id;
    const body = await request.json().catch(() => ({}));
    const updates: {
      novaConnectDisplayName?: string | null;
      novaConnectAvatarUrl?: string | null;
      novaConnectStatus?: string;
      novaConnectOptIn?: boolean;
      novaConnectRulesAcceptedAt?: Date | null;
    } = {};
    if (typeof body.displayName === 'string') {
      const trimmed = body.displayName.trim();
      updates.novaConnectDisplayName = trimmed || null;
    }
    if (typeof body.avatarUrl === 'string') {
      const trimmed = body.avatarUrl.trim();
      updates.novaConnectAvatarUrl = trimmed || null;
    }
    if (typeof body.status === 'string') {
      const status = body.status.trim().toLowerCase();
      if (['online', 'away', 'busy', 'offline'].includes(status)) {
        updates.novaConnectStatus = status;
      }
    }
    if (typeof body.optIn === 'boolean') {
      updates.novaConnectOptIn = body.optIn;
    }
    if (body.rulesAccepted === true) {
      updates.novaConnectRulesAcceptedAt = new Date();
    }
    if (!Object.keys(updates).length) {
      return NextResponse.json({ success: false, error: 'No valid fields provided.' }, { status: 400 });
    }
    const db = prisma as any;
    const updated = await db.user.update({
      where: { id: userId },
      data: updates,
      select: {
        id: true,
        name: true,
        email: true,
        novaConnectOptIn: true,
        novaConnectEnabled: true,
        novaConnectDisplayName: true,
        novaConnectAvatarUrl: true,
        novaConnectStatus: true,
        novaConnectRulesAcceptedAt: true,
      },
    });
    return NextResponse.json({
      success: true,
      profile: {
        id: updated.id,
        displayName: updated.novaConnectDisplayName || updated.name || updated.email?.split('@')[0] || 'Trader',
        avatarUrl: updated.novaConnectAvatarUrl ?? null,
        status: updated.novaConnectStatus,
        optIn: updated.novaConnectOptIn,
        enabled: updated.novaConnectEnabled,
        rulesAccepted: !!updated.novaConnectRulesAcceptedAt,
        rulesAcceptedAt: updated.novaConnectRulesAcceptedAt ?? null,
      },
    });
  } catch (e) {
    console.error('NovaConnect profile PATCH error:', e);
    return NextResponse.json({ success: false, error: 'Failed to update NovaConnect profile.' }, { status: 500 });
  }
}

