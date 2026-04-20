import { NextResponse } from "next/server";
import { getSessionAndSubscription } from "@/lib/auth-server";
import { getCandles, getTicker } from "@/lib/hyperliquid";
import {
  type CandleTuple,
  combineStructureAndTrendline,
  highLowFromCandles,
  overallTrendlineSummary,
  structureDirectionFromCloses,
  trendlineRegressionFromCloses,
} from "@/lib/nova-q-analytics";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

const STRUCTURE_TFS = [
  { id: "15m", label: "15 mins", interval: "1m", limit: 15 },
  { id: "1h", label: "1 hour", interval: "1m", limit: 60 },
  { id: "1w", label: "1 week", interval: "1d", limit: 7 },
  { id: "4w", label: "4 weeks", interval: "1d", limit: 28 },
] as const;

type TfRow = {
  id: string;
  label: string;
  support: number;
  resistance: number;
  structureDirection: "bullish" | "bearish" | "sideways";
  trendlineBias: "up" | "down" | "flat";
  trendlineRead: string;
  direction: "bullish" | "bearish" | "sideways";
};

function normalizeSymbol(raw: string): string {
  const upper = raw.trim().toUpperCase();
  const base = upper.replace(/\/USDT$/i, "").replace(/\/USD$/i, "").replace(/-USDT$/i, "").replace(/\.USDT$/i, "").trim();
  return base || "BTC";
}

function parseTargetPrice(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
  const s = String(raw ?? "").replace(/[$,\s]/g, "").trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function getOverallDirection(rows: TfRow[]): "bullish" | "bearish" | "sideways" {
  if (rows.length === 0) return "sideways";
  let score = 0;
  for (const r of rows) {
    if (r.direction === "bullish") score += 1;
    if (r.direction === "bearish") score -= 1;
  }
  if (score > 0) return "bullish";
  if (score < 0) return "bearish";
  return "sideways";
}

function pathFromSpot(target: number, current: number): "up" | "down" | "at_target" {
  if (current <= 0) return "at_target";
  const rel = Math.abs(target - current) / current;
  if (rel < 0.0005) return "at_target";
  return target > current ? "up" : "down";
}

function structureAlignment(
  path: "up" | "down" | "at_target",
  market: "bullish" | "bearish" | "sideways"
): "aligned" | "mixed" | "against_trend" {
  if (path === "at_target") return "aligned";
  if (path === "up") {
    if (market === "bullish") return "aligned";
    if (market === "bearish") return "against_trend";
    return "mixed";
  }
  if (market === "bearish") return "aligned";
  if (market === "bullish") return "against_trend";
  return "mixed";
}

function meanDailyRangeUsd(candles: CandleTuple[], maxBars = 60): number {
  const n = Math.min(maxBars, candles.length);
  if (n < 5) return 0;
  let sum = 0;
  let count = 0;
  for (let i = 0; i < n; i++) {
    const h = Number(candles[i][2]);
    const l = Number(candles[i][3]);
    if (Number.isFinite(h) && Number.isFinite(l) && h >= l) {
      sum += h - l;
      count++;
    }
  }
  return count > 0 ? sum / count : 0;
}

function addCalendarDays(from: Date, days: number): Date {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function fmtMoney(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 6, minimumFractionDigits: 2 });
}

export async function POST(request: Request) {
  try {
    const { tier } = await getSessionAndSubscription();
    if (tier !== "vip") {
      return NextResponse.json(
        { success: false, error: "NovaRadar is for VIP subscribers.", locked: true },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const symbol = normalizeSymbol(String(body.symbol ?? "BTC"));
    const targetPrice = parseTargetPrice(body.targetPrice ?? body.price ?? body.amount);
    const sideRaw = String(body.side ?? body.direction ?? "long").toLowerCase();
    const side = sideRaw === "short" ? "short" : "long";

    if (targetPrice == null) {
      return NextResponse.json(
        { success: false, error: "Enter a valid limit price (positive number)." },
        { status: 400 }
      );
    }

    const [ticker, dailyCandles] = await Promise.all([
      getTicker(symbol),
      getCandles(symbol, "1d", 400) as Promise<CandleTuple[]>,
    ]);

    let currentPrice = ticker?.last ? Number(ticker.last) : NaN;
    if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
      const c0 = dailyCandles[0]?.[4];
      const fallback = c0 != null ? Number(c0) : NaN;
      if (Number.isFinite(fallback) && fallback > 0) currentPrice = fallback;
    }

    if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
      return NextResponse.json(
        { success: false, error: `No live price for ${symbol}. Check the contract symbol (Hyperliquid perps).` },
        { status: 400 }
      );
    }

    const tfRows: TfRow[] = [];
    for (const tf of STRUCTURE_TFS) {
      try {
        const candles = (await getCandles(symbol, tf.interval, tf.limit)) as CandleTuple[];
        const hl = highLowFromCandles(candles);
        if (!hl) continue;
        const structureDirection = structureDirectionFromCloses(candles);
        const tl =
          trendlineRegressionFromCloses(candles) ?? {
            bias: "flat" as const,
            slopePctWindow: 0,
            closeVsLinePct: 0,
            read: "Too few candles for regression trendline.",
          };
        tfRows.push({
          id: tf.id,
          label: tf.label,
          support: hl.low,
          resistance: hl.high,
          structureDirection,
          trendlineBias: tl.bias,
          trendlineRead: tl.read,
          direction: combineStructureAndTrendline(structureDirection, tl.bias),
        });
      } catch {
        /* skip tf */
      }
    }

    if (tfRows.length === 0 && dailyCandles.length === 0) {
      return NextResponse.json(
        { success: false, error: `No candle data for ${symbol}. Try another contract.` },
        { status: 400 }
      );
    }

    const marketDirection = getOverallDirection(tfRows);
    const trendlineSummary = overallTrendlineSummary(tfRows);
    const pricePath = pathFromSpot(targetPrice, currentPrice);
    const alignment = structureAlignment(pricePath, marketDirection);

    const slice52 = dailyCandles.slice(0, Math.min(364, dailyCandles.length));
    const hl52 = highLowFromCandles(slice52);
    const low52 = hl52?.low ?? null;
    const high52 = hl52?.high ?? null;

    const pctMove = Math.abs(targetPrice - currentPrice) / currentPrice;
    const caveats: string[] = [];
    let realism: "realistic" | "stretched" | "unrealistic" = "realistic";

    if (pctMove > 2) {
      realism = "unrealistic";
      caveats.push("Target implies a move greater than 200% from spot—this is not a practical near-term limit scenario.");
    } else if (pctMove > 0.85) {
      realism = "stretched";
      caveats.push("Target implies a very large percentage move—timing and path risk are elevated.");
    }

    if (low52 != null && high52 != null && high52 > low52) {
      if (targetPrice < low52 * 0.25) {
        realism = "unrealistic";
        caveats.push("Target is far below the ~1y trough of the loaded history—outside normal structural reach without a major regime shift.");
      } else if (targetPrice > high52 * 4) {
        realism = "unrealistic";
        caveats.push("Target is far above the ~1y peak of the loaded history—implies repricing far beyond recent structure.");
      } else if (realism === "realistic" && (targetPrice < low52 * 0.65 || targetPrice > high52 * 1.55)) {
        realism = "stretched";
        caveats.push("Target sits notably outside the recent ~1y range—expect wide uncertainty on when (or if) price trades there.");
      }
    }

    const avgRange = meanDailyRangeUsd(dailyCandles, 56);
    const floorMove = Math.max(avgRange, currentPrice * 0.004);
    const distance = Math.abs(targetPrice - currentPrice);

    let optimisticDays: number | null = null;
    let pessimisticDays: number | null = null;
    let estimatedReachDateEarly: string | null = null;
    let estimatedReachDateLate: string | null = null;

    if (realism !== "unrealistic" && pricePath !== "at_target" && floorMove > 0) {
      let base = distance / floorMove;
      if (alignment === "against_trend") base *= 1.85;
      else if (alignment === "mixed" || marketDirection === "sideways") base *= 1.2;
      if (realism === "stretched") base *= 1.35;

      optimisticDays = Math.max(1, Math.floor(base * 0.55));
      pessimisticDays = Math.max(optimisticDays, Math.ceil(base * 1.5));
      const cap = 720;
      if (pessimisticDays > cap) {
        pessimisticDays = cap;
        caveats.push("Even the late estimate hit the model cap (720 days)—the path is too uncertain to narrow further from structure alone.");
      }

      const now = new Date();
      estimatedReachDateEarly = addCalendarDays(now, optimisticDays).toISOString().slice(0, 10);
      estimatedReachDateLate = addCalendarDays(now, pessimisticDays).toISOString().slice(0, 10);
    }

    const orderNotes =
      side === "long"
        ? targetPrice < currentPrice
          ? "Long limit below spot: you are waiting for a pullback (price must move down to your limit)."
          : targetPrice > currentPrice
            ? "Long limit above spot: you are waiting for a breakout (price must move up to your limit)."
            : "Limit is essentially at spot."
        : targetPrice > currentPrice
          ? "Short limit above spot: you are waiting for a rally into a higher price (price must move up to your limit)."
          : targetPrice < currentPrice
            ? "Short limit below spot: you are waiting for a continuation lower (price must move down to your limit)."
            : "Limit is essentially at spot.";

    let alignmentNote = "";
    if (pricePath === "at_target") {
      alignmentNote = "Price is already at your limit area—fill risk is immediate if liquidity is available.";
    } else if (alignment === "aligned") {
      alignmentNote =
        pricePath === "up"
          ? "Broad structure favors upward progression toward your limit—path and timing are more intuitive, not guaranteed."
          : "Broad structure favors downward progression toward your limit—path and timing are more intuitive, not guaranteed.";
    } else if (alignment === "against_trend") {
      alignmentNote =
        pricePath === "up"
          ? "Price must rally to your limit while shorter structure skews bearish—expect a counter-trend move; timing bands widen."
          : "Price must drop to your limit while shorter structure skews bullish—expect a counter-trend pullback; timing bands widen.";
    } else {
      alignmentNote = "Structure is mixed across sampled periods—use the banded dates as a rough compass, not a schedule.";
    }

    const summaryParts = [
      `${symbol}: spot $${fmtMoney(currentPrice)}, ${side} limit $${fmtMoney(targetPrice)} (${((targetPrice - currentPrice) / currentPrice * 100).toFixed(2)}% vs spot).`,
      `Market structure (sampled TFs): ${marketDirection}. Price path to fill: ${pricePath === "at_target" ? "already near limit" : pricePath === "up" ? "needs higher prices" : "needs lower prices"}.`,
      trendlineSummary,
      orderNotes,
      alignmentNote,
    ];
    if (realism === "unrealistic") {
      summaryParts.push("Verdict: unrealistic as a baseline limit plan—consider revising the level or thesis.");
    } else if (optimisticDays != null && pessimisticDays != null && estimatedReachDateEarly && estimatedReachDateLate) {
      summaryParts.push(
        `Illustrative timing (volatility- and structure-based, not advice): roughly ${optimisticDays}–${pessimisticDays} calendar days (${estimatedReachDateEarly} → ${estimatedReachDateLate}), wider if liquidity gaps or regime shifts occur.`
      );
    } else if (pricePath === "at_target") {
      summaryParts.push("No ETA needed—level is already near current trading.");
    }

    const disclaimer =
      "NovaRadar estimates structure, trend, and typical daily ranges from recent history. This is not financial advice; markets can gap, liquidate crowds, and invalidate levels quickly.";

    return NextResponse.json({
      success: true,
      result: {
        symbol,
        side,
        targetPrice,
        currentPrice,
        marketDirection,
        overallTrendlineSummary: trendlineSummary,
        pricePath,
        pctMoveFromSpot: pctMove * 100,
        structureAlignment: alignment,
        realism,
        unrealistic: realism === "unrealistic",
        caveats: [...new Set(caveats)],
        estimatedReachDateEarly,
        estimatedReachDateLate,
        optimisticDays,
        pessimisticDays,
        structureTimeframes: tfRows,
        range52w: low52 != null && high52 != null ? { low: low52, high: high52 } : null,
        avgDailyRangeUsd: avgRange > 0 ? avgRange : null,
        summary: summaryParts.join(" "),
        orderIntentNote: orderNotes,
        disclaimer,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "NovaRadar failed";
    console.error("NovaRadar error:", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
