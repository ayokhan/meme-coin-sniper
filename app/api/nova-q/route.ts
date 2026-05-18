import { NextResponse } from "next/server";
import { getSessionAndSubscription } from "@/lib/auth-server";
import { getCandles as getHlCandles, getPerpSpecFromMeta, getTicker as getHlTicker, type HyperliquidPerpSpec } from "@/lib/hyperliquid";
import {
  blofinMetalContractDescription,
  getBlofinMetalCandles,
  getBlofinMetalTicker,
  isBlofinMetal,
  normalizeMetalBase,
  novaQUnknownHlSymbolMessage,
  type BlofinMetal,
} from "@/lib/blofin-metals";
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

/** Optional one-liner for symbols users often confuse with other venues. */
const NOVA_Q_KNOWN_ASSET_NOTES: Record<string, string> = {
  PAXG:
    "Paxos Gold (tokenized gold exposure). It is not the same instrument or ticker as classic metals XAU/USD or another venue’s XAU-USDT; NovaQ uses Hyperliquid’s perp candles and mid, which can differ from global spot references.",
};

export const dynamic = "force-dynamic";
export const maxDuration = 45;

const NOVA_Q_TIMEFRAMES = [
  { id: "5m", label: "5 mins", interval: "1m", limit: 5 },
  { id: "15m", label: "15 mins", interval: "1m", limit: 15 },
  { id: "30m", label: "30 mins", interval: "1m", limit: 30 },
  { id: "1h", label: "1 hour", interval: "1m", limit: 60 },
  { id: "2h", label: "2 hours", interval: "5m", limit: 24 },
  { id: "4h", label: "4 hours", interval: "5m", limit: 48 },
  { id: "6h", label: "6 hours", interval: "15m", limit: 24 },
  { id: "10h", label: "10 hours", interval: "15m", limit: 40 },
  { id: "12h", label: "12 hours", interval: "15m", limit: 48 },
  { id: "24h", label: "24 hours", interval: "1h", limit: 24 },
  { id: "48h", label: "48 hours", interval: "1h", limit: 48 },
  { id: "72h", label: "72 hours", interval: "1h", limit: 72 },
  { id: "1w", label: "1 week", interval: "1d", limit: 7 },
  { id: "2w", label: "2 weeks", interval: "1d", limit: 14 },
  { id: "3w", label: "3 weeks", interval: "1d", limit: 21 },
  { id: "4w", label: "4 weeks", interval: "1d", limit: 28 },
  { id: "5w", label: "5 weeks", interval: "1d", limit: 35 },
  { id: "6w", label: "6 weeks", interval: "1d", limit: 42 },
  { id: "52w", label: "52 weeks", interval: "1d", limit: 364 },
  { id: "104w", label: "104 weeks", interval: "1d", limit: 728 },
] as const;

type NovaQTfResult = {
  id: string;
  label: string;
  support: number;
  resistance: number;
  /** Half-window average close drift (legacy NovaQ structure read). */
  structureDirection: "bullish" | "bearish" | "sideways";
  /** Least-squares regression through closes in the window (trendline-style proxy). */
  trendlineBias: "up" | "down" | "flat";
  trendlineSlopePctWindow: number;
  trendlineRead: string;
  /** Retest frequency near window low / high — demand/supply proxy. */
  demandSupplyRead: string;
  /** Structure + trendline combined; conflicts resolve to sideways. */
  direction: "bullish" | "bearish" | "sideways";
  /** Candles in the window whose low traded within tolerance of period support (min low). */
  supportTouches: number;
  /** Candles in the window whose high traded within tolerance of period resistance (max high). */
  resistanceTouches: number;
};

function normalizeSymbol(raw: string): string {
  return normalizeMetalBase(raw) || "BTC";
}

function buildContractDescription(symbol: string, spec: HyperliquidPerpSpec | null): string {
  if (!spec) {
    return novaQUnknownHlSymbolMessage(symbol);
  }
  const minStep = Math.pow(10, -spec.szDecimals);
  const base = `${spec.name}: Hyperliquid USDC-margined perpetual, max leverage ${spec.maxLeverage}x, minimum size step about ${minStep} ${spec.name}.`;
  const extra = NOVA_Q_KNOWN_ASSET_NOTES[spec.name];
  return extra ? `${base} ${extra}` : base;
}

function getOverallDirection(timeframes: NovaQTfResult[]): "bullish" | "bearish" | "sideways" {
  if (timeframes.length === 0) return "sideways";
  let score = 0;
  for (const tf of timeframes) {
    if (tf.direction === "bullish") score += 1;
    if (tf.direction === "bearish") score -= 1;
  }
  if (score > 0) return "bullish";
  if (score < 0) return "bearish";
  return "sideways";
}

export async function POST(request: Request) {
  try {
    const { tier } = await getSessionAndSubscription();
    if (tier !== "vip") {
      return NextResponse.json(
        { success: false, error: "NovaQ is for VIP subscribers.", locked: true },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const symbol = normalizeSymbol(String(body.symbol ?? "BTC"));
    const timeframesParam = body.timeframes ?? body.tf ?? ["15m", "1h", "1w"];
    const requestedTf = (typeof timeframesParam === "string"
      ? timeframesParam.split(/[\s,]+/).map((s) => s.trim().toLowerCase())
      : Array.isArray(timeframesParam)
        ? timeframesParam.map((s) => String(s).trim().toLowerCase())
        : []
    ).filter(Boolean);

    const selected = NOVA_Q_TIMEFRAMES.filter((t) => requestedTf.includes(t.id));
    const effectiveTf = selected.length > 0 ? selected : [NOVA_Q_TIMEFRAMES[1], NOVA_Q_TIMEFRAMES[3], NOVA_Q_TIMEFRAMES[8]]; // 15m, 1h, 1w

    const useBlofinMetal = isBlofinMetal(symbol);

    let contractDescription = "";
    if (useBlofinMetal) {
      contractDescription = blofinMetalContractDescription(symbol as BlofinMetal);
    } else {
      try {
        const spec = await getPerpSpecFromMeta(symbol);
        contractDescription = buildContractDescription(symbol, spec);
      } catch {
        contractDescription = `${symbol}: contract details temporarily unavailable (Hyperliquid meta).`;
      }
    }

    const tfResults: NovaQTfResult[] = [];
    for (const tf of effectiveTf) {
      try {
        const candles = useBlofinMetal
          ? await getBlofinMetalCandles(symbol as BlofinMetal, tf.interval, tf.limit)
          : await getHlCandles(symbol, tf.interval, tf.limit);
        const candleRows = candles as CandleTuple[];
        const hl = highLowFromCandles(candleRows);
        if (!hl) continue;
        const { supportTouches, resistanceTouches } = countSupportResistanceTouches(candleRows, hl.low, hl.high);
        const structureDirection = structureDirectionFromCloses(candleRows);
        const tl =
          trendlineRegressionFromCloses(candleRows) ?? {
            bias: "flat" as const,
            slopePctWindow: 0,
            closeVsLinePct: 0,
            read: "Too few candles in this window for regression trendline—pick a wider timeframe.",
          };
        const demand = demandSupplyRead(hl.low, hl.high, supportTouches, resistanceTouches);
        const direction = combineStructureAndTrendline(structureDirection, tl.bias);
        tfResults.push({
          id: tf.id,
          label: tf.label,
          support: hl.low,
          resistance: hl.high,
          structureDirection,
          trendlineBias: tl.bias,
          trendlineSlopePctWindow: tl.slopePctWindow,
          trendlineRead: tl.read,
          demandSupplyRead: demand,
          direction,
          supportTouches,
          resistanceTouches,
        });
      } catch {
        // Ignore a failed timeframe and continue with others.
      }
    }

    const ticker = useBlofinMetal
      ? await getBlofinMetalTicker(symbol as BlofinMetal)
      : await getHlTicker(symbol);
    const currentPrice = ticker?.last ? Number(ticker.last) : null;
    const marketDirection = getOverallDirection(tfResults);
    const overallTrendlineSummaryText = overallTrendlineSummary(tfResults);

    return NextResponse.json({
      success: true,
      result: {
        symbol,
        currentPrice,
        marketDirection,
        overallTrendlineSummary: overallTrendlineSummaryText,
        contractDescription,
        timeframes: tfResults,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "NovaQ failed";
    console.error("NovaQ error:", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
