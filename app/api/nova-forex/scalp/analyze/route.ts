import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getForexCandles, getForexTicker, normalizeForexSymbol } from "@/lib/forex-market";
import { analyzeScalpSetup, scalpTimeframeConfig } from "@/lib/nova-scalp-agent";
import { getNovaForexScalpAgentAccess } from "@/lib/vip-futures-addon-access";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const access = await getNovaForexScalpAgentAccess(session);
    if (!access.ok) {
      return NextResponse.json({ success: false, error: access.error, disabled: access.disabled }, { status: access.status });
    }

    const body = (await request.json()) as {
      symbol?: string;
      amountUsd?: number;
      leverage?: number;
      timeframeId?: string;
    };

    const symbol = normalizeForexSymbol(body.symbol ?? "XAUUSD") || "XAUUSD";
    const tf = scalpTimeframeConfig(body.timeframeId ?? "5m");
    const amountUsd = Math.max(1, Number(body.amountUsd) || 100);
    const leverage = Math.min(125, Math.max(1, Number(body.leverage) || 10));

    const [candles, ticker] = await Promise.all([
      getForexCandles(symbol, tf.interval, tf.limit),
      getForexTicker(symbol),
    ]);

    const currentPrice = ticker?.last ? Number(ticker.last) : null;
    const analysis = analyzeScalpSetup({
      symbol,
      timeframeId: tf.id,
      amountUsd,
      leverage,
      candles,
      currentPrice,
    });

    return NextResponse.json({ success: true, analysis });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Nova Forex Scalp failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
