import { getCandles, instIdToCoin } from "@/lib/hyperliquid";
import type { Candle } from "@/lib/demand-zone-fib-strategy";

const HL_INFO = "https://api.hyperliquid.xyz/info";

/** BTC, BTC/USDT, ETH-PERP → base coin for HL. */
export function hyperliquidCoinFromInput(input: string): string {
  return instIdToCoin(input);
}

/** Oldest-first OHLCV for strategy (HL API returns newest-first). */
export async function fetchHyperliquidStrategyCandles(
  symbolInput: string,
  interval: string,
  limit: number
): Promise<Candle[]> {
  const tuples = await getCandles(symbolInput, interval, limit);
  if (tuples.length < 30) {
    const coin = instIdToCoin(symbolInput);
    throw new Error(
      `Not enough Hyperliquid data for ${coin} (${interval}). Coin may not exist on HL or API returned empty.`
    );
  }
  const asc = [...tuples].reverse();
  return asc.map((r) => ({
    time: Math.floor(Number(r[0]) / 1000),
    open: Number(r[1]),
    high: Number(r[2]),
    low: Number(r[3]),
    close: Number(r[4]),
    volume: Number(r[5]) || undefined,
  }));
}

export async function fetchHyperliquidFunding(coin: string): Promise<number | undefined> {
  try {
    const res = await fetch(HL_INFO, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "metaAndAssetCtxs" }),
      cache: "no-store",
    });
    if (!res.ok) return undefined;
    const raw = (await res.json()) as [{ universe?: Array<{ name: string }> }, Array<{ funding?: string }>];
    const universe = raw[0]?.universe ?? [];
    const ctxs = Array.isArray(raw[1]) ? raw[1] : [];
    const i = universe.findIndex((u) => u.name.toUpperCase() === coin.toUpperCase());
    if (i < 0 || ctxs[i]?.funding == null) return undefined;
    const f = Number(ctxs[i].funding);
    return Number.isFinite(f) ? f : undefined;
  } catch {
    return undefined;
  }
}
