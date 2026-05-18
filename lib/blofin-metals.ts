import type { TrendingPerp } from "@/lib/api-clients/hyperliquid";
import { getCandles as getBlofinCandles, getTicker as getBlofinTicker, toBlofinBar } from "@/lib/blofin";
import type { Candle } from "@/lib/hyperliquid";

/** Blofin USDT-margined metals perps (not on Hyperliquid as XAU/XAG). */
export type BlofinMetal = "XAU" | "XAG";

export const BLOFIN_METAL_INST: Record<BlofinMetal, string> = {
  XAU: "XAU-USDT",
  XAG: "XAG-USDT",
};

/** Normalize GOLD→XAU, SILVER→XAG; strip quote suffixes. */
export function normalizeMetalBase(raw: string): string {
  const upper = String(raw ?? "").trim().toUpperCase();
  if (!upper) return "";
  const stripped = upper
    .replace(/\/USDT$/i, "")
    .replace(/-USDT$/i, "")
    .replace(/\/USD$/i, "")
    .replace(/\.USDT$/i, "")
    .trim();
  const base = (stripped.split(/[-/\s]/)[0] ?? stripped).trim();
  if (base === "GOLD") return "XAU";
  if (base === "SILVER") return "XAG";
  return base;
}

export function isBlofinMetal(symbol: string): symbol is BlofinMetal {
  return symbol === "XAU" || symbol === "XAG";
}

export function getBlofinMetalInstId(symbol: string): string | null {
  if (symbol === "XAU") return BLOFIN_METAL_INST.XAU;
  if (symbol === "XAG") return BLOFIN_METAL_INST.XAG;
  return null;
}

export function blofinMetalContractDescription(symbol: BlofinMetal): string {
  const inst = BLOFIN_METAL_INST[symbol];
  const label = symbol === "XAU" ? "gold" : "silver";
  return `${symbol}: Blofin USDT-margined ${label} perpetual (${inst}). Candles and last price use Blofin’s public market API. Other symbols use Hyperliquid.`;
}

export function novaQUnknownHlSymbolMessage(symbol: string): string {
  return `${symbol} is not listed as a USDC-margined perpetual in Hyperliquid’s meta. NovaQ uses Hyperliquid for most symbols—try the exact HL coin name (for gold on HL, use PAXG), or enter XAU or XAG for Blofin metals (XAU-USDT, XAG-USDT).`;
}

export async function getBlofinMetalCandles(
  symbol: BlofinMetal,
  hlInterval: string,
  limit: number
): Promise<Candle[]> {
  return getBlofinCandles(BLOFIN_METAL_INST[symbol], toBlofinBar(hlInterval), limit) as Promise<Candle[]>;
}

export async function getBlofinMetalTicker(symbol: BlofinMetal) {
  return getBlofinTicker(BLOFIN_METAL_INST[symbol]);
}

/** Minimal perp row for Crypto Buddie / Liquidation Map when HL has no XAU/XAG listing. */
export async function getBlofinMetalTrendingPerp(symbol: BlofinMetal): Promise<TrendingPerp | null> {
  const ticker = await getBlofinMetalTicker(symbol);
  const last = ticker?.last ? Number(ticker.last) : NaN;
  if (!Number.isFinite(last) || last <= 0) return null;

  let dayPct = 0;
  try {
    const candles1d = await getBlofinMetalCandles(symbol, "1d", 2);
    if (candles1d.length >= 2) {
      const prev = Number(candles1d[1][4]);
      const curr = Number(candles1d[0][4]);
      if (prev > 0) dayPct = ((curr - prev) / prev) * 100;
    }
  } catch {
    // keep dayPct 0
  }

  return {
    coin: symbol,
    markPx: String(last),
    prevDayPx: String(last),
    dayPct,
    dayNtlVlm: "0",
    openInterest: "0",
    funding: "0",
  };
}
