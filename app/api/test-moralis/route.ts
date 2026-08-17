import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerEmail } from "@/lib/auth";
import { getPumpFunNewTokens, isMoralisConfigured } from "@/lib/api-clients/moralis";
import { getFeatureFlag, FEATURE_FLAG_KEYS } from "@/lib/feature-flags";

/**
 * GET /api/test-moralis
 * Check Moralis API: new Pump.fun tokens (used as fallback when Birdeye returns 0).
 * When feature flag "Go Hunting (Moralis)" is OFF, returns without calling Moralis.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerEmail(session?.user?.email ?? null)) {
      return NextResponse.json({ success: false, message: "Owner only." }, { status: 403 });
    }
    const moralisGoHunting = await getFeatureFlag(FEATURE_FLAG_KEYS.MORALIS_GO_HUNTING);
    if (!moralisGoHunting) {
      return NextResponse.json({
        success: false,
        message: "Moralis for Go Hunting is turned off (Admin → Feature flags).",
        count: 0,
        sample: [],
      });
    }
    if (!isMoralisConfigured()) {
      return NextResponse.json({
        success: false,
        message: "Moralis is not configured.",
        count: 0,
        sample: [],
      });
    }
    const tokens = await getPumpFunNewTokens(10);
    const sample = tokens.slice(0, 5).map((t) => ({ address: t.tokenAddress }));
    return NextResponse.json({
      success: tokens.length > 0,
      message:
        tokens.length > 0
          ? `Moralis returned ${tokens.length} new Pump.fun tokens.`
          : "Moralis returned 0 tokens (API OK, no new listings right now).",
      count: tokens.length,
      sample,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Moralis request failed";
    return NextResponse.json(
      { success: false, message, count: 0, sample: [] },
      { status: 500 }
    );
  }
}
