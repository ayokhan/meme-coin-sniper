import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOpenOrders as getOpenOrdersBlofin } from "@/lib/blofin";
import { getOpenOrders as getOpenOrdersCoinbase } from "@/lib/coinbase";
import {
  getTradingBotExchangeMeta,
  parseExchangeProviderParam,
  resolveExchangeConfigForTradingBotSession,
} from "@/lib/trading-bot-exchange-session";

export const dynamic = "force-dynamic";

/** GET - Open (pending) orders from the selected exchange. */
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(req.url);
    const resolved = await resolveExchangeConfigForTradingBotSession(session, {
      provider: parseExchangeProviderParam(searchParams.get("provider")),
    });
    if (!resolved.ok) {
      return NextResponse.json({ success: false, error: resolved.error }, { status: resolved.status });
    }
    const { provider, credentialSource } = resolved;
    const config = provider === "coinbase" ? resolved.coinbase! : resolved.blofin!;
    const exchange = await getTradingBotExchangeMeta(provider, credentialSource, config);
    const instId = searchParams.get("instId") ?? undefined;
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10) || 50));
    const ordersRaw =
      provider === "coinbase"
        ? await getOpenOrdersCoinbase({ demo: exchange.demo, instId, limit, config: resolved.coinbase! })
        : await getOpenOrdersBlofin({ demo: exchange.demo, instId, limit, config: resolved.blofin! });
    const orders = ordersRaw.map((o) => ({ ...o, exchange: provider }));
    return NextResponse.json({
      success: true,
      orders,
      provider,
      exchange,
      blofin: provider === "blofin" ? exchange : undefined,
      coinbase: provider === "coinbase" ? exchange : undefined,
    });
  } catch (e) {
    console.error("Trading bot open-orders:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to load open orders." },
      { status: 500 }
    );
  }
}
