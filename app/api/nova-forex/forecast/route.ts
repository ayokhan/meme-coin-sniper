import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  FOREX_FORECAST_DEFAULT_SYMBOLS,
  forexContractDescription,
  getForexCandles,
  normalizeForexSymbol,
} from "@/lib/forex-market";
import { NOVA_FOREX_FORECAST_RANGES } from "@/lib/nova-forex-timeframes";
import {
  combineStructureAndTrendline,
  highLowFromCandles,
  structureDirectionFromCloses,
  trendlineRegressionFromCloses,
  type CandleTuple,
} from "@/lib/nova-q-analytics";
import { getNovaForexAgentAccess } from "@/lib/vip-futures-addon-access";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const access = await getNovaForexAgentAccess(session);
    if (!access.ok) {
      return NextResponse.json({ success: false, error: access.error, disabled: access.disabled }, { status: access.status });
    }

    const { searchParams } = new URL(request.url);
    const symbolsParam = searchParams.get("symbols");
    const symbols: string[] = symbolsParam
      ? symbolsParam.split(",").map((s) => normalizeForexSymbol(s.trim())).filter(Boolean)
      : [...FOREX_FORECAST_DEFAULT_SYMBOLS];

    const rangeId = (searchParams.get("range") ?? "2w").toLowerCase();
    const rangeConfig = NOVA_FOREX_FORECAST_RANGES.find((r) => r.id === rangeId) ?? NOVA_FOREX_FORECAST_RANGES.find((r) => r.id === "2w")!;
    const { interval, limit: candleLimit } = rangeConfig;

    const toFetch = symbols.slice(0, 20);
    const items: Array<{
      symbol: string;
      high: number;
      low: number;
      shortEntry: number;
      longEntry: number;
      currentPrice: number | null;
      direction?: "bullish" | "bearish" | "sideways";
      insight: string;
    }> = [];

    for (const sym of toFetch) {
      try {
        const candles = await getForexCandles(sym, interval, candleLimit);
        const hl = highLowFromCandles(candles as CandleTuple[]);
        if (!hl) continue;
        // Reuse last close — avoid a second Yahoo round-trip per symbol (Vercel CPU).
        const currentPrice = Number(candles[0]?.[4]);
        const price = Number.isFinite(currentPrice) ? currentPrice : null;
        const structureDirection = structureDirectionFromCloses(candles as CandleTuple[]);
        const tl = trendlineRegressionFromCloses(candles as CandleTuple[]) ?? { bias: "flat" as const };
        const direction = combineStructureAndTrendline(structureDirection, tl.bias);
        const mid = (hl.high + hl.low) / 2;
        let insight = "Mid-range—wait for retest of high or low.";
        if (price != null) {
          if (price > mid) insight = "Bias: short on retest of high (price above range mid).";
          else if (price < mid) insight = "Bias: long on retest of low (price below range mid).";
        }
        items.push({
          symbol: sym,
          high: hl.high,
          low: hl.low,
          shortEntry: hl.high,
          longEntry: hl.low,
          currentPrice: price,
          direction,
          insight,
        });
      } catch {
        // skip symbol
      }
    }

    return NextResponse.json({
      success: true,
      range: rangeConfig.id,
      rangeLabel: rangeConfig.label,
      items,
      dataNote: forexContractDescription(toFetch[0] ?? "XAUUSD"),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Nova Forex Forecast failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
