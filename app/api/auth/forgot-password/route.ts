import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { randomBytes } from 'crypto';
import { sendPasswordResetEmail } from '@/lib/send-reset-email';

const TOKEN_BYTES = 32;
const EXPIRY_HOURS = 1;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = (body.email ?? '').toString().trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Valid email is required.' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, hashedPassword: true },
    });
    // Always return success to avoid email enumeration
    if (!user?.hashedPassword) {
      return NextResponse.json({ success: true, message: 'If an account exists with that email, we sent a reset link.' });
    }

    const token = randomBytes(TOKEN_BYTES).toString('hex');
    const expiresAt = new Date(Date.now() + EXPIRY_HOURS * 60 * 60 * 1000);
    await prisma.passwordResetToken.create({
      data: { token, userId: user.id, expiresAt },
    });

    const baseUrl = process.env.NEXTAUTH_URL ?? process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
    const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;
    await sendPasswordResetEmail(email, resetUrl);

    return NextResponse.json({ success: true, message: 'If an account exists with that email, we sent a reset link.' });
  } catch (e) {
    console.error('Forgot password error:', e);
    return NextResponse.json({ error: 'Something went wrong. Try again later.' }, { status: 500 });
  }
}
