/**
 * Spot 1m candles from Binance public API (no key). Used only as *context* for Nova 5 mins AI.
 * Polymarket’s 5m crypto up/down markets resolve on Chainlink streams — not identical to Binance spot.
 */

const BINANCE = "https://api.binance.com";

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

/** Coarse tape label from recent closes/range (used when AI omits REGIME or returns mixed). */
export type SpotTapeRegimeHint = "up_slope" | "down_slope" | "sideways" | "mixed";

export function inferTapeRegimeFromBars(bars: MinuteBar[]): SpotTapeRegimeHint {
  if (bars.length < 15) return "mixed";
  const closes = bars.map((b) => b.close);
  const start = closes[closes.length - 15]!;
  const end = closes[closes.length - 1]!;
  if (!(start > 0)) return "mixed";
  const driftPct = ((end - start) / start) * 100;
  if (driftPct > 0.12) return "up_slope";
  if (driftPct < -0.12) return "down_slope";
  const slice = bars.slice(-12);
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

export async function fetchBinance1mKlines(pair: string, limit = 45): Promise<MinuteBar[]> {
  const capped = Math.min(1000, Math.max(5, limit));
  const url = `${BINANCE}/api/v3/klines?symbol=${encodeURIComponent(pair)}&interval=1m&limit=${capped}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];
  const raw = (await res.json().catch(() => [])) as unknown;
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

export function summarizeBarsForPrompt(bars: MinuteBar[], pair: string): string {
  if (!bars.length) return `${pair}: no data`;
  const last = bars[bars.length - 1]!;
  const prev = bars.length > 1 ? bars[bars.length - 2]! : last;
  const closes = bars.map((b) => b.close);
  const last5 = closes.slice(-5);
  const change5m =
    last5.length >= 2 && last5[0]! > 0 ? ((last.close - last5[0]!) / last5[0]!) * 100 : null;
  const hi10 = Math.max(...bars.slice(-10).map((b) => b.high));
  const lo10 = Math.min(...bars.slice(-10).map((b) => b.low));
  const body = last.close - last.open;
  const range = last.high - last.low;
  const lastCandleBias = range > 0 ? (body / range > 0.25 ? "bullish" : body / range < -0.25 ? "bearish" : "neutral") : "neutral";
  return [
    `Binance spot ${pair} (1m bars)`,
    `Latest close: ${last.close.toFixed(2)} (1m bar ending ${new Date(last.openTime).toISOString()})`,
    `Prior close: ${prev.close.toFixed(2)}`,
    change5m != null && Number.isFinite(change5m) ? `Approx last-5m return on closes: ${change5m.toFixed(3)}%` : "",
    `Last ~10m range high/low: ${hi10.toFixed(2)} / ${lo10.toFixed(2)}`,
    `Last 1m candle shape: ${lastCandleBias} (O ${last.open.toFixed(2)} H ${last.high.toFixed(2)} L ${last.low.toFixed(2)} C ${last.close.toFixed(2)})`,
    `Last 12 closes (oldest→newest): ${closes.slice(-12).map((c) => c.toFixed(2)).join(", ")}`,
  ]
    .filter(Boolean)
    .join("\n");
}
