import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTicker } from "@/lib/hyperliquid";
import { getBlofinMetalTicker, isBlofinMetal, type BlofinMetal } from "@/lib/blofin-metals";
import { resolveScalpSymbol } from "@/lib/nova-scalp-agent";
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
    const ticker = isBlofinMetal(symbol)
      ? await getBlofinMetalTicker(symbol as BlofinMetal)
      : await getTicker(symbol);
    const price = ticker?.last ? Number(ticker.last) : null;

    return NextResponse.json({
      success: true,
      symbol,
      price: price != null && Number.isFinite(price) ? price : null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Price fetch failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
