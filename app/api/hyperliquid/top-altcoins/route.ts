import { NextResponse } from "next/server";
import { getPerpsByCoins, TOP_ALTCOINS, type TrendingPerp } from "@/lib/api-clients/hyperliquid";
import { getCandles } from "@/lib/hyperliquid";

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
    const enriched: TrendingPerp[] = await Promise.all(
      perps.map(async (p) => {
        const [c5, c15, c30, c1h, c4h, c48h, c72h, c1w, c2w, c3w, c4w] = await Promise.all([
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
        ]);
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
        };
      })
    );
    return NextResponse.json({ success: true, perps: enriched });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch top altcoins";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
