import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getFeatureFlag, FEATURE_FLAG_KEYS } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";

/** Public-safe: whether VIP futures add-on tabs are enabled by admin flags. */
export async function GET() {
  try {
    // Session read kept for parity/auditing, but visibility is flag-driven for all users.
    await getServerSession(authOptions);
    const [novaEagle, cryptoBuddie, novaFuturesNarratives] = await Promise.all([
      getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_EAGLE),
      getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_CRYPTO_BUDDIE),
      getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_FUTURES_NARRATIVES),
    ]);
    return NextResponse.json({ success: true, novaEagle, cryptoBuddie, novaFuturesNarratives });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to read flags";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
