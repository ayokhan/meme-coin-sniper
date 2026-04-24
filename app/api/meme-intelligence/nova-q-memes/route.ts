import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCandles, getTicker } from "@/lib/hyperliquid";
import {
  type CandleTuple,
  combineStructureAndTrendline,
  countSupportResistanceTouches,
  demandSupplyRead,
  highLowFromCandles,
  overallTrendlineSummary,
  structureDirectionFromCloses,
  trendlineRegressionFromCloses,
} from "@/lib/nova-q-analytics";
import { getNovaQMemesAccess } from "@/lib/vip-futures-addon-access";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

const MEME_Q_TIMEFRAMES = [
  { id: "5m", label: "5 mins", interval: "1m", limit: 5 },
  { id: "15m", label: "15 mins", interval: "1m", limit: 15 },
  { id: "30m", label: "30 mins", interval: "1m", limit: 30 },
  { id: "1h", label: "1 hour", interval: "1m", limit: 60 },
  { id: "2h", label: "2 hours", interval: "5m", limit: 24 },
  { id: "4h", label: "4 hours", interval: "5m", limit: 48 },
  { id: "24h", label: "24 hours", interval: "1h", limit: 24 },
  { id: "1w", label: "1 week", interval: "1d", limit: 7 },
] as const;

type MemeQTfResult = {
  id: string;
  label: string;
  support: number;
  resistance: number;
  structureDirection: "bullish" | "bearish" | "sideways";
  trendlineBias: "up" | "down" | "flat";
  trendlineSlopePctWindow: number;
  trendlineRead: string;
  demandSupplyRead: string;
  direction: "bullish" | "bearish" | "sideways";
  supportTouches: number;
  resistanceTouches: number;
};

function normalizeSymbol(raw: string): string {
  const upper = String(raw ?? "").trim().toUpperCase();
  const base = upper.replace(/\/USDT$/i, "").replace(/\/USD$/i, "").replace(/-USDT$/i, "").replace(/\.USDT$/i, "").trim();
  return base || "PEPE";
}

function getOverallDirection(timeframes: MemeQTfResult[]): "bullish" | "bearish" | "sideways" {
  let score = 0;
  for (const tf of timeframes) {
    if (tf.direction === "bullish") score += 1;
    if (tf.direction === "bearish") score -= 1;
  }
  if (score > 0) return "bullish";
  if (score < 0) return "bearish";
  return "sideways";
}

function getDeadFlag(currentPrice: number | null, rows: MemeQTfResult[]): { dead: boolean; note: string } {
  if (currentPrice == null || rows.length === 0) {
    return { dead: false, note: "Insufficient data for dead-coin signal." };
  }
  const weekly = rows.find((r) => r.id === "1w");
  const oneDay = rows.find((r) => r.id === "24h");
  const ref = weekly ?? oneDay ?? rows[rows.length - 1];
  const range = Math.max(0.0000001, ref.resistance - ref.support);
  const pctFromResistance = ((ref.resistance - currentPrice) / Math.max(ref.resistance, 0.0000001)) * 100;
  const rangePos = (currentPrice - ref.support) / range;
  const bearishRows = rows.filter((r) => r.direction === "bearish").length;
  const mostlyBearish = bearishRows >= Math.ceil(rows.length * 0.6);
  const dead = mostlyBearish && (rangePos < 0.2 || pctFromResistance > 35);
  if (dead) {
    return {
      dead: true,
      note: "Warning: downside/dead-coin risk is elevated (majority bearish structure + trendline and price is near range lows). Avoid fresh buys until momentum recovers.",
    };
  }
  return { dead: false, note: "No strong dead-coin flag from current structure/trendline blend." };
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const access = await getNovaQMemesAccess(session);
    if (!access.ok) {
      return NextResponse.json({ success: false, error: access.error, locked: access.status === 403 }, { status: access.status });
    }

    const body = await request.json().catch(() => ({}));
    const symbol = normalizeSymbol(String(body.symbol ?? "PEPE"));
    const tfParam = body.timeframes ?? ["15m", "1h", "24h"];
    const requested = (Array.isArray(tfParam) ? tfParam : String(tfParam).split(/[\s,]+/))
      .map((x) => String(x).trim().toLowerCase())
      .filter(Boolean);
    const selected = MEME_Q_TIMEFRAMES.filter((t) => requested.includes(t.id));
    const effectiveTf = selected.length > 0 ? selected : [MEME_Q_TIMEFRAMES[1], MEME_Q_TIMEFRAMES[3], MEME_Q_TIMEFRAMES[6]];

    const rows: MemeQTfResult[] = [];
    for (const tf of effectiveTf) {
      try {
        const candles = (await getCandles(symbol, tf.interval, tf.limit)) as CandleTuple[];
        const hl = highLowFromCandles(candles);
        if (!hl) continue;
        const { supportTouches, resistanceTouches } = countSupportResistanceTouches(candles, hl.low, hl.high);
        const structureDirection = structureDirectionFromCloses(candles);
        const tl = trendlineRegressionFromCloses(candles) ?? {
          bias: "flat" as const,
          slopePctWindow: 0,
          closeVsLinePct: 0,
          read: "Too few candles for trendline regression.",
        };
        rows.push({
          id: tf.id,
          label: tf.label,
          support: hl.low,
          resistance: hl.high,
          structureDirection,
          trendlineBias: tl.bias,
          trendlineSlopePctWindow: tl.slopePctWindow,
          trendlineRead: tl.read,
          demandSupplyRead: demandSupplyRead(hl.low, hl.high, supportTouches, resistanceTouches),
          direction: combineStructureAndTrendline(structureDirection, tl.bias),
          supportTouches,
          resistanceTouches,
        });
      } catch {
        // skip timeframe errors and keep the rest
      }
    }

    const ticker = await getTicker(symbol);
    const currentPrice = ticker?.last ? Number(ticker.last) : null;
    const deadFlag = getDeadFlag(currentPrice, rows);
    return NextResponse.json({
      success: true,
      result: {
        symbol,
        currentPrice,
        marketDirection: getOverallDirection(rows),
        overallTrendlineSummary: overallTrendlineSummary(rows),
        timeframes: rows,
        deadFlag,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "NovaQ Memes failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
