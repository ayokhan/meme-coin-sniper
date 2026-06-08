import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSessionAndSubscription } from "@/lib/auth-server";
import { resolveBlofinConfigForFuturesSession } from "@/lib/futures-blofin-session";
import { loadNovaRadarBlofinOpenPositions } from "@/lib/nova-radar-blofin-positions";

export const dynamic = "force-dynamic";

/** GET — open Blofin positions for NovaRadar Capital Guard (VIP; per-user keys). */
export async function GET() {
  try {
    const { tier, session } = await getSessionAndSubscription();
    if (tier !== "vip" && !session?.user?.isOwner) {
      return NextResponse.json(
        { success: false, error: "NovaRadar is for VIP subscribers.", locked: true, configured: false },
        { status: 403 }
      );
    }

    const authSession = await getServerSession(authOptions);
    const resolved = await resolveBlofinConfigForFuturesSession(authSession, tier);
    if (!resolved.ok) {
      return NextResponse.json(
        { success: false, error: resolved.error, configured: false },
        { status: resolved.status }
      );
    }

    const positions = await loadNovaRadarBlofinOpenPositions(resolved.config);

    return NextResponse.json({
      success: true,
      configured: true,
      credentialSource: resolved.credentialSource,
      positions,
      missingStopCount: positions.filter((p) => p.missingStopAlert).length,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load Blofin positions.";
    return NextResponse.json({ success: false, error: message, configured: true }, { status: 500 });
  }
}
