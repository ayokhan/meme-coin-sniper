import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  getUniverseSymbols,
  getPerpsByCoins,
  getTrendingPerps,
  type TrendingPerp,
} from "@/lib/api-clients/hyperliquid";
import { getCandles } from "@/lib/hyperliquid";

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

async function enrichWithTimeframes(perps: TrendingPerp[]): Promise<(TrendingPerp & { pct5m?: number; pct15m?: number; pct30m?: number; pct1h?: number; pct4h?: number })[]> {
  return Promise.all(
    perps.map(async (p) => {
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

    const count = await prisma.knownPerpSymbol.count();
    const now = new Date();
    const seedCutoff = new Date(now.getTime() - SEED_OFFSET_DAYS * 24 * 60 * 60 * 1000);

    if (count === 0) {
      await prisma.knownPerpSymbol.createMany({
        data: universe.map((symbol) => ({ symbol, firstSeenAt: seedCutoff })),
        skipDuplicates: true,
      });
    } else {
      const existing = await prisma.knownPerpSymbol.findMany({
        where: { symbol: { in: universe } },
        select: { symbol: true },
      });
      const existingSet = new Set(existing.map((r) => r.symbol));
      const toAdd = universe.filter((s) => !existingSet.has(s));
      if (toAdd.length > 0) {
        await prisma.knownPerpSymbol.createMany({
          data: toAdd.map((symbol) => ({ symbol })),
          skipDuplicates: true,
        });
      }
    }

    const newCutoff = new Date(now.getTime() - NEW_DAYS * 24 * 60 * 60 * 1000);
    const newRows = await prisma.knownPerpSymbol.findMany({
      where: { firstSeenAt: { gte: newCutoff } },
      select: { symbol: true },
      orderBy: { firstSeenAt: "desc" },
    });
    const newSymbols = newRows.map((r) => r.symbol);

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
