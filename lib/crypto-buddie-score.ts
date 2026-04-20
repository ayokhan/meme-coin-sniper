import type { TrendingPerp } from "@/lib/api-clients/hyperliquid";
import type { Candle } from "@/lib/hyperliquid";

/** Simple momentum bias from % changes — not a trade recommendation. */
export type BuddyBias = "long" | "short" | "neutral";

/** Direction of recent 15m closes (oldest→newest bar), not hand-drawn chart trendlines. */
export type BuddyTrend15m = "up" | "down" | "sideways";

/** Enriched perp row returned by GET /api/futures/crypto-buddie. */
export type CryptoBuddieRow = TrendingPerp & {
  buddyScore: number;
  stability: "high" | "medium" | "low";
  stabilityNote: string;
  directionHint: string;
  rangePct15m: number;
  bias: BuddyBias;
  trend15m: BuddyTrend15m;
  trend15mNetPct: number;
  trendContext: string;
};

/** Average (high-low)/close per bar — lower suggests a tighter, more range-bound hour. */
export function meanRangePct(candles: Candle[]): number {
  if (!candles.length) return 0.05;
  let sum = 0;
  for (const c of candles) {
    const h = Number(c[2]);
    const l = Number(c[3]);
    const cl = Number(c[4]);
    const mid = Math.max(Math.abs(cl), 1e-12);
    sum += (h - l) / mid;
  }
  return sum / candles.length;
}

/** Candles are newest-first; compares latest close to oldest in the slice (~2h on 8×15m). */
export function trendFrom15mCloses(series: Candle[]): { label: BuddyTrend15m; netPct: number } {
  if (series.length < 2) return { label: "sideways", netPct: 0 };
  const newest = Number(series[0]?.[4]);
  const oldest = Number(series[series.length - 1]?.[4]);
  if (!Number.isFinite(newest) || !Number.isFinite(oldest) || Math.abs(oldest) < 1e-12) return { label: "sideways", netPct: 0 };
  const netPct = ((newest - oldest) / Math.abs(oldest)) * 100;
  if (netPct > 0.18) return { label: "up", netPct };
  if (netPct < -0.18) return { label: "down", netPct };
  return { label: "sideways", netPct };
}

export function momentumBias(perp: TrendingPerp): BuddyBias {
  const s5 = Math.sign(perp.pct5m ?? 0);
  const s15 = Math.sign(perp.pct15m ?? 0);
  const s1h = Math.sign(perp.pct1h ?? 0);
  if (s5 !== 0 && s5 === s15 && s15 === s1h) return s5 > 0 ? "long" : "short";
  if (Math.abs(perp.pct1h ?? 0) > 0.12) return (perp.pct1h ?? 0) > 0 ? "long" : "short";
  return "neutral";
}

export type BuddyRankMeta = {
  buddyScore: number;
  stability: "high" | "medium" | "low";
  stabilityNote: string;
  directionHint: string;
  bias: BuddyBias;
  trend15m: BuddyTrend15m;
  trend15mNetPct: number;
  trendContext: string;
};

/**
 * Heuristic “quick scalp” profile: liquid, aligned short-term drift, moderate 1h move, not a violent 4h trend.
 * `rangePct` = mean (high-low)/close on recent 15m bars (caller supplies ~8 bars ≈ 2h).
 * `trend15m` = rise/fall of closes across those bars (rough trend context; not S/R or drawn trendlines).
 */
export function rankBuddy(perp: TrendingPerp, rangePct: number, series15m: Candle[]): BuddyRankMeta {
  let score = 0;
  const vol = Number(perp.dayNtlVlm || 0);
  score += Math.min(28, Math.log10(vol + 10) * 5.5);

  const s5 = Math.sign(perp.pct5m ?? 0);
  const s15 = Math.sign(perp.pct15m ?? 0);
  const s1h = Math.sign(perp.pct1h ?? 0);
  if (s5 !== 0 && s5 === s15 && s15 === s1h) score += 24;
  else if (s5 !== 0 && s5 === s1h) score += 12;

  if (rangePct < 0.012) score += 26;
  else if (rangePct < 0.022) score += 18;
  else if (rangePct < 0.038) score += 8;

  const a1 = Math.abs(perp.pct1h ?? 0);
  if (a1 >= 0.08 && a1 <= 3.2) score += 14;

  if (Math.abs(perp.pct4h ?? 0) > 12) score -= 18;

  const { label: trend15m, netPct: trend15mNetPct } = trendFrom15mCloses(series15m);
  const bias = momentumBias(perp);
  if (bias !== "neutral" && trend15m !== "sideways") {
    if ((bias === "long" && trend15m === "up") || (bias === "short" && trend15m === "down")) score += 3;
  }

  const buddyScore = Math.max(0, Math.min(100, Math.round(score)));
  const stability: BuddyRankMeta["stability"] =
    rangePct < 0.018 ? "high" : rangePct < 0.034 ? "medium" : "low";
  const stabilityNote =
    stability === "high"
      ? "Recent 15m ranges are tight — price is moving in a relatively compact band (useful for short-term levels; not a guarantee for the next 1–4h)."
      : stability === "medium"
        ? "Moderate intrabar swings — levels may still be usable for short horizons; watch for expansion."
        : "Wide recent ranges — harder to treat support/resistance as stable for quick scalps.";

  let directionHint = "Mixed / unclear short-term drift.";
  if (s5 !== 0 && s5 === s15 && s15 === s1h) {
    directionHint = s5 > 0 ? "Short-term momentum aligned up (5m–1h)." : "Short-term momentum aligned down (5m–1h).";
  } else if (Math.abs(perp.pct1h ?? 0) > 0.15) {
    directionHint = (perp.pct1h ?? 0) > 0 ? "1h leaning up vs. smaller timeframes." : "1h leaning down vs. smaller timeframes.";
  }

  const trendContext =
    trend15m === "up"
      ? `Recent 15m closes net ~${trend15mNetPct >= 0 ? "+" : ""}${trend15mNetPct.toFixed(2)}% higher over the window (slope of closes — not hand-drawn trendlines).`
      : trend15m === "down"
        ? `Recent 15m closes net ~${trend15mNetPct.toFixed(2)}% lower over the window (slope of closes — not hand-drawn trendlines).`
        : "Recent 15m closes are relatively flat net across the window (no strong up/down close path).";

  return { buddyScore, stability, stabilityNote, directionHint, bias, trend15m, trend15mNetPct, trendContext };
}
