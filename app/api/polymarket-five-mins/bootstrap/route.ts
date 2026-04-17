import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPolymarketTrackerAccess } from "@/lib/polymarket-tracker-access";
import { getFeatureFlag, FEATURE_FLAG_KEYS } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** GET — whether Nova 5 mins subtab should show (VIP Polymarket access + admin flag). */
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
    const fiveMinsEnabled = await getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_POLYMARKET_FIVE_MINS);
    return NextResponse.json({ success: true, fiveMinsEnabled });
  } catch (e) {
    console.error("polymarket-five-mins/bootstrap:", e);
    return NextResponse.json({ success: false, error: "Failed to load." }, { status: 500 });
  }
}
