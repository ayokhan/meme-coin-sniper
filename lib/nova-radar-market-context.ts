import { getCandles, getTicker } from "@/lib/hyperliquid";
import {
  getBlofinMetalCandles,
  getBlofinMetalInstId,
  getBlofinMetalTicker,
  isBlofinMetal,
  normalizeMetalBase,
  type BlofinMetal,
} from "@/lib/blofin-metals";
import {
  buildStructureTimeframes,
  getOverallDirection,
  type NovaRadarMarketContext,
} from "@/lib/nova-radar";
import { overallTrendlineSummary, type CandleTuple } from "@/lib/nova-q-analytics";

export function normalizeNovaRadarSymbol(raw: string): string {
  return normalizeMetalBase(raw) || "BTC";
}

export async function loadNovaRadarMarketContext(symbolRaw: string): Promise<
  | { ok: true; ctx: NovaRadarMarketContext; normalizedSymbol: string }
  | { ok: false; error: string; status: number }
> {
  const symbol = normalizeNovaRadarSymbol(symbolRaw);
  const useBlofin = isBlofinMetal(symbol);
  const metal = useBlofin ? (symbol as BlofinMetal) : null;
  const blofinInst = metal ? getBlofinMetalInstId(metal)! : "";

  const [ticker, dailyCandles] = await Promise.all([
    useBlofin && metal ? getBlofinMetalTicker(metal) : getTicker(symbol),
    (useBlofin && metal
      ? getBlofinMetalCandles(metal, "1d", 400)
      : getCandles(symbol, "1d", 400)) as Promise<CandleTuple[]>,
  ]);

  let currentPrice = ticker?.last ? Number(ticker.last) : NaN;
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
    const c0 = dailyCandles[0]?.[4];
    const fallback = c0 != null ? Number(c0) : NaN;
    if (Number.isFinite(fallback) && fallback > 0) currentPrice = fallback;
  }

  if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
    return {
      ok: false,
      error: useBlofin
        ? `No live price for ${symbol}. Check Blofin (${blofinInst}) availability.`
        : `No live price for ${symbol}. Check the contract symbol (Hyperliquid perps).`,
      status: 400,
    };
  }

  const fetchCandles = (interval: string, limit: number) =>
    (useBlofin && metal
      ? getBlofinMetalCandles(metal, interval, limit)
      : getCandles(symbol, interval, limit)) as Promise<CandleTuple[]>;

  const tfRows = await buildStructureTimeframes(fetchCandles);

  if (tfRows.length === 0 && dailyCandles.length === 0) {
    return {
      ok: false,
      error: `No candle data for ${symbol}. Try another contract.`,
      status: 400,
    };
  }

  const marketDirection = getOverallDirection(tfRows);
  const trendlineSummary = overallTrendlineSummary(tfRows);

  return {
    ok: true,
    normalizedSymbol: symbol,
    ctx: {
      symbol,
      currentPrice,
      marketDirection,
      overallTrendlineSummary: trendlineSummary,
      structureTimeframes: tfRows,
      dailyCandles,
    },
  };
}
