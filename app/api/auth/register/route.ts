import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcrypt';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = (body.email ?? '').toString().trim().toLowerCase();
    const password = (body.password ?? '').toString();
    const name = (body.name ?? '').toString().trim() || email.split('@')[0];

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ success: false, error: 'Valid email is required.' }, { status: 400 });
    }
    if (!password || password.length < 8) {
      return NextResponse.json({ success: false, error: 'Password must be at least 8 characters.' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ success: false, error: 'An account with this email already exists.' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: { email, hashedPassword, name },
    });

    return NextResponse.json({ success: true, message: 'Account created. You can sign in.' });
  } catch (e) {
    console.error('Register error:', e);
    return NextResponse.json({ success: false, error: 'Registration failed.' }, { status: 500 });
  }
}
