import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isOwnerEmail } from '@/lib/auth';
import { prisma } from '@/lib/db';
import bcrypt from 'bcrypt';

/** POST - Owner only: set a new password for a customer (email accounts only). */
export async function POST(
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
      return NextResponse.json({ success: false, error: 'Not authorized. Owner only.' }, { status: 403 });
    }

    const { userId } = await params;
    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID required.' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword.trim() : '';
    if (!newPassword) {
      return NextResponse.json({ success: false, error: 'newPassword is required.' }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ success: false, error: 'Password must be at least 8 characters.' }, { status: 400 });
    }

    const user = await (prisma as any).user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found.' }, { status: 404 });
    }
    if (!user.email) {
      return NextResponse.json(
        { success: false, error: 'This account has no email (wallet-only). Password reset is only for email sign-in accounts.' },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await (prisma as any).user.update({
      where: { id: userId },
      data: { hashedPassword },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Admin reset password error:', e);
    return NextResponse.json({ success: false, error: 'Failed to reset password.' }, { status: 500 });
  }
}
