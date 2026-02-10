import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isOwnerEmail } from '@/lib/auth';
import { getAllFeatureFlags, setFeatureFlag, FEATURE_FLAG_KEYS } from '@/lib/feature-flags';

export const dynamic = 'force-dynamic';

const VALID_KEYS = new Set(Object.values(FEATURE_FLAG_KEYS));

/** GET - List all feature flags (owner only). */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerEmail(session?.user?.email ?? null)) {
      return NextResponse.json({ success: false, error: 'Owner only.' }, { status: 403 });
    }
    const flags = await getAllFeatureFlags();
    return NextResponse.json({ success: true, flags });
  } catch (e) {
    console.error('Admin feature-flags GET:', e);
    return NextResponse.json({ success: false, error: 'Failed to load flags.' }, { status: 500 });
  }
}

/** PATCH - Set one feature flag (owner only). Body: { key: string, enabled: boolean } */
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerEmail(session?.user?.email ?? null)) {
      return NextResponse.json({ success: false, error: 'Owner only.' }, { status: 403 });
    }
    const body = await request.json();
    const key = typeof body.key === 'string' ? body.key.trim() : '';
    const enabled = Boolean(body.enabled);
    if (!key || !VALID_KEYS.has(key)) {
      return NextResponse.json({ success: false, error: 'Invalid key.' }, { status: 400 });
    }
    await setFeatureFlag(key, enabled);
    const flags = await getAllFeatureFlags();
    return NextResponse.json({ success: true, flags });
  } catch (e) {
    console.error('Admin feature-flags PATCH:', e);
    return NextResponse.json({ success: false, error: 'Failed to update flag.' }, { status: 500 });
  }
}
