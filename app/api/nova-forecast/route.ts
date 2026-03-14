import { NextResponse } from "next/server";
import { getSessionAndSubscription } from "@/lib/auth-server";
import { getCandles } from "@/lib/hyperliquid";
import { getTicker } from "@/lib/hyperliquid";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Default top alt symbols for NovaForecast (VIP). */
const DEFAULT_SYMBOLS = ["BTC", "ETH", "SOL", "ZEC", "NEO", "DOGE", "AVAX", "LINK", "MATIC", "DOT", "ATOM", "UNI", "XRP", "ADA", "LTC", "BCH", "ETC", "APT", "ARB", "OP"];

export type NovaForecastItem = {
  symbol: string;
  high2w: number;
  low2w: number;
  shortEntry: number;
  longEntry: number;
  currentPrice: number | null;
  insight: string;
};

/** Compute 2-week high/low from 1d candles (newest first). */
function highLowFromCandles(candles: Array<[string, string, string, string, string, ...string[]]>): { high: number; low: number } | null {
  if (!candles.length) return null;
  const highs = candles.map((c) => Number(c[2])).filter((n) => Number.isFinite(n));
  const lows = candles.map((c) => Number(c[3])).filter((n) => Number.isFinite(n));
  if (highs.length === 0 || lows.length === 0) return null;
  return { high: Math.max(...highs), low: Math.min(...lows) };
}

/** GET - NovaForecast Agent: 2-week high/low and short/long entry levels for top alts. VIP only. */
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

    const limit = Math.min(symbols.length, 30);
    const toFetch = symbols.slice(0, limit);

    const forecasts: NovaForecastItem[] = [];

    for (const symbol of toFetch) {
      try {
        const [candles, ticker] = await Promise.all([
          getCandles(symbol, "1d", 14),
          getTicker(symbol),
        ]);
        const hl = highLowFromCandles(candles);
        const currentPrice = ticker?.last ? Number(ticker.last) : null;
        if (!hl) {
          forecasts.push({
            symbol,
            high2w: 0,
            low2w: 0,
            shortEntry: 0,
            longEntry: 0,
            currentPrice,
            insight: "No 2-week data for this symbol.",
          });
          continue;
        }
        const { high, low } = hl;
        const shortEntry = high;
        const longEntry = low;
        let insight = "";
        if (currentPrice != null) {
          if (currentPrice >= high * 0.99) insight = "Price near 2w high—consider short entry zone.";
          else if (currentPrice <= low * 1.01) insight = "Price near 2w low—consider long entry zone.";
          else if (currentPrice > (high + low) / 2) insight = "Above 2w range mid—bias: short on retest of high.";
          else insight = "Below 2w range mid—bias: long on retest of low.";
        } else {
          insight = "Short entry at 2w high; long entry at 2w low.";
        }
        forecasts.push({
          symbol,
          high2w: high,
          low2w: low,
          shortEntry,
          longEntry,
          currentPrice,
          insight,
        });
      } catch {
        forecasts.push({
          symbol,
          high2w: 0,
          low2w: 0,
          shortEntry: 0,
          longEntry: 0,
          currentPrice: null,
          insight: "Could not load data.",
        });
      }
    }

    return NextResponse.json({
      success: true,
      forecasts,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "NovaForecast failed";
    console.error("NovaForecast error:", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
