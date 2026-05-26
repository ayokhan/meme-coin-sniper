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

export const dynamic = "force-dynamic";
export const maxDuration = 45;

function getOverallDirection(rows: { direction: string }[]): "bullish" | "bearish" | "sideways" {
  let score = 0;
  for (const r of rows) {
    if (r.direction === "bullish") score += 1;
    if (r.direction === "bearish") score -= 1;
  }
  if (score > 0) return "bullish";
  if (score < 0) return "bearish";
  return "sideways";
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const access = await getNovaForexAgentAccess(session);
    if (!access.ok) {
      return NextResponse.json({ success: false, error: access.error, disabled: access.disabled }, { status: access.status });
    }

    const body = await request.json().catch(() => ({}));
    const symbol = normalizeForexSymbol(String(body.symbol ?? "XAUUSD")) || "XAUUSD";
    const timeframesParam = body.timeframes ?? body.tf ?? ["15m", "1h", "1w"];
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
        : NOVA_FOREX_Q_TIMEFRAMES.filter((t) => ["15m", "1h", "1w"].includes(t.id));

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

    const ticker = await getForexTicker(symbol);
    const currentPrice = ticker?.last ? Number(ticker.last) : null;
    const marketDirection = getOverallDirection(tfResults);
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
