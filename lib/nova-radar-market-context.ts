import {
  getNovaPerpCandles,
  getNovaPerpTicker,
  resolveNovaPerpVenue,
  type NovaPerpVenue,
} from "@/lib/nova-perp-market";
import { normalizeMetalBase } from "@/lib/blofin-metals";
import {
  buildStructureTimeframes,
  getOverallDirection,
  type NovaRadarMarketContext,
} from "@/lib/nova-radar";
import { overallTrendlineSummary, type CandleTuple } from "@/lib/nova-q-analytics";

export function normalizeNovaRadarSymbol(raw: string): string {
  return normalizeMetalBase(raw) || String(raw ?? "").trim().toUpperCase().replace(/-USDT$/i, "") || "BTC";
}

export async function loadNovaRadarMarketContext(symbolRaw: string): Promise<
  | {
      ok: true;
      ctx: NovaRadarMarketContext;
      normalizedSymbol: string;
      venue: NovaPerpVenue;
    }
  | { ok: false; error: string; status: number }
> {
  const symbol = normalizeNovaRadarSymbol(symbolRaw);
  if (!symbol) {
    return { ok: false, error: "Enter a contract symbol (e.g. BTC, SNXX, XAU).", status: 400 };
  }

  const venue = await resolveNovaPerpVenue(symbol);
  if (!venue) {
    return {
      ok: false,
      error: `No live price for ${symbol}. Not found on Hyperliquid or Blofin USDT perps — check the symbol (e.g. BTC, SNXX, XAU).`,
      status: 400,
    };
  }

  const [ticker, dailyCandles] = await Promise.all([
    getNovaPerpTicker(symbol, venue),
    getNovaPerpCandles(symbol, venue, "1d", 400) as Promise<CandleTuple[]>,
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
      error:
        venue === "blofin"
          ? `No live price for ${symbol}. Check Blofin (${symbol}-USDT) availability.`
          : `No live price for ${symbol}. Check the contract symbol (Hyperliquid perps).`,
      status: 400,
    };
  }

  const fetchCandles = (interval: string, limit: number) =>
    getNovaPerpCandles(symbol, venue, interval, limit) as Promise<CandleTuple[]>;

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
    venue,
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
