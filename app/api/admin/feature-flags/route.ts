import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isOwnerEmail } from '@/lib/auth';
import { getAllFeatureFlags, setFeatureFlag, FEATURE_FLAG_KEYS, type FeatureFlagKey } from '@/lib/feature-flags';

export const dynamic = 'force-dynamic';

const VALID_KEYS = new Set<string>(Object.values(FEATURE_FLAG_KEYS));

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

/**
 * PATCH - Set feature flag(s) (owner only).
 * Body: { key, enabled } OR { updates: [{ key, enabled }, ...] }
 */
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerEmail(session?.user?.email ?? null)) {
      return NextResponse.json({ success: false, error: 'Owner only.' }, { status: 403 });
    }
    const body = await request.json();

    const updates: Array<{ key: string; enabled: boolean }> = Array.isArray(body.updates)
      ? body.updates
      : [{ key: typeof body.key === 'string' ? body.key.trim() : '', enabled: Boolean(body.enabled) }];

    for (const u of updates) {
      const key = typeof u.key === 'string' ? u.key.trim() : '';
      if (!key || !VALID_KEYS.has(key)) {
        return NextResponse.json({ success: false, error: `Invalid key: ${key || '(empty)'}` }, { status: 400 });
      }
      await setFeatureFlag(key as FeatureFlagKey, Boolean(u.enabled));
    }

    const flags = await getAllFeatureFlags();
    return NextResponse.json({ success: true, flags });
  } catch (e) {
    console.error('Admin feature-flags PATCH:', e);
    return NextResponse.json({ success: false, error: 'Failed to update flag.' }, { status: 500 });
  }
}
