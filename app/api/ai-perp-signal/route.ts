import { NextResponse } from "next/server";
import { getSessionAndSubscription } from "@/lib/auth-server";
import { getAITradingSignal, type MarketSummary } from "@/lib/ai-trading-signal";
import { getCandles } from "@/lib/hyperliquid";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Build MarketSummary from Hyperliquid 15m candles (newest first). Simple S/R from recent lows/highs. */
async function buildMarketSummary(symbol: string, timeframe: string): Promise<MarketSummary | null> {
  const candles = await getCandles(symbol, timeframe, 25);
  if (!candles.length) return null;
  const closes = candles.map((c) => Number(c[4])).filter((n) => Number.isFinite(n));
  const highs = candles.map((c) => Number(c[2])).filter((n) => Number.isFinite(n));
  const lows = candles.map((c) => Number(c[3])).filter((n) => Number.isFinite(n));
  if (closes.length < 5) return null;
  const currentPrice = closes[0] ?? 0;
  const lastCloses = closes.slice(0, 20);
  const recentLows = lows.slice(0, 10);
  const recentHighs = highs.slice(0, 10);
  const supportLevels = recentLows.length ? [Math.min(...recentLows)] : [];
  const resistanceLevels = recentHighs.length ? [Math.max(...recentHighs)] : [];
  return {
    symbol,
    timeframe,
    lastCloses,
    currentPrice,
    supportLevels,
    resistanceLevels,
  };
}

/** POST - On-demand NovaStaris AI Signal for a perp (long/short/no_buy + score + reason). Subscribers only. */
export async function POST(request: Request) {
  try {
    const { isPaid } = await getSessionAndSubscription();
    if (!isPaid) {
      return NextResponse.json(
        { success: false, error: "Subscribe to use NovaStaris AI Signal (perps).", locked: true },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const symbol = (body.symbol as string)?.trim?.();
    const timeframe = (body.timeframe as string)?.trim?.() || "15m";

    if (!symbol) {
      return NextResponse.json(
        { success: false, error: "Missing symbol in request body." },
        { status: 400 }
      );
    }

    const summary = await buildMarketSummary(symbol, timeframe);
    if (!summary) {
      return NextResponse.json(
        { success: false, error: "Could not load candle data for this symbol." },
        { status: 422 }
      );
    }

    const result = await getAITradingSignal(summary);
    return NextResponse.json({
      success: true,
      signal: result.signal,
      score: result.score,
      reason: result.reason,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "NovaStaris AI Signal failed";
    console.error("AI perp signal error:", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
