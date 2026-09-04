import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  forexContractDescription,
  getForexCandles,
  getForexTicker,
  normalizeForexSymbol,
} from "@/lib/forex-market";
import { NOVA_FOREX_Q_TIMEFRAMES } from "@/lib/nova-forex-timeframes";
import {
  combineStructureAndTrendline,
  countSupportResistanceTouches,
  demandSupplyRead,
  highLowFromCandles,
  overallTrendlineSummary,
  structureDirectionFromCloses,
  trendlineRegressionFromCloses,
  type CandleTuple,
} from "@/lib/nova-q-analytics";
import { getNovaForexAgentAccess } from "@/lib/vip-futures-addon-access";
import { buildNovaQTradePlan, computeNovaQAlignment } from "@/lib/nova-q-trade-plan";
import { computeWeightedMarketDirection } from "@/lib/nova-q-direction";
import { NOVA_DEFAULT_TF_IDS } from "@/lib/nova-timeframes";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const access = await getNovaForexAgentAccess(session);
    if (!access.ok) {
      return NextResponse.json({ success: false, error: access.error, disabled: access.disabled }, { status: access.status });
    }
    const { trialDeskLimitResponse } = await import("@/lib/trial-desk-gate");
    const blocked = await trialDeskLimitResponse(session?.user?.id, "nova_forex");
    if (blocked) return blocked;

    const body = await request.json().catch(() => ({}));
    const symbol = normalizeForexSymbol(String(body.symbol ?? "XAUUSD")) || "XAUUSD";
    const timeframesParam = body.timeframes ?? body.tf ?? [...NOVA_DEFAULT_TF_IDS];
    const requestedTf = (typeof timeframesParam === "string"
      ? timeframesParam.split(/[\s,]+/).map((s) => s.trim().toLowerCase())
      : Array.isArray(timeframesParam)
        ? timeframesParam.map((s) => String(s).trim().toLowerCase())
        : []
    ).filter(Boolean);

    const selected = NOVA_FOREX_Q_TIMEFRAMES.filter((t) => requestedTf.includes(t.id));
    const effectiveTf =
      selected.length > 0
        ? selected
        : NOVA_FOREX_Q_TIMEFRAMES.filter((t) => (NOVA_DEFAULT_TF_IDS as readonly string[]).includes(t.id));

    const tfResults = [];
    for (const tf of effectiveTf) {
      try {
        const candles = await getForexCandles(symbol, tf.interval, tf.limit);
        const candleRows = candles as CandleTuple[];
        const hl = highLowFromCandles(candleRows);
        if (!hl) continue;
        const { supportTouches, resistanceTouches } = countSupportResistanceTouches(candleRows, hl.low, hl.high);
        const structureDirection = structureDirectionFromCloses(candleRows);
        const tl =
          trendlineRegressionFromCloses(candleRows) ?? {
            bias: "flat" as const,
            slopePctWindow: 0,
            closeVsLinePct: 0,
            read: "Too few candles for regression trendline.",
          };
        const demand = demandSupplyRead(hl.low, hl.high, supportTouches, resistanceTouches);
        const direction = combineStructureAndTrendline(structureDirection, tl.bias);
        tfResults.push({
          id: tf.id,
          label: tf.label,
          support: hl.low,
          resistance: hl.high,
          structureDirection,
          trendlineBias: tl.bias,
          trendlineSlopePctWindow: tl.slopePctWindow,
          trendlineRead: tl.read,
          demandSupplyRead: demand,
          direction,
          supportTouches,
          resistanceTouches,
        });
      } catch {
        // skip
      }
    }

    if (tfResults.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: `No candle data for ${symbol}. Yahoo Finance may be unavailable—try XAUUSD, EURUSD, or NAS100, or retry in a minute.`,
        },
        { status: 502 },
      );
    }

    const ticker = await getForexTicker(symbol);
    const currentPrice = ticker?.last ? Number(ticker.last) : null;
    const weighted = computeWeightedMarketDirection(tfResults);
    const marketDirection = weighted.direction;
    const alignment = computeNovaQAlignment(tfResults);
    const tradePlan =
      currentPrice != null
        ? buildNovaQTradePlan({ marketDirection, timeframes: tfResults, currentPrice })
        : null;

    return NextResponse.json({
      success: true,
      result: {
        symbol,
        currentPrice,
        marketDirection,
        directionSummary: weighted.summary,
        directionBreakdown: weighted.breakdown,
        hasDirectionConflict: weighted.hasConflict,
        overallTrendlineSummary: overallTrendlineSummary(tfResults),
        contractDescription: forexContractDescription(symbol),
        alignment,
        tradePlan,
        timeframes: tfResults,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "NovaQ Forex failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
