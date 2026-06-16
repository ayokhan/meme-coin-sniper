import { NextResponse } from "next/server";
import { getSessionAndSubscription } from "@/lib/auth-server";
import {
  buildNovaPerpContractDescription,
  getNovaPerpCandles,
  getNovaPerpTicker,
  resolveNovaPerpVenue,
} from "@/lib/nova-perp-market";
import { normalizeMetalBase } from "@/lib/blofin-metals";
import {
  type CandleTuple,
  combineStructureAndTrendline,
  countSupportResistanceTouches,
  demandSupplyRead,
  highLowFromCandles,
  overallTrendlineSummary,
  structureDirectionFromCloses,
  trendlineRegressionFromCloses,
} from "@/lib/nova-q-analytics";

/** Optional one-liner for symbols users often confuse with other venues. */
const NOVA_Q_KNOWN_ASSET_NOTES: Record<string, string> = {
  PAXG:
    "Paxos Gold (tokenized gold exposure). It is not the same instrument or ticker as classic metals XAU/USD or another venue’s XAU-USDT; NovaQ uses Hyperliquid’s perp candles and mid, which can differ from global spot references.",
};

export const dynamic = "force-dynamic";
export const maxDuration = 45;

import { NOVA_STANDARD_TIMEFRAMES } from "@/lib/nova-timeframes";
import { buildNovaQTradePlan, computeNovaQAlignment } from "@/lib/nova-q-trade-plan";
import { buildUnifiedMarketRead } from "@/lib/nova-market-read";

const NOVA_Q_TIMEFRAMES = NOVA_STANDARD_TIMEFRAMES;

type NovaQTfResult = {
  id: string;
  label: string;
  support: number;
  resistance: number;
  /** Half-window average close drift (legacy NovaQ structure read). */
  structureDirection: "bullish" | "bearish" | "sideways";
  /** Least-squares regression through closes in the window (trendline-style proxy). */
  trendlineBias: "up" | "down" | "flat";
  trendlineSlopePctWindow: number;
  trendlineRead: string;
  /** Retest frequency near window low / high — demand/supply proxy. */
  demandSupplyRead: string;
  /** Structure + trendline combined; conflicts resolve to sideways. */
  direction: "bullish" | "bearish" | "sideways";
  /** Candles in the window whose low traded within tolerance of period support (min low). */
  supportTouches: number;
  /** Candles in the window whose high traded within tolerance of period resistance (max high). */
  resistanceTouches: number;
};

function normalizeSymbol(raw: string): string {
  return normalizeMetalBase(raw) || "BTC";
}

function getOverallDirection(timeframes: NovaQTfResult[]): "bullish" | "bearish" | "sideways" {
  if (timeframes.length === 0) return "sideways";
  let score = 0;
  for (const tf of timeframes) {
    if (tf.direction === "bullish") score += 1;
    if (tf.direction === "bearish") score -= 1;
  }
  if (score > 0) return "bullish";
  if (score < 0) return "bearish";
  return "sideways";
}

export async function POST(request: Request) {
  try {
    const { tier } = await getSessionAndSubscription();
    if (tier !== "vip") {
      return NextResponse.json(
        { success: false, error: "NovaQ is for VIP subscribers.", locked: true },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const symbol = normalizeSymbol(String(body.symbol ?? "BTC"));
    const timeframesParam = body.timeframes ?? body.tf ?? ["15m", "1h", "1w"];
    const requestedTf = (typeof timeframesParam === "string"
      ? timeframesParam.split(/[\s,]+/).map((s) => s.trim().toLowerCase())
      : Array.isArray(timeframesParam)
        ? timeframesParam.map((s) => String(s).trim().toLowerCase())
        : []
    ).filter(Boolean);

    const selected = NOVA_Q_TIMEFRAMES.filter((t) => requestedTf.includes(t.id));
    const effectiveTf =
      selected.length > 0 ? selected : NOVA_Q_TIMEFRAMES.filter((t) => ["15m", "1h", "1w"].includes(t.id));

    const venue = await resolveNovaPerpVenue(symbol);
    let contractDescription = await buildNovaPerpContractDescription(symbol, venue);
    if (venue === "hyperliquid" && NOVA_Q_KNOWN_ASSET_NOTES[symbol]) {
      contractDescription = `${contractDescription} ${NOVA_Q_KNOWN_ASSET_NOTES[symbol]}`;
    }
    if (!venue) {
      return NextResponse.json({
        success: true,
        result: {
          symbol,
          currentPrice: null,
          marketDirection: "sideways" as const,
          overallTrendlineSummary: "",
          marketRead: null,
          contractDescription,
          alignment: null,
          tradePlan: null,
          timeframes: [],
        },
      });
    }

    const tfResults: NovaQTfResult[] = [];
    for (const tf of effectiveTf) {
      try {
        const candles = await getNovaPerpCandles(symbol, venue, tf.interval, tf.limit);
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
            read: "Too few candles in this window for regression trendline—pick a wider timeframe.",
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
        // Ignore a failed timeframe and continue with others.
      }
    }

    const ticker = await getNovaPerpTicker(symbol, venue);
    const currentPrice = ticker?.last ? Number(ticker.last) : null;
    const marketDirection = getOverallDirection(tfResults);
    const overallTrendlineSummaryText = overallTrendlineSummary(tfResults);
    const alignment = computeNovaQAlignment(tfResults);
    const tradePlan =
      currentPrice != null
        ? buildNovaQTradePlan({
            marketDirection,
            timeframes: tfResults,
            currentPrice,
          })
        : null;

    const marketRead =
      currentPrice != null
        ? buildUnifiedMarketRead(tfResults, currentPrice, overallTrendlineSummaryText)
        : null;

    return NextResponse.json({
      success: true,
      result: {
        symbol,
        currentPrice,
        marketDirection,
        overallTrendlineSummary: overallTrendlineSummaryText,
        marketRead,
        contractDescription,
        alignment,
        tradePlan,
        timeframes: tfResults,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "NovaQ failed";
    console.error("NovaQ error:", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
