import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPolymarketTrackerAccess } from "@/lib/polymarket-tracker-access";
import { getFeatureFlag, FEATURE_FLAG_KEYS } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** GET — whether Leaderboard subtab should show (VIP Polymarket access + admin flag). */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const access = await getPolymarketTrackerAccess(session);
    if (!access.ok) {
      return NextResponse.json(
        { success: false, error: access.error, disabled: access.disabled },
        { status: access.status }
      );
    }
    const leaderboardEnabled = await getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_POLYMARKET_LEADERBOARD);
    return NextResponse.json({ success: true, leaderboardEnabled });
  } catch (e) {
    console.error("polymarket-leaderboard/bootstrap:", e);
    return NextResponse.json({ success: false, error: "Failed to load." }, { status: 500 });
  }
}
