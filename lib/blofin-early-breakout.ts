import {
  enrichBlofinPerpRadarWithKlines,
  getBlofinPerpRadar,
} from "@/lib/api-clients/blofin-perps";
import type { PerpRadarItem } from "@/lib/api-clients/binance-perps";

export type EarlyBreakoutInput = {
  change24hPct: number;
  quoteVolume24h: number;
  pct5m?: number;
  pct15m?: number;
  pct30m?: number;
  pct1h?: number;
  pct4h?: number;
};

/** Rank intraday momentum (5m/15m weighted highest). */
export function earlyBreakoutScore(item: EarlyBreakoutInput): number {
  const p5 = Math.abs(item.pct5m ?? 0);
  const p15 = Math.abs(item.pct15m ?? 0);
  const p30 = Math.abs(item.pct30m ?? 0);
  const p1h = Math.abs(item.pct1h ?? 0);
  return p5 * 2.5 + p15 * 2 + p30 * 1.5 + p1h;
}

/** Catching moves while 24h is still modest and short windows are leading. */
export function isEarlyBreakoutUp(item: EarlyBreakoutInput): boolean {
  const vol = item.quoteVolume24h;
  if (vol < 50_000) return false;

  const ch24 = item.change24hPct;
  if (ch24 < 1 || ch24 > 32) return false;

  const p5 = item.pct5m ?? 0;
  const p15 = item.pct15m ?? 0;
  const p30 = item.pct30m ?? 0;
  const p1h = item.pct1h ?? 0;

  const hasShortTermPush = p5 >= 0.5 || p15 >= 0.9 || p30 >= 1.4 || p1h >= 2;
  if (!hasShortTermPush) return false;

  const accelerating = p5 + p15 >= 1.2 || p15 > ch24 * 0.12 || (p5 >= 0.6 && p15 >= 0.8);
  if (!accelerating) return false;

  if (ch24 > 25 && !(p5 >= 0.8 && p15 >= 1)) return false;
  return p5 >= -0.3;
}

export function isEarlyBreakoutDown(item: EarlyBreakoutInput): boolean {
  const vol = item.quoteVolume24h;
  if (vol < 50_000) return false;

  const ch24 = item.change24hPct;
  if (ch24 > -1 || ch24 < -32) return false;

  const p5 = item.pct5m ?? 0;
  const p15 = item.pct15m ?? 0;
  const p30 = item.pct30m ?? 0;
  const p1h = item.pct1h ?? 0;

  const hasShortTermPush = p5 <= -0.5 || p15 <= -0.9 || p30 <= -1.4 || p1h <= -2;
  if (!hasShortTermPush) return false;

  const accelerating = p5 + p15 <= -1.2 || p15 < ch24 * 0.12 || (p5 <= -0.6 && p15 <= -0.8);
  if (!accelerating) return false;

  if (ch24 < -25 && !(p5 <= -0.8 && p15 <= -1)) return false;
  return p5 <= 0.3;
}

export function earlyBreakoutDirection(item: EarlyBreakoutInput): "up" | "down" | null {
  if (isEarlyBreakoutUp(item)) return "up";
  if (isEarlyBreakoutDown(item)) return "down";
  return null;
}

/** Blofin USDT perps matching early-breakout criteria (intraday-led, 24h still 1–32%). */
export async function scanBlofinEarlyBreakouts(limit = 80): Promise<{ items: PerpRadarItem[]; stale: boolean }> {
  const { items: candidates, stale } = await getBlofinPerpRadar({
    minChangePct: 0.5,
    minQuoteVolume: 30_000,
    limit: 120,
  });
  const enrichCount = Math.min(35, candidates.length);
  const enriched = await enrichBlofinPerpRadarWithKlines(candidates, enrichCount);
  const rest = candidates.slice(enrichCount);
  const merged = [...enriched, ...rest];
  const matches = merged.filter((p) => earlyBreakoutDirection(p) != null);
  matches.sort((a, b) => earlyBreakoutScore(b) - earlyBreakoutScore(a));
  return { items: matches.slice(0, limit), stale };
}

export function formatEarlyBreakoutTelegram(item: PerpRadarItem, direction: "up" | "down"): string {
  const arrow = direction === "up" ? "🚀" : "📉";
  const label = direction === "up" ? "Early breakout UP" : "Early breakout DOWN";
  const fmt = (v: number | undefined) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`);
  return (
    `${arrow} <b>Blofin ${label}</b>: <b>${item.base}/USDT</b>\n` +
    `5m ${fmt(item.pct5m)} · 15m ${fmt(item.pct15m)} · 1h ${fmt(item.pct1h)} · 24h ${fmt(item.change24hPct)}\n` +
    `Price $${item.lastPrice.toLocaleString(undefined, { maximumFractionDigits: 6 })}\n` +
    `🔗 <a href="https://www.blofin.com/futures/${item.base}-USDT">Trade on Blofin</a> · ` +
    `<a href="https://novastaris.ai">NovaStaris</a>`
  );
}
