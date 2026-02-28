import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, canAccessTradingBot } from "@/lib/auth";
import { placeLimitOrderTradingBot } from "@/lib/trading-bot-run";

export const dynamic = "force-dynamic";

/** POST - Place limit order at given price (e.g. AI suggested entry). Body: { price: number, side?: "long" | "short" }. Owner only. */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!canAccessTradingBot(session)) {
      return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const price = typeof body.price === "number" ? body.price : parseFloat(body.price);
    if (!Number.isFinite(price) || price <= 0) {
      return NextResponse.json({ success: false, error: "Valid price (number > 0) required." }, { status: 400 });
    }
    const side = body.side === "short" ? "short" : "long";
    const result = await placeLimitOrderTradingBot({ price, side });
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
