import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { placeLimitOrderTradingBot } from "@/lib/trading-bot-run";
import { resolveBlofinConfigForTradingBotSession } from "@/lib/trading-bot-blofin-session";

export const dynamic = "force-dynamic";

/** POST - Place limit order on the signed-in user's Blofin account. Body: { price: number, side?: "long" | "short" }. */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const resolved = await resolveBlofinConfigForTradingBotSession(session);
    if (!resolved.ok) {
      return NextResponse.json({ success: false, error: resolved.error }, { status: resolved.status });
    }
    const body = await req.json().catch(() => ({}));
    const price = typeof body.price === "number" ? body.price : parseFloat(body.price);
    if (!Number.isFinite(price) || price <= 0) {
      return NextResponse.json({ success: false, error: "Valid price (number > 0) required." }, { status: 400 });
    }
    const side = body.side === "short" ? "short" : "long";
    const result = await placeLimitOrderTradingBot({ price, side, blofinConfig: resolved.config });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error ?? "Failed to place limit order." }, { status: 400 });
    }
    return NextResponse.json({ success: true, orderId: result.orderId, message: result.message ?? "Limit order placed." });
  } catch (e) {
    console.error("Trading bot place-limit-order:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to place limit order." },
      { status: 500 }
    );
  }
}
