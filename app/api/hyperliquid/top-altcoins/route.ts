import { NextResponse } from "next/server";
import { getPerpsByCoins, TOP_ALTCOINS, type TrendingPerp } from "@/lib/api-clients/hyperliquid";
import { getCandles } from "@/lib/hyperliquid";
import {
  type CandleTuple,
  combineStructureAndTrendline,
  structureDirectionFromCloses,
  trendlineRegressionFromCloses,
} from "@/lib/nova-q-analytics";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function candlePct(candles: Array<[string, string, string, string, string, ...string[]]>, fallback: number): number {
  const c = candles[0];
  if (!c?.[1] || !c?.[4]) return fallback;
  const open = Number(c[1]);
  const close = Number(c[4]);
  return open && open > 0 ? ((close - open) / open) * 100 : fallback;
}

/** GET - Top 20 altcoins perp data (same shape as trending-perps with extended timeframes). */
export async function GET() {
  try {
    const perps = await getPerpsByCoins(TOP_ALTCOINS);
    const enriched: Array<
      TrendingPerp & {
        structureDirection?: "bullish" | "bearish" | "sideways";
        trendlineBias?: "up" | "down" | "flat";
        trendlineSlopePctWindow?: number;
        trendlineRead?: string;
        blendedDirection?: "bullish" | "bearish" | "sideways";
      }
    > = await Promise.all(
      perps.map(async (p) => {
        const [c5, c15, c30, c1h, c4h, c48h, c72h, c1w, c2w, c3w, c4w, cTrend] = await Promise.all([
          getCandles(p.coin, "5m", 1),
          getCandles(p.coin, "15m", 1),
          getCandles(p.coin, "30m", 1),
          getCandles(p.coin, "1h", 1),
          getCandles(p.coin, "4h", 1),
          getCandles(p.coin, "1h", 48),
          getCandles(p.coin, "1h", 72),
          getCandles(p.coin, "1d", 7),
          getCandles(p.coin, "1d", 14),
          getCandles(p.coin, "1d", 21),
          getCandles(p.coin, "1d", 28),
          getCandles(p.coin, "15m", 8),
        ]);
        const trendRows = cTrend as CandleTuple[];
        const struct = structureDirectionFromCloses(trendRows);
        const tl =
          trendlineRegressionFromCloses(trendRows) ?? {
            bias: "flat" as const,
            slopePctWindow: 0,
            closeVsLinePct: 0,
            read: "Too few candles for regression trendline.",
          };
        return {
          ...p,
          pct5m: candlePct(c5, p.dayPct),
          pct15m: candlePct(c15, p.dayPct),
          pct30m: candlePct(c30, p.dayPct),
          pct1h: candlePct(c1h, p.dayPct),
          pct4h: candlePct(c4h, p.dayPct),
          pct48h: candlePct(c48h, p.dayPct),
          pct72h: candlePct(c72h, p.dayPct),
          pct1w: candlePct(c1w, p.dayPct),
          pct2w: candlePct(c2w, p.dayPct),
          pct3w: candlePct(c3w, p.dayPct),
          pct4w: candlePct(c4w, p.dayPct),
          structureDirection: struct,
          trendlineBias: tl.bias,
          trendlineSlopePctWindow: tl.slopePctWindow,
          trendlineRead: tl.read,
          blendedDirection: combineStructureAndTrendline(struct, tl.bias),
        };
      })
    );
    return NextResponse.json({ success: true, perps: enriched });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch top altcoins";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
