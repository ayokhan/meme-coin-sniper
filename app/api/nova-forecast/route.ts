import { NextResponse } from "next/server";
import { getSessionAndSubscription } from "@/lib/auth-server";
import { getCandles } from "@/lib/hyperliquid";
import { getTicker } from "@/lib/hyperliquid";
import {
  type CandleTuple,
  combineStructureAndTrendline,
  highLowFromCandles,
  structureDirectionFromCloses,
  trendlineRegressionFromCloses,
} from "@/lib/nova-q-analytics";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Default top alt symbols for NovaForecast (VIP). */
const DEFAULT_SYMBOLS = ["BTC", "ETH", "SOL", "ZEC", "NEO", "DOGE", "AVAX", "LINK", "MATIC", "DOT", "ATOM", "UNI", "XRP", "ADA", "LTC", "BCH", "ETC", "APT", "ARB", "OP"];
const SYMBOL_ALIASES: Record<string, string> = { XAU: "PAXG", GOLD: "PAXG" };

/** Time range options: interval for candles + number of bars. Default 2w. */
export const FORECAST_RANGES = [
  { id: "15m", label: "Last 15 mins", interval: "1m", limit: 15 },
  { id: "1h", label: "1 hour", interval: "1m", limit: 60 },
  { id: "2h", label: "2 hours", interval: "5m", limit: 24 },
  { id: "4h", label: "4 hours", interval: "5m", limit: 48 },
  { id: "6h", label: "6 hours", interval: "15m", limit: 24 },
  { id: "10h", label: "10 hours", interval: "15m", limit: 40 },
  { id: "12h", label: "12 hours", interval: "15m", limit: 48 },
  { id: "24h", label: "24 hours", interval: "1h", limit: 24 },
  { id: "48h", label: "48 hours", interval: "1h", limit: 48 },
  { id: "1w", label: "1 week", interval: "1d", limit: 7 },
  { id: "2w", label: "2 weeks", interval: "1d", limit: 14 },
  { id: "3w", label: "3 weeks", interval: "1d", limit: 21 },
  { id: "4w", label: "4 weeks", interval: "1d", limit: 28 },
  { id: "5w", label: "5 weeks", interval: "1d", limit: 35 },
  { id: "6w", label: "6 weeks", interval: "1d", limit: 42 },
] as const;

export type ForecastRangeId = (typeof FORECAST_RANGES)[number]["id"];

export type NovaForecastItem = {
  symbol: string;
  high: number;
  low: number;
  shortEntry: number;
  longEntry: number;
  currentPrice: number | null;
  structureDirection?: "bullish" | "bearish" | "sideways";
  trendlineBias?: "up" | "down" | "flat";
  direction?: "bullish" | "bearish" | "sideways";
  insight: string;
};

/** GET - NovaForecast Agent: high/low and short/long entry for selected time range. VIP only. */
export async function GET(request: Request) {
  try {
    const { tier } = await getSessionAndSubscription();
    if (tier !== "vip") {
      return NextResponse.json(
        { success: false, error: "NovaForecast Agent is for VIP subscribers.", locked: true },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const symbolsParam = searchParams.get("symbols");
    const symbols: string[] = symbolsParam
      ? symbolsParam.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
      : DEFAULT_SYMBOLS;

    const rangeId = (searchParams.get("range") ?? "2w").toLowerCase();
    const rangeConfig = FORECAST_RANGES.find((r) => r.id === rangeId) ?? FORECAST_RANGES.find((r) => r.id === "2w")!;
    const { interval, limit: candleLimit } = rangeConfig;

    const limit = Math.min(symbols.length, 30);
    const toFetch = symbols.slice(0, limit);

    const forecasts: NovaForecastItem[] = [];

    for (const requestedSymbol of toFetch) {
      try {
        const symbol = SYMBOL_ALIASES[requestedSymbol] ?? requestedSymbol;
        const [candles, ticker] = await Promise.all([
          getCandles(symbol, interval, candleLimit),
          getTicker(symbol),
        ]);
        const rows = candles as CandleTuple[];
        const hl = highLowFromCandles(rows);
        const currentPrice = ticker?.last ? Number(ticker.last) : null;
        if (!hl) {
          forecasts.push({
            symbol,
            high: 0,
            low: 0,
            shortEntry: 0,
            longEntry: 0,
            currentPrice,
            insight: `No data for this range (${rangeConfig.label}).`,
          });
          continue;
        }
        const { high, low } = hl;
        const shortEntry = high;
        const longEntry = low;
        const structureDirection = structureDirectionFromCloses(rows);
        const tl = trendlineRegressionFromCloses(rows);
        const trendlineBias = tl?.bias ?? "flat";
        const blendedDirection = combineStructureAndTrendline(structureDirection, trendlineBias);
        const rangeLabel = rangeConfig.label.toLowerCase();
        let insight = "";
        if (currentPrice != null) {
          if (currentPrice >= high * 0.99) insight = `Price near ${rangeLabel} high—consider short entry zone.`;
          else if (currentPrice <= low * 1.01) insight = `Price near ${rangeLabel} low—consider long entry zone.`;
          else if (currentPrice > (high + low) / 2) insight = `Above range mid—bias: short on retest of high.`;
          else insight = `Below range mid—bias: long on retest of low.`;
        } else {
          insight = `Short entry at ${rangeLabel} high; long entry at ${rangeLabel} low.`;
        }
        insight += ` Structure ${structureDirection}, trendline ${trendlineBias}, blended ${blendedDirection}.`;
        if (requestedSymbol !== symbol) {
          insight += ` Mapped ${requestedSymbol} to ${symbol} on Hyperliquid.`;
        }
        forecasts.push({
          symbol: requestedSymbol,
          high,
          low,
          shortEntry,
          longEntry,
          currentPrice,
          structureDirection,
          trendlineBias,
          direction: blendedDirection,
          insight,
        });
      } catch {
        forecasts.push({
          symbol: requestedSymbol,
          high: 0,
          low: 0,
          shortEntry: 0,
          longEntry: 0,
          currentPrice: null,
          insight: "Could not load data.",
        });
      }
    }

    return NextResponse.json({
      success: true,
      rangeId: rangeConfig.id,
      rangeLabel: rangeConfig.label,
      forecasts,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "NovaForecast failed";
    console.error("NovaForecast error:", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
