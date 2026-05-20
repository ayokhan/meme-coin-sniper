import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { FOREX_MARKET_WATCH } from "@/lib/forex-market";
import { getNovaForexAgentAccess } from "@/lib/vip-futures-addon-access";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  const access = await getNovaForexAgentAccess(session);
  if (!access.ok) {
    return NextResponse.json({ success: false, error: access.error, disabled: access.disabled }, { status: access.status });
  }
  return NextResponse.json({
    success: true,
    symbols: FOREX_MARKET_WATCH,
    dataNote:
      "Prices and candles use Yahoo Finance chart data as a reference feed (similar symbols to TradingView / FOREX.com). Your broker may quote different bid/ask.",
  });
}
