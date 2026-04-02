import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOpenOrders } from "@/lib/blofin";
import { resolveBlofinConfigForTradingBotSession } from "@/lib/trading-bot-blofin-session";

export const dynamic = "force-dynamic";

/** GET - Open (pending) orders from Blofin for the signed-in user's Blofin account. */
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const resolved = await resolveBlofinConfigForTradingBotSession(session);
    if (!resolved.ok) {
      return NextResponse.json({ success: false, error: resolved.error }, { status: resolved.status });
    }
    const { config } = resolved;
    const isDemo = config.demo;
    const { searchParams } = new URL(req.url);
    const instId = searchParams.get("instId") ?? undefined;
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10) || 50));
    const orders = await getOpenOrders({ demo: isDemo, instId, limit, config });
    return NextResponse.json({ success: true, orders });
  } catch (e) {
    console.error("Trading bot open-orders:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to load open orders." },
      { status: 500 }
    );
  }
}
