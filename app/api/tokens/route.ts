import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const tokens = await prisma.token.findMany({
      where: { chain: 'solana' },
      orderBy: { viralScore: 'desc' },
      take: 50,
    });
    return NextResponse.json({ success: true, tokens });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
