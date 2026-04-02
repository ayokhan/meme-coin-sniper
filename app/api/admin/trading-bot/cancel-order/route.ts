import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { cancelOrder as cancelOrderBlofin } from "@/lib/blofin";
import { resolveBlofinConfigForTradingBotSession } from "@/lib/trading-bot-blofin-session";

export const dynamic = "force-dynamic";

/** POST - Cancel an open (pending) order on the signed-in user's Blofin account. Body: { orderId: string, instId: string }. */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const resolved = await resolveBlofinConfigForTradingBotSession(session);
    if (!resolved.ok) {
      return NextResponse.json({ success: false, error: resolved.error }, { status: resolved.status });
    }
    const body = await req.json().catch(() => ({}));
    const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
    const instId = typeof body.instId === "string" ? body.instId.trim().toUpperCase().replace("/", "-") : "";
    if (!orderId || !instId) {
      return NextResponse.json({ success: false, error: "orderId and instId are required." }, { status: 400 });
    }
    const isDemo = resolved.config.demo;
    const result = await cancelOrderBlofin(instId, orderId, { demo: isDemo, config: resolved.config });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error ?? "Failed to cancel order." }, { status: 400 });
    }
    return NextResponse.json({ success: true, message: "Order canceled." });
  } catch (e) {
    console.error("Trading bot cancel-order:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to cancel order." },
      { status: 500 }
    );
  }
}
