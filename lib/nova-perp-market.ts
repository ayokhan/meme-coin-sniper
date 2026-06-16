import {
  blofinMetalContractDescription,
  getBlofinMetalCandles,
  getBlofinMetalTicker,
  isBlofinMetal,
  normalizeMetalBase,
  novaQUnknownHlSymbolMessage,
  toBlofinInstId,
  type BlofinMetal,
} from "@/lib/blofin-metals";
import { getCandles as getBlofinCandles, getTicker as getBlofinTicker, toBlofinBar } from "@/lib/blofin";
import {
  getCandles as getHlCandles,
  getPerpSpecFromMeta,
  getTicker as getHlTicker,
  type Candle,
  type HyperliquidPerpSpec,
} from "@/lib/hyperliquid";

export type NovaPerpVenue = "hyperliquid" | "blofin";

function normalizeNovaSymbol(raw: string): string {
  return normalizeMetalBase(raw) || String(raw ?? "").trim().toUpperCase().replace(/-USDT$/i, "");
}

async function probeBlofinPerp(symbol: string): Promise<boolean> {
  try {
    const ticker = await getBlofinTicker(toBlofinInstId(symbol));
    const last = ticker?.last ? Number(ticker.last) : NaN;
    return Number.isFinite(last) && last > 0;
  } catch {
    return false;
  }
}

/** Prefer Hyperliquid when listed; otherwise Blofin USDT perps (e.g. SPCX, XAU). */
export async function resolveNovaPerpVenue(rawSymbol: string): Promise<NovaPerpVenue | null> {
  const symbol = normalizeNovaSymbol(rawSymbol);
  if (!symbol) return null;

  const hlSpec = await getPerpSpecFromMeta(symbol);
  if (hlSpec) return "hyperliquid";

  if (await probeBlofinPerp(symbol)) return "blofin";
  return null;
}

export async function getNovaPerpCandles(
  rawSymbol: string,
  venue: NovaPerpVenue,
  hlInterval: string,
  limit: number
): Promise<Candle[]> {
  const symbol = normalizeNovaSymbol(rawSymbol);
  if (venue === "blofin") {
    if (isBlofinMetal(symbol)) return getBlofinMetalCandles(symbol as BlofinMetal, hlInterval, limit);
    return getBlofinCandles(toBlofinInstId(symbol), toBlofinBar(hlInterval), limit) as Promise<Candle[]>;
  }
  return getHlCandles(symbol, hlInterval, limit);
}

export async function getNovaPerpTicker(rawSymbol: string, venue: NovaPerpVenue) {
  const symbol = normalizeNovaSymbol(rawSymbol);
  if (venue === "blofin") {
    if (isBlofinMetal(symbol)) return getBlofinMetalTicker(symbol as BlofinMetal);
    return getBlofinTicker(toBlofinInstId(symbol));
  }
  return getHlTicker(symbol);
}

function buildHlContractDescription(symbol: string, spec: HyperliquidPerpSpec): string {
  const minStep = Math.pow(10, -spec.szDecimals);
  return `${spec.name}: Hyperliquid USDC-margined perpetual, max leverage ${spec.maxLeverage}x, minimum size step about ${minStep} ${spec.name}.`;
}

export async function buildNovaPerpContractDescription(
  rawSymbol: string,
  venue: NovaPerpVenue | null
): Promise<string> {
  const symbol = normalizeNovaSymbol(rawSymbol);
  if (!venue) return novaQUnknownHlSymbolMessage(symbol);
  if (venue === "blofin") {
    if (isBlofinMetal(symbol)) return blofinMetalContractDescription(symbol as BlofinMetal);
    const instId = toBlofinInstId(symbol);
    return `${symbol}: Blofin USDT-margined perpetual (${instId}). Candles and last price from Blofin public market API.`;
  }
  const spec = await getPerpSpecFromMeta(symbol);
  if (!spec) return novaQUnknownHlSymbolMessage(symbol);
  return buildHlContractDescription(symbol, spec);
}
