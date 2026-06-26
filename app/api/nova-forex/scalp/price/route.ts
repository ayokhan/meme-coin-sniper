import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getForexTicker, normalizeForexSymbol } from "@/lib/forex-market";
import { getNovaForexScalpAgentAccess } from "@/lib/vip-futures-addon-access";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const access = await getNovaForexScalpAgentAccess(session);
    if (!access.ok) {
      return NextResponse.json(
        { success: false, error: access.error, locked: access.status === 403, disabled: access.disabled },
        { status: access.status }
      );
    }

    const symbol = normalizeForexSymbol(
      new URL(request.url).searchParams.get("symbol")?.trim() ?? "XAUUSD"
    ) || "XAUUSD";
    const ticker = await getForexTicker(symbol);
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
