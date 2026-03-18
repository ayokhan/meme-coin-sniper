import { NextResponse } from 'next/server';
import { get } from '@vercel/blob';

/** Serves private Vercel Blob avatar URLs so they can be used in img src. */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Missing url' }, { status: 400 });
    }
    if (!url.includes('blob.vercel-storage.com')) {
      return NextResponse.json({ error: 'Invalid avatar URL' }, { status: 400 });
    }
    const result = await get(url, { access: 'private' });
    if (!result || result.statusCode !== 200 || !result.stream) {
      return new NextResponse(null, { status: 404 });
    }
    return new NextResponse(result.stream, {
      headers: {
        'Content-Type': result.blob.contentType ?? 'image/jpeg',
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (e) {
    console.error('Avatar proxy error:', e);
    return new NextResponse(null, { status: 404 });
  }
}
