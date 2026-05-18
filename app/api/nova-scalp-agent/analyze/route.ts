import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCandles, getTicker } from "@/lib/hyperliquid";
import {
  getBlofinMetalCandles,
  getBlofinMetalTicker,
  isBlofinMetal,
  type BlofinMetal,
} from "@/lib/blofin-metals";
import { analyzeScalpSetup, resolveScalpSymbol, scalpTimeframeConfig } from "@/lib/nova-scalp-agent";
import { getNovaScalpAgentAccess } from "@/lib/vip-futures-addon-access";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const access = await getNovaScalpAgentAccess(session);
    if (!access.ok) {
      return NextResponse.json(
        { success: false, error: access.error, locked: access.status === 403, disabled: access.disabled },
        { status: access.status }
      );
    }

    const body = (await request.json()) as {
      symbol?: string;
      amountUsd?: number;
      leverage?: number;
      timeframeId?: string;
    };

    const symbol = resolveScalpSymbol(body.symbol ?? "BTC");
    const tf = scalpTimeframeConfig(body.timeframeId ?? "5m");
    const amountUsd = Math.max(1, Number(body.amountUsd) || 100);
    const leverage = Math.min(125, Math.max(1, Number(body.leverage) || 10));

    const [candles, ticker] = await Promise.all([
      isBlofinMetal(symbol)
        ? getBlofinMetalCandles(symbol as BlofinMetal, tf.interval, tf.limit)
        : getCandles(symbol, tf.interval, tf.limit),
      isBlofinMetal(symbol)
        ? getBlofinMetalTicker(symbol as BlofinMetal)
        : getTicker(symbol),
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
    const message = e instanceof Error ? e.message : "Nova Scalp Agent failed";
    console.error("nova-scalp-agent analyze:", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
