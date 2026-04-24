import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCandles, getTicker } from "@/lib/hyperliquid";
import {
  type CandleTuple,
  combineStructureAndTrendline,
  highLowFromCandles,
  structureDirectionFromCloses,
  trendlineRegressionFromCloses,
} from "@/lib/nova-q-analytics";
import { getNovaSmartMemesAccess } from "@/lib/vip-futures-addon-access";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

const MEME_SMART_TIMEFRAMES = [
  { id: "5m", label: "5 mins", interval: "1m", limit: 5 },
  { id: "15m", label: "15 mins", interval: "1m", limit: 15 },
  { id: "30m", label: "30 mins", interval: "1m", limit: 30 },
  { id: "1h", label: "1 hour", interval: "1m", limit: 60 },
  { id: "2h", label: "2 hours", interval: "5m", limit: 24 },
  { id: "4h", label: "4 hours", interval: "5m", limit: 48 },
  { id: "24h", label: "24 hours", interval: "1h", limit: 24 },
  { id: "1w", label: "1 week", interval: "1d", limit: 7 },
] as const;

function normalizeSymbol(raw: string): string {
  const upper = String(raw ?? "").trim().toUpperCase();
  const base = upper.replace(/\/USDT$/i, "").replace(/\/USD$/i, "").replace(/-USDT$/i, "").replace(/\.USDT$/i, "").trim();
  return base || "PEPE";
}

type SmartResult = {
  symbol: string;
  currentPrice: number | null;
  smartShortEntry: number;
  smartLongEntry: number;
  recommendedDirection: "long" | "short" | "neutral";
  recommendationNote: string;
  trendlineConfidence: "high" | "medium" | "low";
  trendlineConfidenceNote: string;
  deadFlag: { dead: boolean; note: string };
  timeframes: Array<{
    id: string;
    label: string;
    high: number;
    low: number;
    structureDirection: "bullish" | "bearish" | "sideways";
    trendlineBias: "up" | "down" | "flat";
    direction: "bullish" | "bearish" | "sideways";
  }>;
};

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const access = await getNovaSmartMemesAccess(session);
    if (!access.ok) {
      return NextResponse.json({ success: false, error: access.error, locked: access.status === 403 }, { status: access.status });
    }

    const body = await request.json().catch(() => ({}));
    const symbolsInput = Array.isArray(body.symbols) ? body.symbols : String(body.symbols ?? body.symbol ?? "PEPE").split(/[\s,]+/);
    const symbols = symbolsInput.map((s: unknown) => normalizeSymbol(String(s))).filter(Boolean).slice(0, 10);
    const tfParam = body.timeframes ?? ["15m", "1h", "24h"];
    const requested = (Array.isArray(tfParam) ? tfParam : String(tfParam).split(/[\s,]+/)).map((x) => String(x).trim().toLowerCase());
    const chosen = MEME_SMART_TIMEFRAMES.filter((t) => requested.includes(t.id));
    const effectiveTf = chosen.length > 0 ? chosen : [MEME_SMART_TIMEFRAMES[1], MEME_SMART_TIMEFRAMES[3], MEME_SMART_TIMEFRAMES[6]];

    const results: SmartResult[] = [];
    for (const symbol of symbols.length ? symbols : ["PEPE"]) {
      const tfRows: SmartResult["timeframes"] = [];
      for (const tf of effectiveTf) {
        try {
          const candles = (await getCandles(symbol, tf.interval, tf.limit)) as CandleTuple[];
          const hl = highLowFromCandles(candles);
          if (!hl) continue;
          const structureDirection = structureDirectionFromCloses(candles);
          const tl = trendlineRegressionFromCloses(candles) ?? { bias: "flat" as const, slopePctWindow: 0, closeVsLinePct: 0, read: "" };
          tfRows.push({
            id: tf.id,
            label: tf.label,
            high: hl.high,
            low: hl.low,
            structureDirection,
            trendlineBias: tl.bias,
            direction: combineStructureAndTrendline(structureDirection, tl.bias),
          });
        } catch {
          // continue
        }
      }

      const ticker = await getTicker(symbol);
      const currentPrice = ticker?.last ? Number(ticker.last) : null;
      const smartShortEntry = tfRows.length ? Math.max(...tfRows.map((t) => t.high)) : 0;
      const smartLongEntry = tfRows.length ? Math.min(...tfRows.map((t) => t.low)) : 0;
      const bullish = tfRows.filter((t) => t.direction === "bullish").length;
      const bearish = tfRows.filter((t) => t.direction === "bearish").length;
      const recommendedDirection: "long" | "short" | "neutral" = bullish > bearish ? "long" : bearish > bullish ? "short" : "neutral";
      const trendlineConfidence: "high" | "medium" | "low" =
        tfRows.length >= 3 && Math.max(bullish, bearish) / Math.max(1, bullish + bearish) >= 0.7
          ? "high"
          : tfRows.length >= 2
            ? "medium"
            : "low";
      const deadFlag =
        currentPrice != null && smartLongEntry > 0 && smartShortEntry > smartLongEntry && bearish >= bullish && currentPrice <= smartLongEntry * 1.03
          ? { dead: true, note: "Warning: bearish alignment near range lows. Avoid buy-the-dip unless momentum reclaims key levels." }
          : { dead: false, note: "No immediate dead-coin warning from current structure/trendline alignment." };

      results.push({
        symbol,
        currentPrice,
        smartShortEntry,
        smartLongEntry,
        recommendedDirection,
        recommendationNote:
          recommendedDirection === "long"
            ? "Direction bias: Long. Favor pullback entries near support with strict risk."
            : recommendedDirection === "short"
              ? "Direction bias: Short. Favor rallies into resistance; avoid blind buys."
              : "Direction bias: Neutral. Wait for cleaner structure alignment.",
        trendlineConfidence,
        trendlineConfidenceNote: `${bullish} bullish vs ${bearish} bearish blended rows across ${tfRows.length} timeframe(s).`,
        deadFlag,
        timeframes: tfRows,
      });
    }

    return NextResponse.json({ success: true, results });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Nova Smart Memes failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
