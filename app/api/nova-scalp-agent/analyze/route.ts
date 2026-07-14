import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isBlofinMetal, toBlofinInstId } from "@/lib/blofin-metals";
import { calibrateCandlesToSpotMid, getForexSpotMid, usesSpotCalibration } from "@/lib/forex-spot-feed";
import { analyzeScalpSetup, resolveScalpSymbol, scalpTimeframeConfig } from "@/lib/nova-scalp-agent";
import { getNovaScalpCandles, getNovaScalpTickSize, getNovaScalpTicker } from "@/lib/nova-scalp-blofin-market";
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
      maxLossPctOnMargin?: number;
      reconfirm?: {
        side?: string;
        entryPrice?: number;
        exitPrice?: number;
        stopLossPrice?: number;
        analyzedAt?: string | null;
        entryMode?: "limit" | "market" | null;
      } | null;
    };

    const symbol = resolveScalpSymbol(body.symbol ?? "BTC");
    const tf = scalpTimeframeConfig(body.timeframeId ?? "5m");
    const amountUsd = Math.max(1, Number(body.amountUsd) || 100);
    const leverage = Math.min(125, Math.max(1, Number(body.leverage) || 10));
    const maxLossPctOnMargin = Math.min(100, Math.max(0.5, Number(body.maxLossPctOnMargin) || 5));

    const rc = body.reconfirm;
    const reconfirm =
      rc &&
      (rc.side === "long" || rc.side === "short") &&
      Number.isFinite(Number(rc.entryPrice)) &&
      Number.isFinite(Number(rc.exitPrice)) &&
      Number.isFinite(Number(rc.stopLossPrice))
        ? {
            side: rc.side as "long" | "short",
            entryPrice: Number(rc.entryPrice),
            exitPrice: Number(rc.exitPrice),
            stopLossPrice: Number(rc.stopLossPrice),
            analyzedAt: rc.analyzedAt ?? null,
            entryMode: rc.entryMode === "market" || rc.entryMode === "limit" ? rc.entryMode : null,
          }
        : null;

    const metal = isBlofinMetal(symbol);
    const spotMid = metal && usesSpotCalibration(symbol) ? await getForexSpotMid(symbol) : null;
    const hasSpot = spotMid != null && Number.isFinite(spotMid);

    const [candlesRaw, ticker, tickSize] = await Promise.all([
      getNovaScalpCandles(symbol, tf.interval, tf.limit),
      getNovaScalpTicker(symbol),
      getNovaScalpTickSize(symbol),
    ]);

    // Metals: align price + levels to broker/TradingView-style spot mid (Swissquote).
    // Crypto: Blofin last so plans match Blofin Trade (INJUSDT Perp, etc.).
    const candles = metal && hasSpot ? calibrateCandlesToSpotMid(candlesRaw, spotMid!) : candlesRaw;
    const currentPrice = metal && hasSpot ? spotMid! : ticker?.last ? Number(ticker.last) : null;
    const analysis = analyzeScalpSetup({
      symbol,
      timeframeId: tf.id,
      amountUsd,
      leverage,
      maxLossPctOnMargin,
      candles,
      currentPrice,
      tickSize,
      reconfirm,
    });

    return NextResponse.json({
      success: true,
      analysis,
      marketVenue: "blofin",
      blofinInstId: toBlofinInstId(symbol),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Nova Scalp Agent failed";
    console.error("nova-scalp-agent analyze:", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
