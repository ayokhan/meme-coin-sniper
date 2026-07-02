import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, canAccessPropFirmBot } from "@/lib/auth";
import { getFeatureFlag, FEATURE_FLAG_KEYS } from "@/lib/feature-flags";
import { getCandles, getTicker } from "@/lib/hyperliquid";
import {
  getBlofinMetalCandles,
  getBlofinMetalTicker,
  isBlofinMetal,
  type BlofinMetal,
} from "@/lib/blofin-metals";
import {
  analyzeScalpSetup,
  resolveScalpSymbol,
  scalpTimeframeConfig,
} from "@/lib/nova-scalp-agent";
import { propFirmSymbolToScalp, riskAtStopFromSetup } from "@/lib/prop-firm-setup";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** POST — live setup analysis (candles + entry/stop/target) for prop firm challenge workbook. */
export async function POST(request: Request) {
  try {
    const enabled = await getFeatureFlag(FEATURE_FLAG_KEYS.PAGE_TAB_PROP_FIRM_BOT);
    if (!enabled) {
      return NextResponse.json({ success: false, error: "Nova Prop Firm Challenge is disabled." }, { status: 403 });
    }

    const session = await getServerSession(authOptions);
    if (!canAccessPropFirmBot(session)) {
      return NextResponse.json({ success: false, error: "Nova Prop Firm Challenge access required." }, { status: 403 });
    }

    const body = (await request.json()) as {
      symbol?: string;
      timeframeId?: string;
      perTradeRiskCapUsd?: number;
    };

    const symbol = propFirmSymbolToScalp(body.symbol ?? "BTC");
    const tf = scalpTimeframeConfig(body.timeframeId ?? "15m");
    const perTradeRiskCapUsd = Math.max(50, Number(body.perTradeRiskCapUsd) || 175);
    const amountUsd = Math.min(500, Math.max(50, perTradeRiskCapUsd * 0.4));
    const leverage = 10;
    const maxLossPctOnMargin = Math.min(15, Math.max(2, (perTradeRiskCapUsd / amountUsd) * 100 * 0.5));

    const [candles, ticker] = await Promise.all([
      isBlofinMetal(symbol)
        ? getBlofinMetalCandles(symbol as BlofinMetal, tf.interval, tf.limit)
        : getCandles(symbol, tf.interval, tf.limit),
      isBlofinMetal(symbol)
        ? getBlofinMetalTicker(symbol as BlofinMetal)
        : getTicker(symbol),
    ]);

    if (!candles.length) {
      return NextResponse.json(
        { success: false, error: `No live candle data for ${symbol}. Try BTC, ETH, or XAU.` },
        { status: 400 }
      );
    }

    const currentPrice = ticker?.last ? Number(ticker.last) : null;
    const analysis = analyzeScalpSetup({
      symbol: resolveScalpSymbol(symbol),
      timeframeId: tf.id,
      amountUsd,
      leverage,
      maxLossPctOnMargin,
      candles,
      currentPrice,
    });

    const closes = candles
      .map((c) => parseFloat(c[4]))
      .filter((n) => Number.isFinite(n))
      .slice(-48);

    const highs = candles
      .map((c) => parseFloat(c[2]))
      .filter((n) => Number.isFinite(n))
      .slice(-48);

    const lows = candles
      .map((c) => parseFloat(c[3]))
      .filter((n) => Number.isFinite(n))
      .slice(-48);

    const proposedRiskUsd = riskAtStopFromSetup(analysis);

    return NextResponse.json({
      success: true,
      analysis,
      chart: {
        symbol,
        timeframeLabel: tf.label,
        currentPrice,
        closes,
        highs,
        lows,
        analyzedAt: analysis.analyzedAt,
      },
      proposedRiskUsd,
      analyzeParams: { amountUsd, leverage, maxLossPctOnMargin },
    });
  } catch (e) {
    console.error("prop-firm-bot analyze:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Setup analysis failed." },
      { status: 500 }
    );
  }
}
