import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcrypt';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const token = (body.token ?? '').toString().trim();
    const newPassword = (body.newPassword ?? '').toString();

    if (!token) {
      return NextResponse.json({ error: 'Reset token is required.' }, { status: 400 });
    }
    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
    }

    const record = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: { select: { id: true } } },
    });
    if (!record || record.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Invalid or expired reset link. Request a new one.' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { hashedPassword },
      }),
      prisma.passwordResetToken.delete({ where: { id: record.id } }),
    ]);

    return NextResponse.json({ success: true, message: 'Password updated. You can sign in.' });
  } catch (e) {
    console.error('Reset password error:', e);
    return NextResponse.json({ error: 'Failed to reset password.' }, { status: 500 });
  }
}
