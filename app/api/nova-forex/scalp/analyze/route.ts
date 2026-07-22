import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getForexCandles, validateForexScalpSymbol } from "@/lib/forex-market";
import { resolveForexLivePrice } from "@/lib/forex-live-price";
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
      maxLossPctOnMargin?: number;
    };

    const validated = validateForexScalpSymbol(body.symbol ?? "XAUUSD");
    if (!validated.ok) {
      return NextResponse.json({ success: false, error: validated.error }, { status: 400 });
    }
    const symbol = validated.symbol;
    const tf = scalpTimeframeConfig(body.timeframeId ?? "5m");
    const amountUsd = Math.max(1, Number(body.amountUsd) || 100);
    const leverage = Math.min(125, Math.max(1, Number(body.leverage) || 10));
    const maxLossPctOnMargin = Math.min(100, Math.max(0.5, Number(body.maxLossPctOnMargin) || 5));

    const live = await resolveForexLivePrice({
      symbol,
      userId: session?.user?.id ?? null,
    });
    const currentPrice = live?.price ?? null;
    const candles = await getForexCandles(symbol, tf.interval, tf.limit, undefined, currentPrice);

    const analysis = analyzeScalpSetup({
      symbol,
      timeframeId: tf.id,
      amountUsd,
      leverage,
      maxLossPctOnMargin,
      candles,
      currentPrice,
    });

    return NextResponse.json({
      success: true,
      analysis,
      priceSource: live?.source ?? null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Nova Forex Scalp failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
