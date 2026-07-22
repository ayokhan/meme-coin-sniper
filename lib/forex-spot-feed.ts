/**
 * Live spot mid quotes (Swissquote public BBO) — aligns XAUUSD/XAGUSD with
 * broker / TradingView-style spot rather than Yahoo COMEX futures (GC=F / SI=F).
 */

import type { Candle } from "@/lib/hyperliquid";

/** Metals where Yahoo uses futures proxies; calibrate OHLC to spot mid. */
export const SPOT_CALIBRATED_METAL_SYMBOLS = new Set(["XAUUSD", "XAGUSD"]);

type SpotCache = { mid: number; at: number };
const spotMidCache = new Map<string, SpotCache>();
const SPOT_CACHE_MS = 8_000;

function normalizeMetalKey(symbol: string): string {
  const upper = String(symbol ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9]/g, "");
  if (upper === "GOLD" || upper === "XAU") return "XAUUSD";
  if (upper === "SILVER" || upper === "XAG") return "XAGUSD";
  return upper;
}

function parseSwissquotePair(symbol: string): { base: string; quote: string } | null {
  const key = normalizeMetalKey(symbol);
  if (key === "XAUUSD") return { base: "XAU", quote: "USD" };
  if (key === "XAGUSD") return { base: "XAG", quote: "USD" };
  if (/^[A-Z]{6}$/.test(key)) return { base: key.slice(0, 3), quote: key.slice(3) };
  return null;
}

/** Live spot mid from Swissquote public forex feed (no API key). */
export async function getForexSpotMid(symbol: string): Promise<number | null> {
  const key = normalizeMetalKey(symbol);
  const pair = parseSwissquotePair(key);
  if (!pair) return null;

  const cached = spotMidCache.get(key);
  if (cached && Date.now() - cached.at < SPOT_CACHE_MS) return cached.mid;

  const url = `https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/${pair.base}/${pair.quote}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; NovaStaris/1.0)" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return cached?.mid ?? null;
    const json = (await res.json()) as Array<{
      spreadProfilePrices?: Array<{ bid?: number; ask?: number; spreadProfile?: string }>;
    }>;
    const profiles = json[0]?.spreadProfilePrices ?? [];
    // Prefer tighter / prime-style profiles when present (closer to institutional CFD quotes).
    const ranked = [...profiles].sort((a, b) => {
      const score = (p: { bid?: number; ask?: number; spreadProfile?: string }) => {
        const name = String(p.spreadProfile ?? "").toLowerCase();
        if (name.includes("prime")) return 0;
        if (name.includes("premium")) return 1;
        if (name.includes("standard")) return 2;
        const bid = Number(p.bid);
        const ask = Number(p.ask);
        if (!Number.isFinite(bid) || !Number.isFinite(ask)) return 99;
        return 3 + (ask - bid);
      };
      return score(a) - score(b);
    });
    const row = ranked[0] ?? profiles[0];
    const bid = row?.bid;
    const ask = row?.ask;
    if (bid == null || ask == null || !Number.isFinite(bid) || !Number.isFinite(ask)) {
      return cached?.mid ?? null;
    }
    const mid = (bid + ask) / 2;
    spotMidCache.set(key, { mid, at: Date.now() });
    return mid;
  } catch {
    return cached?.mid ?? null;
  }
}

/** Shift all OHLC by (spotMid − newest close) so last price matches live spot. */
export function calibrateCandlesToSpotMid(candles: Candle[], spotMid: number): Candle[] {
  if (!candles.length || !Number.isFinite(spotMid)) return candles;
  const ref = Number(candles[0]![4]);
  if (!Number.isFinite(ref)) return candles;
  const offset = spotMid - ref;
  if (Math.abs(offset) < 0.0001) return candles;

  return candles.map((c) => {
    const n = (i: number) => {
      const v = Number(c[i]);
      return Number.isFinite(v) ? String(v + offset) : c[i];
    };
    return [c[0]!, n(1), n(2), n(3), n(4), c[5]!, c[6]!, c[7]!, c[8]!];
  });
}

export function usesSpotCalibration(symbol: string): boolean {
  return SPOT_CALIBRATED_METAL_SYMBOLS.has(normalizeMetalKey(symbol));
}
