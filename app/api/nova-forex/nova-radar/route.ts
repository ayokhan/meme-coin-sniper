import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { forexContractDescription, getForexCandles, getForexTicker, normalizeForexSymbol } from "@/lib/forex-market";
import {
  combineStructureAndTrendline,
  highLowFromCandles,
  overallTrendlineSummary,
  structureDirectionFromCloses,
  trendlineRegressionFromCloses,
  type CandleTuple,
} from "@/lib/nova-q-analytics";
import { getNovaForexAgentAccess } from "@/lib/vip-futures-addon-access";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

const STRUCTURE_TFS = [
  { id: "15m", label: "15 mins", interval: "1m", limit: 15 },
  { id: "1h", label: "1 hour", interval: "1m", limit: 60 },
  { id: "1w", label: "1 week", interval: "1d", limit: 7 },
  { id: "4w", label: "4 weeks", interval: "1d", limit: 28 },
] as const;

function parseTargetPrice(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
  const s = String(raw ?? "").replace(/[$,\s]/g, "").trim();
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function getOverallDirection(rows: { direction: string }[]): "bullish" | "bearish" | "sideways" {
  let score = 0;
  for (const r of rows) {
    if (r.direction === "bullish") score += 1;
    if (r.direction === "bearish") score -= 1;
  }
  if (score > 0) return "bullish";
  if (score < 0) return "bearish";
  return "sideways";
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const access = await getNovaForexAgentAccess(session);
    if (!access.ok) {
      return NextResponse.json({ success: false, error: access.error, disabled: access.disabled }, { status: access.status });
    }

    const body = await request.json().catch(() => ({}));
    const symbol = normalizeForexSymbol(String(body.symbol ?? "XAUUSD")) || "XAUUSD";
    const targetPrice = parseTargetPrice(body.targetPrice ?? body.price);
    const side = String(body.side ?? "long").toLowerCase() === "short" ? "short" : "long";

    if (targetPrice == null) {
      return NextResponse.json({ success: false, error: "Enter a valid limit price." }, { status: 400 });
    }

    const [ticker, dailyCandles] = await Promise.all([
      getForexTicker(symbol),
      getForexCandles(symbol, "1d", 120),
    ]);

    let currentPrice = ticker?.last ? Number(ticker.last) : NaN;
    if (!Number.isFinite(currentPrice) && dailyCandles[0]) {
      currentPrice = Number(dailyCandles[0][4]);
    }
    if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
      return NextResponse.json({ success: false, error: `No live price for ${symbol}.` }, { status: 400 });
    }

    const tfRows = [];
    for (const tf of STRUCTURE_TFS) {
      try {
        const candles = await getForexCandles(symbol, tf.interval, tf.limit);
        const hl = highLowFromCandles(candles as CandleTuple[]);
        if (!hl) continue;
        const structureDirection = structureDirectionFromCloses(candles as CandleTuple[]);
        const tl = trendlineRegressionFromCloses(candles as CandleTuple[]) ?? { bias: "flat" as const, read: "" };
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
        // skip
      }
    }

    const marketDirection = getOverallDirection(tfRows);
    const pctMove = Math.abs(targetPrice - currentPrice) / currentPrice;
    let realism: "realistic" | "stretched" | "unrealistic" = "realistic";
    if (pctMove > 0.5) realism = "unrealistic";
    else if (pctMove > 0.15) realism = "stretched";

    const pricePath =
      Math.abs(targetPrice - currentPrice) / currentPrice < 0.0005
        ? "at_target"
        : targetPrice > currentPrice
          ? "up"
          : "down";

    return NextResponse.json({
      success: true,
      result: {
        symbol,
        side,
        targetPrice,
        currentPrice,
        marketDirection,
        trendlineSummary: overallTrendlineSummary(tfRows),
        pricePath,
        realism,
        contractDescription: forexContractDescription(symbol),
        timeframes: tfRows,
        summary: `${symbol}: spot ${currentPrice.toFixed(2)}, ${side} limit ${targetPrice.toFixed(2)}. Structure: ${marketDirection}. Path to fill: ${pricePath}.`,
        disclaimer:
          "Nova Forex Radar uses reference OHLC (Yahoo Finance). Not financial advice; broker prices may differ.",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Nova Forex Radar failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
