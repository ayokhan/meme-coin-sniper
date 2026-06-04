import { getCandles as getHlCandles, getTicker as getHlTicker } from "@/lib/hyperliquid";
import {
  getBlofinMetalCandles,
  getBlofinMetalTicker,
  isBlofinMetal,
  normalizeMetalBase,
  type BlofinMetal,
} from "@/lib/blofin-metals";
import { NOVA_STANDARD_TIMEFRAMES } from "@/lib/nova-timeframes";
import {
  combineStructureAndTrendline,
  countSupportResistanceTouches,
  demandSupplyRead,
  highLowFromCandles,
  overallTrendlineSummary,
  structureDirectionFromCloses,
  trendlineRegressionFromCloses,
  type CandleTuple,
} from "@/lib/nova-q-analytics";
import { buildUnifiedMarketRead, type StructureLevelRow, type UnifiedMarketRead } from "@/lib/nova-market-read";

const DEFAULT_TF_IDS = ["15m", "1h", "1w"];

/** Normalize futures chart symbols (e.g. BTC/USDC, XAU-USDT) to NovaQ/Radar base. */
export function normalizeSymbolForMarketRead(raw: string): string {
  const part = raw.split(/[/\-_\s]/)[0]?.trim() ?? "";
  return normalizeMetalBase(part) || part.toUpperCase() || "BTC";
}

/** Structure-based market read for a symbol (same logic as NovaQ / NovaRadar). */
export async function fetchUnifiedMarketReadForSymbol(rawSymbol: string): Promise<UnifiedMarketRead | null> {
  const symbol = normalizeSymbolForMarketRead(rawSymbol);
  const useBlofinMetal = isBlofinMetal(symbol);
  const tfList = NOVA_STANDARD_TIMEFRAMES.filter((t) => DEFAULT_TF_IDS.includes(t.id));
  const tfRows: StructureLevelRow[] = [];
  const trendlineRows: Array<{ trendlineBias: "up" | "down" | "flat" }> = [];

  for (const tf of tfList) {
    try {
      const candles = useBlofinMetal
        ? await getBlofinMetalCandles(symbol as BlofinMetal, tf.interval, tf.limit)
        : await getHlCandles(symbol, tf.interval, tf.limit);
      const candleRows = candles as CandleTuple[];
      const hl = highLowFromCandles(candleRows);
      if (!hl) continue;
      const { supportTouches, resistanceTouches } = countSupportResistanceTouches(candleRows, hl.low, hl.high);
      const structureDirection = structureDirectionFromCloses(candleRows);
      const tl =
        trendlineRegressionFromCloses(candleRows) ?? {
          bias: "flat" as const,
          slopePctWindow: 0,
          closeVsLinePct: 0,
          read: "Too few candles for trendline.",
        };
      demandSupplyRead(hl.low, hl.high, supportTouches, resistanceTouches);
      const direction = combineStructureAndTrendline(structureDirection, tl.bias);
      tfRows.push({
        support: hl.low,
        resistance: hl.high,
        direction,
      });
      trendlineRows.push({ trendlineBias: tl.bias });
    } catch {
      /* skip failed tf */
    }
  }

  if (tfRows.length === 0) return null;

  const ticker = useBlofinMetal
    ? await getBlofinMetalTicker(symbol as BlofinMetal)
    : await getHlTicker(symbol);
  const currentPrice = ticker?.last ? Number(ticker.last) : null;
  if (currentPrice == null || !Number.isFinite(currentPrice)) return null;

  const summary = overallTrendlineSummary(trendlineRows);

  return buildUnifiedMarketRead(tfRows, currentPrice, summary);
}
