import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isBlofinMetal, toBlofinInstId } from "@/lib/blofin-metals";
import { getForexSpotMid, usesSpotCalibration } from "@/lib/forex-spot-feed";
import { resolveScalpSymbol } from "@/lib/nova-scalp-agent";
import { getNovaScalpTicker } from "@/lib/nova-scalp-blofin-market";
import { getNovaScalpAgentAccess } from "@/lib/vip-futures-addon-access";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const access = await getNovaScalpAgentAccess(session);
    if (!access.ok) {
      return NextResponse.json(
        { success: false, error: access.error, locked: access.status === 403, disabled: access.disabled },
        { status: access.status }
      );
    }

    const symbol = resolveScalpSymbol(
      new URL(request.url).searchParams.get("symbol")?.trim() ?? "BTC"
    );
    let price: number | null = null;
    if (isBlofinMetal(symbol) && usesSpotCalibration(symbol)) {
      // Align metals to broker/TradingView-style spot mid instead of Blofin perp last.
      const spotMid = await getForexSpotMid(symbol);
      if (spotMid != null && Number.isFinite(spotMid)) price = spotMid;
    }
    if (price == null) {
      const ticker = await getNovaScalpTicker(symbol);
      price = ticker?.last ? Number(ticker.last) : null;
    }

    return NextResponse.json({
      success: true,
      symbol,
      price: price != null && Number.isFinite(price) ? price : null,
      marketVenue: "blofin",
      blofinInstId: toBlofinInstId(symbol),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Price fetch failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
