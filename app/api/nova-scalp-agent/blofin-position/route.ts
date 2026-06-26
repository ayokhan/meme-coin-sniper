import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSessionAndSubscription } from "@/lib/auth-server";
import { resolveBlofinConfigForFuturesSession } from "@/lib/futures-blofin-session";
import { loadNovaRadarBlofinOpenPositions } from "@/lib/nova-radar-blofin-positions";
import { resolveScalpSymbol } from "@/lib/nova-scalp-agent";
import { getNovaScalpAgentAccess } from "@/lib/vip-futures-addon-access";

export const dynamic = "force-dynamic";

/** GET — open Blofin position for a symbol (if user has keys). Optional match to plan side. */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const access = await getNovaScalpAgentAccess(session);
    if (!access.ok) {
      return NextResponse.json({ success: false, error: access.error }, { status: access.status });
    }

    const url = new URL(request.url);
    const symbol = resolveScalpSymbol(url.searchParams.get("symbol") ?? "");
    const planSide = url.searchParams.get("side")?.toLowerCase();

    const { tier } = await getSessionAndSubscription();
    const resolved = await resolveBlofinConfigForFuturesSession(session, tier);
    if (!resolved.ok) {
      return NextResponse.json({
        success: true,
        configured: false,
        position: null,
        hint: resolved.error,
      });
    }

    const positions = await loadNovaRadarBlofinOpenPositions(resolved.config);
    const symUpper = symbol.toUpperCase();
    let match = positions.find((p) => p.symbol.toUpperCase() === symUpper);
    if (match && (planSide === "long" || planSide === "short") && match.side !== planSide) {
      match = undefined;
    }

    return NextResponse.json({
      success: true,
      configured: true,
      credentialSource: resolved.credentialSource,
      position: match ?? null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load Blofin position.";
    console.error("nova-scalp-agent/blofin-position:", e);
    return NextResponse.json({ success: false, error: message, configured: true }, { status: 500 });
  }
}
