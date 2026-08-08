import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { forexContractDescription, getForexCandles, getForexTicker, normalizeForexSymbol } from "@/lib/forex-market";
import { NOVA_FOREX_Q_TIMEFRAMES } from "@/lib/nova-forex-timeframes";
import {
  combineStructureAndTrendline,
  highLowFromCandles,
  structureDirectionFromCloses,
  trendlineRegressionFromCloses,
  type CandleTuple,
} from "@/lib/nova-q-analytics";
import {
  deriveStrategy,
  getRecommendedDirection,
  suggestEntryExit,
  suggestTrendlineEntry,
} from "@/lib/nova-smart-logic";
import { getNovaForexAgentAccess } from "@/lib/vip-futures-addon-access";

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
    const symbolsParam = body.symbols ?? body.symbol ?? "XAUUSD";
    const timeframesParam = body.timeframes ?? body.tf ?? "15m,1h,1w";

    const symbols = (typeof symbolsParam === "string"
      ? symbolsParam.split(/[\s,]+/)
      : Array.isArray(symbolsParam)
        ? symbolsParam.map(String)
        : []
    )
      .map((s) => normalizeForexSymbol(s.trim()))
      .filter(Boolean);

    if (symbols.length === 0) {
      return NextResponse.json({ success: false, error: "Enter a symbol (e.g. XAUUSD)." }, { status: 400 });
    }

    const requestedTf = (typeof timeframesParam === "string"
      ? timeframesParam.split(/[\s,]+/)
      : timeframesParam
    )
      .map((s: string) => String(s).trim().toLowerCase())
      .filter(Boolean);

    const effectiveTf =
      NOVA_FOREX_Q_TIMEFRAMES.filter((t) => requestedTf.includes(t.id)).length > 0
        ? NOVA_FOREX_Q_TIMEFRAMES.filter((t) => requestedTf.includes(t.id))
        : NOVA_FOREX_Q_TIMEFRAMES.filter((t) => ["15m", "1h", "1w"].includes(t.id));

    const results = [];
    for (const symbol of symbols.slice(0, 5)) {
      try {
        const tfData: Array<{
          id: string;
          label: string;
          high: number;
          low: number;
          structureDirection: "bullish" | "bearish" | "sideways";
          trendlineBias: "up" | "down" | "flat";
          direction: "bullish" | "bearish" | "sideways";
          trendlineRead: string;
        }> = [];

        for (const tf of effectiveTf) {
          const candles = await getForexCandles(symbol, tf.interval, tf.limit);
          const hl = highLowFromCandles(candles as CandleTuple[]);
          if (!hl) continue;
          const rows = candles as CandleTuple[];
          const structureDirection = structureDirectionFromCloses(rows);
          const tl =
            trendlineRegressionFromCloses(rows) ?? {
              bias: "flat" as const,
              slopePctWindow: 0,
              closeVsLinePct: 0,
              read: "Too few candles.",
            };
          tfData.push({
            id: tf.id,
            label: tf.label,
            high: hl.high,
            low: hl.low,
            structureDirection,
            trendlineBias: tl.bias,
            direction: combineStructureAndTrendline(structureDirection, tl.bias),
            trendlineRead: tl.read,
          });
        }

        const ticker = await getForexTicker(symbol);
        const currentPrice = ticker?.last ? Number(ticker.last) : null;

        if (tfData.length === 0) {
          results.push({
            symbol,
            timeframes: [],
            smartShortEntry: 0,
            smartLongEntry: 0,
            currentPrice,
            strategy: "swing",
            strategyNote: "No candle data.",
            contractDescription: forexContractDescription(symbol),
            suggestedLongEntry: 0,
            suggestedLongExit: 0,
            suggestedShortEntry: 0,
            suggestedShortExit: 0,
            entryExitNote: "",
            trendlineEntryLong: null,
            trendlineEntryShort: null,
            trendlineEntryNote: "",
            trendlineConfidence: "low" as const,
            trendlineConfidenceNote: "",
            recommendedDirection: "neutral" as const,
            recommendationNote: "No data for selected timeframes.",
          });
          continue;
        }

        const smartShortEntry = Math.max(...tfData.map((t) => t.high));
        const smartLongEntry = Math.min(...tfData.map((t) => t.low));
        const { strategy, note } = deriveStrategy(tfData, currentPrice);
        const entryExit = suggestEntryExit(smartShortEntry, smartLongEntry, currentPrice, strategy);
        const trendlineEntry = suggestTrendlineEntry(smartShortEntry, smartLongEntry, currentPrice, tfData);
        const { direction: recommendedDirection, recommendationNote } = getRecommendedDirection(
          smartShortEntry,
          smartLongEntry,
          currentPrice,
          tfData
        );

        results.push({
          symbol,
          contractDescription: forexContractDescription(symbol),
          timeframes: tfData.map((t) => ({
            id: t.id,
            label: t.label,
            high: t.high,
            low: t.low,
            structureDirection: t.structureDirection,
            trendlineBias: t.trendlineBias,
            direction: t.direction,
            trendlineRead: t.trendlineRead,
          })),
          smartShortEntry,
          smartLongEntry,
          currentPrice,
          strategy,
          strategyNote: note,
          ...entryExit,
          ...trendlineEntry,
          recommendedDirection,
          recommendationNote,
        });
      } catch {
        results.push({
          symbol,
          timeframes: [],
          smartShortEntry: 0,
          smartLongEntry: 0,
          currentPrice: null,
          strategy: "swing",
          strategyNote: "Could not load forex data.",
          contractDescription: forexContractDescription(symbol),
          suggestedLongEntry: 0,
          suggestedLongExit: 0,
          suggestedShortEntry: 0,
          suggestedShortExit: 0,
          entryExitNote: "",
          trendlineEntryLong: null,
          trendlineEntryShort: null,
          trendlineEntryNote: "",
          trendlineConfidence: "low" as const,
          trendlineConfidenceNote: "",
          recommendedDirection: "neutral" as const,
          recommendationNote: "Could not load data.",
        });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Nova Forex Smart failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
