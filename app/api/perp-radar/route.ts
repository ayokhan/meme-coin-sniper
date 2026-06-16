import { NextResponse } from "next/server";
import { getSessionAndSubscription } from "@/lib/auth-server";
import { getBinancePerpRadar, enrichPerpRadarWithKlines, type PerpRadarItem } from "@/lib/api-clients/binance-perps";
import {
  enrichBlofinPerpRadarWithKlines,
  getBlofinPerpItemsByBases,
  getBlofinPerpRadar,
} from "@/lib/api-clients/blofin-perps";
import { scanBlofinEarlyBreakouts } from "@/lib/blofin-early-breakout";
import { getCandles as getBlofinCandles } from "@/lib/blofin";
import { getTrendingPerps } from "@/lib/api-clients/hyperliquid";
import { getCandles } from "@/lib/hyperliquid";
import {
  type CandleTuple,
  combineStructureAndTrendline,
  structureDirectionFromCloses,
  trendlineRegressionFromCloses,
} from "@/lib/nova-q-analytics";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function hlCandlePct(candles: Array<[string, string, string, string, string, ...string[]]>): number | null {
  const c = candles[0];
  if (!c?.[1] || !c?.[4]) return null;
  const open = Number(c[1]);
  const close = Number(c[4]);
  return open && open > 0 ? ((close - open) / open) * 100 : null;
}

async function enrichOneItemFromHl(item: PerpRadarItem): Promise<PerpRadarItem> {
  const [c5, c15, c30, c1h, c4h] = await Promise.all([
    getCandles(item.base, "5m", 1),
    getCandles(item.base, "15m", 1),
    getCandles(item.base, "30m", 1),
    getCandles(item.base, "1h", 1),
    getCandles(item.base, "4h", 1),
  ]);
  return {
    ...item,
    pct5m: hlCandlePct(c5) ?? item.pct5m,
    pct15m: hlCandlePct(c15) ?? item.pct15m,
    pct30m: hlCandlePct(c30) ?? item.pct30m,
    pct1h: hlCandlePct(c1h) ?? item.pct1h,
    pct4h: hlCandlePct(c4h) ?? item.pct4h,
  };
}

async function enrichTrendlineOne(item: PerpRadarItem): Promise<PerpRadarItem> {
  try {
    const trendCandles =
      item.exchange === "blofin"
        ? ((await getBlofinCandles(`${item.base}-USDT`, "15m", 8)) as CandleTuple[])
        : ((await getCandles(item.base, "15m", 8)) as CandleTuple[]);
    const struct = structureDirectionFromCloses(trendCandles);
    const tl =
      trendlineRegressionFromCloses(trendCandles) ?? {
        bias: "flat" as const,
        slopePctWindow: 0,
        closeVsLinePct: 0,
        read: "Too few candles for regression trendline.",
      };
    return {
      ...item,
      structureDirection: struct,
      trendlineBias: tl.bias,
      trendlineSlopePctWindow: tl.slopePctWindow,
      trendlineRead: tl.read,
      blendedDirection: combineStructureAndTrendline(struct, tl.bias),
    };
  } catch {
    return item;
  }
}

async function enrichPerpRadarTrendlineBatched(items: PerpRadarItem[], maxItems: number, batchSize: number): Promise<PerpRadarItem[]> {
  const head = items.slice(0, maxItems);
  const tail = items.slice(maxItems);
  const out: PerpRadarItem[] = [];
  for (let i = 0; i < head.length; i += batchSize) {
    const batch = head.slice(i, i + batchSize);
    const part = await Promise.all(batch.map((item) => enrichTrendlineOne(item)));
    out.push(...part);
  }
  return [...out, ...tail];
}

/** Fallback when Binance klines are blocked (e.g. 451): fill 5m–4h from Hyperliquid where the coin exists. */
async function enrichPerpRadarWithHyperliquid(items: PerpRadarItem[], maxItems: number): Promise<PerpRadarItem[]> {
  const toEnrich = items.slice(0, maxItems);
  const enriched = await Promise.all(toEnrich.map((item) => enrichOneItemFromHl(item)));
  return [...enriched, ...items.slice(maxItems)];
}

/** Same as enrichPerpRadarWithHyperliquid but in small batches to avoid hammering Hyperliquid when many rows load at once. */
async function enrichPerpRadarWithHyperliquidBatched(
  items: PerpRadarItem[],
  maxItems: number,
  batchSize: number
): Promise<PerpRadarItem[]> {
  const head = items.slice(0, maxItems);
  const tail = items.slice(maxItems);
  const out: PerpRadarItem[] = [];
  for (let i = 0; i < head.length; i += batchSize) {
    const batch = head.slice(i, i + batchSize);
    const part = await Promise.all(batch.map((item) => enrichOneItemFromHl(item)));
    out.push(...part);
  }
  return [...out, ...tail];
}

/** GET - Perp Radar: extreme movers across supported exchanges (Binance USDT futures first). */
export async function GET(request: Request) {
  try {
    const { isPaid } = await getSessionAndSubscription();
    if (!isPaid) {
      return NextResponse.json(
        { success: false, error: "Subscribe to access Perp Radar.", locked: true },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const minChangePct = Number(searchParams.get("minChangePct") ?? "3");
    const minQuoteVolume = Number(searchParams.get("minQuoteVolume") ?? "100000");
    const limit = Math.min(Number(searchParams.get("limit") ?? "150"), 200);
    const categoryParam = searchParams.get("category");
    const category =
      categoryParam === "macro" || categoryParam === "metals"
        ? categoryParam
        : categoryParam === "hyperliquid"
          ? "hyperliquid"
          : categoryParam === "blofin"
            ? "blofin"
            : undefined;

    if (category === "blofin") {
      const mode = searchParams.get("mode");
      const includeBases = (searchParams.get("includeBases") ?? "")
        .split(",")
        .map((b) => b.trim().toUpperCase())
        .filter(Boolean)
        .slice(0, 20);
      let items: PerpRadarItem[] = [];
      let stale = false;

      if (mode === "early_breakout") {
        const scan = await scanBlofinEarlyBreakouts(Number.isFinite(limit) ? limit : 80);
        items = scan.items;
        stale = scan.stale;
      } else {
        const radar = await getBlofinPerpRadar({
          minChangePct: Number.isFinite(minChangePct) ? minChangePct : 3,
          minQuoteVolume: Number.isFinite(minQuoteVolume) ? minQuoteVolume : 50_000,
          limit: Number.isFinite(limit) ? limit : 150,
        });
        items = radar.items;
        stale = radar.stale;
        try {
          items = await enrichBlofinPerpRadarWithKlines(items, Math.min(35, items.length));
        } catch {
          /* keep 24h-only rows */
        }
      }

      if (includeBases.length > 0) {
        const have = new Set(items.map((i) => i.base));
        const missing = includeBases.filter((b) => !have.has(b));
        if (missing.length > 0) {
          const extra = await getBlofinPerpItemsByBases(missing);
          stale = stale || extra.stale;
          if (extra.items.length > 0) {
            try {
              const enrichedExtra = await enrichBlofinPerpRadarWithKlines(extra.items, extra.items.length);
              items = [...items, ...enrichedExtra];
            } catch {
              items = [...items, ...extra.items];
            }
          }
        }
      }
      try {
        items = await enrichPerpRadarTrendlineBatched(items, Math.min(30, items.length), 8);
      } catch {
        /* keep rows without trendline */
      }
      return NextResponse.json({
        success: true,
        items,
        exchanges: ["blofin"],
        mode: mode === "early_breakout" ? "early_breakout" : "default",
        stale,
        staleNote: stale ? "Showing cached Blofin data — API rate limit (429). Data may be up to ~90s old." : undefined,
      });
    }

    if (category === "hyperliquid") {
      const perps = await getTrendingPerps(Math.min(200, Math.max(20, limit)));
      const items: PerpRadarItem[] = perps.map((p) => ({
        exchange: "hyperliquid",
        symbol: `${p.coin}/USD`,
        base: p.coin,
        quote: "USD",
        change24hPct: p.dayPct,
        lastPrice: Number(p.markPx),
        volume24h: 0,
        quoteVolume24h: Number(p.dayNtlVlm),
        pct5m: undefined,
        pct15m: undefined,
        pct30m: undefined,
        pct1h: undefined,
        pct4h: undefined,
      }));
      let enriched = items;
      try {
        enriched = await enrichPerpRadarWithHyperliquidBatched(items, Math.min(72, items.length), 10);
      } catch {
        /* keep 24h-only rows if HL klines fail */
      }
      try {
        enriched = await enrichPerpRadarTrendlineBatched(enriched, Math.min(60, enriched.length), 10);
      } catch {
        /* keep rows without trendline if trend enrichment fails */
      }
      return NextResponse.json({
        success: true,
        items: enriched,
        exchanges: ["hyperliquid"],
      });
    }

    let binance = await getBinancePerpRadar({
      minChangePct: Number.isFinite(minChangePct) ? minChangePct : 3,
      minQuoteVolume: category === "macro" || category === "metals" ? 0 : (Number.isFinite(minQuoteVolume) ? minQuoteVolume : 100_000),
      limit: Number.isFinite(limit) ? limit : 150,
      ...(category ? { category } : {}),
    });
    try {
      binance = await enrichPerpRadarWithKlines(binance, 30);
    } catch {
      /* keep items without 5m–4h on Binance kline failure */
    }
    if (binance.length > 0 && binance[0].pct5m == null) {
      try {
        binance = await enrichPerpRadarWithHyperliquid(binance, 30);
      } catch {
        /* keep as-is if HL fallback fails */
      }
    }
    try {
      binance = await enrichPerpRadarTrendlineBatched(binance, Math.min(50, binance.length), 10);
    } catch {
      /* keep rows without trendline if trend enrichment fails */
    }

    return NextResponse.json({
      success: true,
      items: binance,
      exchanges: ["binance"],
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Perp Radar failed";
    console.error("Perp Radar error:", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

