import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { cancelOrder as cancelOrderBlofin } from "@/lib/blofin";
import { cancelOrder as cancelOrderCoinbase } from "@/lib/coinbase";
import {
  parseExchangeProviderParam,
  resolveExchangeConfigForTradingBotSession,
} from "@/lib/trading-bot-exchange-session";

export const dynamic = "force-dynamic";

/** POST - Cancel an open (pending) order. Body: { orderId, instId, provider? }. */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const body = await req.json().catch(() => ({}));
    const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
    const instIdRaw = typeof body.instId === "string" ? body.instId.trim() : "";
    if (!orderId || !instIdRaw) {
      return NextResponse.json({ success: false, error: "orderId and instId are required." }, { status: 400 });
    }
    const resolved = await resolveExchangeConfigForTradingBotSession(session, {
      provider: parseExchangeProviderParam(body.provider),
    });
    if (!resolved.ok) {
      return NextResponse.json({ success: false, error: resolved.error }, { status: resolved.status });
    }
    const { provider } = resolved;
    const instId = provider === "coinbase" ? instIdRaw : instIdRaw.toUpperCase().replace("/", "-");
    const result =
      provider === "coinbase"
        ? await cancelOrderCoinbase(instId, orderId, { demo: resolved.coinbase!.demo, config: resolved.coinbase! })
        : await cancelOrderBlofin(instId, orderId, { demo: resolved.blofin!.demo, config: resolved.blofin! });
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
