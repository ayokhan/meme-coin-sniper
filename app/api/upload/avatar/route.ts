import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
    }
    const body = (await request.json()) as HandleUploadBody;
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        return {
          allowedContentTypes: ALLOWED_TYPES,
          maximumSizeInBytes: MAX_SIZE,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId: session.user.id }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        try {
          const payload = tokenPayload ? JSON.parse(tokenPayload as string) : {};
          const userId = payload.userId;
          if (userId && blob?.url) {
            await prisma.user.update({
              where: { id: userId },
              data: { novaConnectAvatarUrl: blob.url },
            });
          }
        } catch (err) {
          console.error('Avatar onUploadCompleted error:', err);
        }
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Upload failed.';
    console.error('Avatar upload error:', e);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
