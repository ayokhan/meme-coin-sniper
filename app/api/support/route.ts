import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

function generateSupportNumber(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = 'NV-SUP-';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

/** POST - Create a support ticket. Returns support number. */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, message, name, email, source } = body as {
      title?: string;
      message?: string;
      name?: string;
      email?: string;
      source?: string;
    };
    const trimmedTitle = typeof title === 'string' ? title.trim() : '';
    const trimmedMessage = typeof message === 'string' ? message.trim() : '';
    const trimmedName = typeof name === 'string' ? name.trim() : '';
    const trimmedEmail = typeof email === 'string' ? email.trim() : '';
    if (!trimmedTitle || !trimmedMessage || !trimmedName || !trimmedEmail) {
      return NextResponse.json(
        { success: false, error: 'Title, message, name, and email are required.' },
        { status: 400 }
      );
    }
    const validSource = source === 'chat' ? 'chat' : 'form';
    let supportNumber = generateSupportNumber();
    let exists = await prisma.supportTicket.findUnique({ where: { supportNumber } });
    while (exists) {
      supportNumber = generateSupportNumber();
      exists = await prisma.supportTicket.findUnique({ where: { supportNumber } });
    }
    await prisma.supportTicket.create({
      data: {
        supportNumber,
        title: trimmedTitle,
        message: trimmedMessage,
        name: trimmedName,
        email: trimmedEmail,
        source: validSource,
      },
    });
    return NextResponse.json({ success: true, supportNumber });
  } catch (e) {
    console.error('Support ticket error:', e);
    return NextResponse.json({ success: false, error: 'Failed to submit request.' }, { status: 500 });
  }
}
