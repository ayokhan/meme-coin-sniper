import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { put } from '@vercel/blob';

const MAX_SIZE = 4 * 1024 * 1024; // 4 MB (under Vercel 4.5 MB limit)
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
    }
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Use PNG, JPEG, WebP, or GIF.' }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large. Max 4 MB.' }, { status: 400 });
    }
    const pathname = `avatars/${session.user.id}/${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const blob = await put(pathname, file, {
      access: 'public',
      addRandomSuffix: true,
    });
    await prisma.user.update({
      where: { id: session.user.id },
      data: { novaConnectAvatarUrl: blob.url },
    });
    return NextResponse.json({ url: blob.url });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Upload failed.';
    console.error('Avatar server upload error:', e);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
