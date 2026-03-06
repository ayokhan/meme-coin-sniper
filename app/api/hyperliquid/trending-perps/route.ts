import { NextResponse } from "next/server";
import { getTrendingPerps, type TrendingPerp } from "@/lib/api-clients/hyperliquid";
import { getCandles } from "@/lib/hyperliquid";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const TIMEFRAMES = ["24h", "1h", "30m", "15m", "5m"] as const;
type Timeframe = (typeof TIMEFRAMES)[number];

function isTimeframe(s: string | null): s is Timeframe {
  return s !== null && (TIMEFRAMES as readonly string[]).includes(s);
}

function candlePct(candles: Array<[string, string, string, string, string, ...string[]]>, fallback: number): number {
  const c = candles[0];
  if (!c?.[1] || !c?.[4]) return fallback;
  const open = Number(c[1]);
  const close = Number(c[4]);
  return open && open > 0 ? ((close - open) / open) * 100 : fallback;
}

/** GET - Top perp markets by % move. Query: limit=50, timeframe=24h|1h|30m|15m|5m, allTimeframes=1 for 5m/15m/30m/1h/24h in one response */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = Math.min(100, Math.max(10, parseInt(searchParams.get("limit") ?? "50", 10) || 50));
    const timeframe = isTimeframe(searchParams.get("timeframe")) ? searchParams.get("timeframe")! : "24h";
    const allTimeframes = searchParams.get("allTimeframes") === "1" || searchParams.get("allTimeframes") === "true";

    if (allTimeframes) {
      const perps = await getTrendingPerps(50);
      const slice = perps.slice(0, Math.min(25, limitParam));
      const enriched: TrendingPerp[] = await Promise.all(
        slice.map(async (p) => {
          const [c5, c15, c30, c1h, c4h] = await Promise.all([
            getCandles(p.coin, "5m", 1),
            getCandles(p.coin, "15m", 1),
            getCandles(p.coin, "30m", 1),
            getCandles(p.coin, "1h", 1),
            getCandles(p.coin, "4h", 1),
          ]);
          return {
            ...p,
            pct5m: candlePct(c5, p.dayPct),
            pct15m: candlePct(c15, p.dayPct),
            pct30m: candlePct(c30, p.dayPct),
            pct1h: candlePct(c1h, p.dayPct),
            pct4h: candlePct(c4h, p.dayPct),
          };
        })
      );
      return NextResponse.json({ success: true, perps: enriched, timeframe: "24h", allTimeframes: true });
    }

    if (timeframe === "24h") {
      const perps = await getTrendingPerps(limitParam);
      return NextResponse.json({ success: true, perps, timeframe: "24h" });
    }

    const interval = timeframe as "1h" | "30m" | "15m" | "5m";
    const limit = Math.min(25, limitParam);
    const perps = await getTrendingPerps(50);
    const slice = perps.slice(0, limit);
    const withPct: TrendingPerp[] = await Promise.all(
      slice.map(async (p) => {
        const candles = await getCandles(p.coin, interval, 1);
        const open = candles[0]?.[1] ? Number(candles[0][1]) : 0;
        const close = candles[0]?.[4] ? Number(candles[0][4]) : Number(p.markPx);
        const timeframePct = open && open > 0 ? ((close - open) / open) * 100 : p.dayPct;
        return { ...p, timeframePct };
      })
    );
    withPct.sort((a, b) => Math.abs(b.timeframePct ?? 0) - Math.abs(a.timeframePct ?? 0));
    return NextResponse.json({ success: true, perps: withPct, timeframe });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch trending perps";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
