import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import bcrypt from 'bcrypt';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const currentPassword = (body.currentPassword ?? '').toString();
    const newPassword = (body.newPassword ?? '').toString();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Current password and new password are required.' }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'New password must be at least 8 characters.' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });
    if (!user?.hashedPassword) {
      return NextResponse.json({ error: 'Your account uses wallet sign-in. Password change is not available.' }, { status: 400 });
    }

    const ok = await bcrypt.compare(currentPassword, user.hashedPassword);
    if (!ok) {
      return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: session.user.id },
      data: { hashedPassword },
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Change password error:', e);
    return NextResponse.json({ error: 'Failed to change password.' }, { status: 500 });
  }
}
