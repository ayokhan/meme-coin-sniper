import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, phone: true, country: true, experienceTradingCrypto: true },
  });
  if (!user) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 });
  }
  return NextResponse.json(user);
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

    await prisma.user.update({
      where: { id: session.user.id },
      data: { name, phone, country, experienceTradingCrypto },
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Profile update error:', e);
    return NextResponse.json({ error: 'Update failed.' }, { status: 500 });
  }
}
