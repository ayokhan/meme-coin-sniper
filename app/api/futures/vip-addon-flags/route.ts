import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import { getSubscriptionTier } from "@/lib/subscription";
import { getFeatureFlag, FEATURE_FLAG_KEYS } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";

/** Authenticated: whether VIP futures add-on flags are on (non-VIP always gets false). */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: true, novaEagle: false, cryptoBuddie: false });
    }
    let vip = isOwnerSession(session);
    if (!vip) {
      const tier = await getSubscriptionTier(session.user.id);
      vip = tier === "vip";
    }
    if (!vip) {
      return NextResponse.json({ success: true, novaEagle: false, cryptoBuddie: false });
    }
    const [novaEagle, cryptoBuddie] = await Promise.all([
      getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_EAGLE),
      getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_CRYPTO_BUDDIE),
    ]);
    return NextResponse.json({ success: true, novaEagle, cryptoBuddie });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to read flags";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
