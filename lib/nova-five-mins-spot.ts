/**
 * Spot 1m candles from Binance public API (no key). Used only as *context* for Nova 5 mins AI.
 * Polymarket’s 5m crypto up/down markets resolve on Chainlink streams — not identical to Binance spot.
 */

/** Primary spot REST; US / some hosts block this — we fall back to Binance’s market-data mirror and alternates. */
const BINANCE_SPOT_BASES = [
  "https://api.binance.com",
  "https://data-api.binance.vision",
  "https://api1.binance.com",
  "https://api2.binance.com",
] as const;

const BINANCE_FUTURES = "https://fapi.binance.com";

const ALIAS: Record<string, string> = {
  btc: "BTCUSDT",
  bitcoin: "BTCUSDT",
  eth: "ETHUSDT",
  ethereum: "ETHUSDT",
  sol: "SOLUSDT",
  solana: "SOLUSDT",
  xrp: "XRPUSDT",
  doge: "DOGEUSDT",
  dogecoin: "DOGEUSDT",
  bnb: "BNBUSDT",
  hype: "HYPEUSDT",
  hyperliquid: "HYPEUSDT",
};

export type MinuteBar = { openTime: number; open: number; high: number; low: number; close: number; volume: number };

/** Polymarket-style windows we support (minutes); AI + benchmark use this many 1m bars back. */
export const NOVA_FIVE_MINS_HORIZONS = [5, 15, 60] as const;
export type NovaFiveMinsHorizonMinutes = (typeof NOVA_FIVE_MINS_HORIZONS)[number];

export function normalizeNovaFiveMinsHorizon(n: unknown): NovaFiveMinsHorizonMinutes {
  const x = typeof n === "string" ? parseInt(n, 10) : Number(n);
  if (x === 15 || x === 60) return x;
  return 5;
}

export function klineLimitForHorizon(horizonMinutes: NovaFiveMinsHorizonMinutes): number {
  return Math.min(1000, Math.max(horizonMinutes + 50, 64));
}

/** Open of the 1m candle that started ~`horizonMinutes` before the latest bar (window reference). */
export function benchmarkOpenForHorizon(bars: MinuteBar[], horizonMinutes: number): number | null {
  if (!bars.length || horizonMinutes < 1) return null;
  const idx = bars.length - horizonMinutes;
  if (idx < 0) return null;
  const o = bars[idx]!.open;
  return Number.isFinite(o) ? o : null;
}

/** Coarse tape label from recent closes/range (used when AI omits REGIME or returns mixed). */
export type SpotTapeRegimeHint = "up_slope" | "down_slope" | "sideways" | "mixed";

export function inferTapeRegimeFromBars(bars: MinuteBar[], lookbackBars = 15): SpotTapeRegimeHint {
  if (bars.length < 12) return "mixed";
  const n = Math.min(bars.length, Math.max(12, lookbackBars));
  const closes = bars.map((b) => b.close);
  const start = closes[closes.length - n]!;
  const end = closes[closes.length - 1]!;
  if (!(start > 0)) return "mixed";
  const driftPct = ((end - start) / start) * 100;
  if (driftPct > 0.12) return "up_slope";
  if (driftPct < -0.12) return "down_slope";
  const slice = bars.slice(-Math.min(12, n));
  const hi = Math.max(...slice.map((b) => b.high));
  const lo = Math.min(...slice.map((b) => b.low));
  const mid = (hi + lo) / 2;
  const rangePct = mid > 0 ? ((hi - lo) / mid) * 100 : 0;
  if (Math.abs(driftPct) < 0.06 && rangePct < 0.18) return "sideways";
  if (Math.abs(driftPct) < 0.04) return "sideways";
  return "mixed";
}

export function resolveBinanceSpotPair(raw: string): string | null {
  const t = raw.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!t) return null;
  if (ALIAS[t]) return ALIAS[t];
  let letters = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (letters.endsWith("USDT") && letters.length > 4) letters = letters.slice(0, -4);
  if (letters.length >= 2 && letters.length <= 12) return `${letters}USDT`;
  return null;
}

function parseKlineRows(raw: unknown): MinuteBar[] {
  if (!Array.isArray(raw)) return [];
  const out: MinuteBar[] = [];
  for (const row of raw) {
    if (!Array.isArray(row) || row.length < 6) continue;
    const openTime = Number(row[0]);
    const open = Number(row[1]);
    const high = Number(row[2]);
    const low = Number(row[3]);
    const close = Number(row[4]);
    const volume = Number(row[5]);
    if (!Number.isFinite(openTime) || !Number.isFinite(close)) continue;
    out.push({ openTime, open, high, low, close, volume: Number.isFinite(volume) ? volume : 0 });
  }
  return out;
}

async function fetchSpotKlinesOnce(base: string, pair: string, capped: number): Promise<MinuteBar[]> {
  const url = `${base}/api/v3/klines?symbol=${encodeURIComponent(pair)}&interval=1m&limit=${capped}`;
  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent": "Novastaris-NovaFiveMins/1.0 (+https://novastaris.ai)",
      },
    });
    if (!res.ok) return [];
    const raw = (await res.json().catch(() => [])) as unknown;
    return parseKlineRows(raw);
  } catch {
    return [];
  }
}

async function fetchFuturesKlinesOnce(pair: string, capped: number): Promise<MinuteBar[]> {
  const url = `${BINANCE_FUTURES}/fapi/v1/klines?symbol=${encodeURIComponent(pair)}&interval=1m&limit=${capped}`;
  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent": "Novastaris-NovaFiveMins/1.0 (+https://novastaris.ai)",
      },
    });
    if (!res.ok) return [];
    const raw = (await res.json().catch(() => [])) as unknown;
    return parseKlineRows(raw);
  } catch {
    return [];
  }
}

export type KlineFetchMeta = { feed: "binance_spot" | "binance_futures" };

/**
 * 1m OHLCV for a USDT pair. Tries Binance spot (several bases including data-api.binance.vision), then USDT-M futures.
 * Vercel / some regions often block api.binance.com; the vision mirror usually works.
 */
export async function fetchBinance1mKlines(pair: string, limit = 45): Promise<MinuteBar[]> {
  const r = await fetchBinance1mKlinesWithMeta(pair, limit);
  return r.bars;
}

export async function fetchBinance1mKlinesWithMeta(
  pair: string,
  limit = 45
): Promise<{ bars: MinuteBar[]; meta: KlineFetchMeta | null }> {
  const capped = Math.min(1000, Math.max(5, limit));
  for (const base of BINANCE_SPOT_BASES) {
    const bars = await fetchSpotKlinesOnce(base, pair, capped);
    if (bars.length) return { bars, meta: { feed: "binance_spot" } };
  }
  const fut = await fetchFuturesKlinesOnce(pair, capped);
  if (fut.length) return { bars: fut, meta: { feed: "binance_futures" } };
  return { bars: [], meta: null };
}

export function summarizeBarsForPrompt(
  bars: MinuteBar[],
  pair: string,
  feed: KlineFetchMeta["feed"] = "binance_spot",
  horizonMinutes: NovaFiveMinsHorizonMinutes = 5
): string {
  if (!bars.length) return `${pair}: no data`;
  const last = bars[bars.length - 1]!;
  const prev = bars.length > 1 ? bars[bars.length - 2]! : last;
  const closes = bars.map((b) => b.close);
  const win = closes.slice(-horizonMinutes);
  const changeWindow =
    win.length >= 2 && win[0]! > 0 ? ((last.close - win[0]!) / win[0]!) * 100 : null;
  const rangeLookback = Math.min(30, Math.max(10, horizonMinutes));
  const hiR = Math.max(...bars.slice(-rangeLookback).map((b) => b.high));
  const loR = Math.min(...bars.slice(-rangeLookback).map((b) => b.low));
  const body = last.close - last.open;
  const range = last.high - last.low;
  const lastCandleBias = range > 0 ? (body / range > 0.25 ? "bullish" : body / range < -0.25 ? "bearish" : "neutral") : "neutral";
  const feedLabel =
    feed === "binance_futures" ? `Binance USDT-M futures ${pair} (1m bars)` : `Binance spot ${pair} (1m bars)`;
  const tail = Math.min(24, bars.length);
  return [
    feedLabel,
    `User-selected horizon for this run: ${horizonMinutes} minutes (align mentally with Polymarket ${horizonMinutes}m Up/Down windows, not exact contract times).`,
    `Latest close: ${last.close.toFixed(2)} (1m bar ending ${new Date(last.openTime).toISOString()})`,
    `Prior close: ${prev.close.toFixed(2)}`,
    changeWindow != null && Number.isFinite(changeWindow)
      ? `Approx last-${horizonMinutes}m return on closes: ${changeWindow.toFixed(3)}%`
      : "",
    `Last ~${rangeLookback}m range high/low: ${hiR.toFixed(2)} / ${loR.toFixed(2)}`,
    `Last 1m candle shape: ${lastCandleBias} (O ${last.open.toFixed(2)} H ${last.high.toFixed(2)} L ${last.low.toFixed(2)} C ${last.close.toFixed(2)})`,
    `Last ${tail} closes (oldest→newest): ${closes.slice(-tail).map((c) => c.toFixed(2)).join(", ")}`,
  ]
    .filter(Boolean)
    .join("\n");
}
