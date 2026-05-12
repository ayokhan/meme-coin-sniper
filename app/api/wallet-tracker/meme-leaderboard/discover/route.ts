import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import { FEATURE_FLAG_KEYS, getFeatureFlag } from "@/lib/feature-flags";
import { getTrackedWallets } from "@/lib/wallet-tracker-config";
import { discoverSmartMoneyCandidates } from "@/lib/api-clients/helius-discovery";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** POST - Discover smart-money candidates. Owner-only. Free APIs (Dexscreener + Helius free tier). */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
  }
  if (!isOwnerSession(session)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }
  const enabled = await getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_MEME_LEADERBOARD);
  if (!enabled) {
    return NextResponse.json({ success: false, error: "Meme Leaderboard is disabled by admin." }, { status: 403 });
  }

  try {
    const tracked = await getTrackedWallets();
    const excludeAddresses = new Set(tracked.map((w) => w.address));
    const result = await discoverSmartMoneyCandidates({ excludeAddresses });
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Discovery failed." },
      { status: 500 },
    );
  }
}
