import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isOwnerEmail, isOwnerWallet } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getUsageThisMonth } from '@/lib/usage';
import { FEATURE_FLAG_KEYS, getFeatureFlag } from '@/lib/feature-flags';

function avatarUrlForClient(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.includes('blob.vercel-storage.com')) return `/api/avatar?url=${encodeURIComponent(url)}`;
  return url;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }
  const [user, usageThisMonth, selfDeleteEnabled] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id } }),
    getUsageThisMonth(session.user.id),
    getFeatureFlag(FEATURE_FLAG_KEYS.ACCOUNT_SELF_DELETE),
  ]);
  if (!user) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 });
  }
  const u = user as {
    name: string | null;
    email: string | null;
    phone: string | null;
    country: string | null;
    experienceTradingCrypto: string | null;
    novaConnectDisplayName?: string | null;
    novaConnectAvatarUrl?: string | null;
    hashedPassword?: string | null;
    walletAddress?: string | null;
  };
  return NextResponse.json({
    name: u.name,
    email: u.email,
    phone: u.phone,
    country: u.country,
    experienceTradingCrypto: u.experienceTradingCrypto,
    preferredName: u.novaConnectDisplayName ?? null,
    avatarUrl: u.novaConnectAvatarUrl ?? null,
    usageThisMonth,
    selfDeleteEnabled,
    hasPassword: !!u.hashedPassword,
    isProtectedOwner: isOwnerEmail(u.email) || isOwnerWallet(u.walletAddress),
  });
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const name = (body.name ?? '').toString().trim() || undefined;
    const phone = (body.phone ?? '').toString().trim() || undefined;
    const country = (body.country ?? '').toString().trim() || undefined;
    const experienceTradingCrypto = (body.experienceTradingCrypto ?? '').toString().trim() || undefined;
    const preferredName = (body.preferredName ?? '').toString().trim() || null;
    const avatarUrl = (body.avatarUrl ?? '').toString().trim() || null;

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = name;
    if (body.phone !== undefined) data.phone = phone;
    if (body.country !== undefined) data.country = country;
    if (body.experienceTradingCrypto !== undefined) data.experienceTradingCrypto = experienceTradingCrypto;
    if (body.preferredName !== undefined) data.novaConnectDisplayName = preferredName;
    if (body.avatarUrl !== undefined) data.novaConnectAvatarUrl = avatarUrl;

    await prisma.user.update({
      where: { id: session.user.id },
      data: data as any,
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Profile update error:', e);
    return NextResponse.json({ error: 'Update failed.' }, { status: 500 });
  }
}
