import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  getUniverseSymbols,
  getPerpsByCoins,
  getTrendingPerps,
  type TrendingPerp,
} from "@/lib/api-clients/hyperliquid";
import { getCandles } from "@/lib/hyperliquid";
import {
  type CandleTuple,
  combineStructureAndTrendline,
  structureDirectionFromCloses,
  trendlineRegressionFromCloses,
} from "@/lib/nova-q-analytics";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NEW_DAYS = 7;
const SEED_OFFSET_DAYS = 8;

function candlePct(
  candles: Array<[string, string, string, string, string, ...string[]]>,
  fallback: number
): number {
  const c = candles[0];
  if (!c?.[1] || !c?.[4]) return fallback;
  const open = Number(c[1]);
  const close = Number(c[4]);
  return open && open > 0 ? ((close - open) / open) * 100 : fallback;
}

async function enrichWithTimeframes(
  perps: TrendingPerp[]
): Promise<
  (TrendingPerp & {
    pct5m?: number;
    pct15m?: number;
    pct30m?: number;
    pct1h?: number;
    pct4h?: number;
    pct48h?: number;
    pct72h?: number;
    pct1w?: number;
    pct2w?: number;
    pct3w?: number;
    pct4w?: number;
    structureDirection?: "bullish" | "bearish" | "sideways";
    trendlineBias?: "up" | "down" | "flat";
    trendlineSlopePctWindow?: number;
    trendlineRead?: string;
    blendedDirection?: "bullish" | "bearish" | "sideways";
  })[]
> {
  return Promise.all(
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
}

/** GET - New perps (first seen in last 7 days) with momentum; falls back to top momentum if none new. */
export async function GET() {
  try {
    const universe = await getUniverseSymbols();
    if (universe.length === 0) {
      const fallback = await getTrendingPerps(25);
      const enriched = await enrichWithTimeframes(fallback);
      return NextResponse.json({
        success: true,
        perps: enriched,
        newOnly: false,
      });
    }

    const count = await (prisma as any).knownPerpSymbol.count();
    const now = new Date();
    const seedCutoff = new Date(now.getTime() - SEED_OFFSET_DAYS * 24 * 60 * 60 * 1000);

    if (count === 0) {
      await (prisma as any).knownPerpSymbol.createMany({
        data: universe.map((symbol) => ({ symbol, firstSeenAt: seedCutoff })),
        skipDuplicates: true,
      });
    } else {
      const existing = await (prisma as any).knownPerpSymbol.findMany({
        where: { symbol: { in: universe } },
        select: { symbol: true },
      });
      const existingSet = new Set(existing.map((r: { symbol: string }) => r.symbol));
      const toAdd = universe.filter((s) => !existingSet.has(s));
      if (toAdd.length > 0) {
        await (prisma as any).knownPerpSymbol.createMany({
          data: toAdd.map((symbol) => ({ symbol })),
          skipDuplicates: true,
        });
      }
    }

    const newCutoff = new Date(now.getTime() - NEW_DAYS * 24 * 60 * 60 * 1000);
    const newRows = await (prisma as any).knownPerpSymbol.findMany({
      where: { firstSeenAt: { gte: newCutoff } },
      select: { symbol: true },
      orderBy: { firstSeenAt: "desc" },
    });
    const newSymbols = newRows.map((r: { symbol: string }) => r.symbol);

    let perps: TrendingPerp[];
    let newOnly: boolean;

    if (newSymbols.length > 0) {
      perps = await getPerpsByCoins(newSymbols);
      perps.sort((a, b) => Math.abs(b.dayPct) - Math.abs(a.dayPct));
      newOnly = true;
    } else {
      perps = await getTrendingPerps(25);
      newOnly = false;
    }

    const enriched = await enrichWithTimeframes(perps);
    return NextResponse.json({
      success: true,
      perps: enriched,
      newOnly,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch hot new perps";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
