import { NextResponse } from "next/server";
import { getSessionAndSubscription } from "@/lib/auth-server";
import { getCandles, getTicker, instIdToCoin } from "@/lib/hyperliquid";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

const HL_INFO_BASE = "https://api.hyperliquid.xyz/info";

const NOVA_PLUS_TIMEFRAMES = [
  { id: "15m", label: "15 mins", interval: "1m", limit: 15 },
  { id: "1h", label: "1 hour", interval: "1m", limit: 60 },
  { id: "2h", label: "2 hours", interval: "5m", limit: 24 },
  { id: "4h", label: "4 hours", interval: "5m", limit: 48 },
  { id: "6h", label: "6 hours", interval: "15m", limit: 24 },
  { id: "12h", label: "12 hours", interval: "15m", limit: 48 },
  { id: "24h", label: "24 hours", interval: "1h", limit: 24 },
  { id: "48h", label: "48 hours", interval: "1h", limit: 48 },
  { id: "72h", label: "72 hours", interval: "1h", limit: 72 },
  { id: "1w", label: "1 week", interval: "1d", limit: 7 },
  { id: "2w", label: "2 weeks", interval: "1d", limit: 14 },
  { id: "4w", label: "4 weeks", interval: "1d", limit: 28 },
  { id: "52w", label: "52 weeks", interval: "1d", limit: 364 },
  { id: "104w", label: "104 weeks", interval: "1d", limit: 728 },
] as const;

type CandleTuple = [string, string, string, string, string, ...string[]];

type BookLevel = { px: number; sz: number };

function normalizeSymbol(raw: string): string {
  return instIdToCoin(raw || "BTC");
}

function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function getTrend(closesNewestFirst: number[]): "bullish" | "bearish" | "sideways" {
  if (closesNewestFirst.length < 6) return "sideways";
  const closes = [...closesNewestFirst].reverse();
  const mid = Math.floor(closes.length / 2);
  const first = closes.slice(0, mid);
  const second = closes.slice(mid);
  if (first.length === 0 || second.length === 0) return "sideways";
  const avg = (arr: number[]) => arr.reduce((sum, n) => sum + n, 0) / arr.length;
  const base = avg(first);
  const latest = avg(second);
  if (!Number.isFinite(base) || !Number.isFinite(latest) || base <= 0) return "sideways";
  const pct = (latest - base) / base;
  if (pct > 0.003) return "bullish";
  if (pct < -0.003) return "bearish";
  return "sideways";
}

function getAtrPct(candles: CandleTuple[], price: number): number {
  if (!candles.length || price <= 0) return 0.01;
  const ranges = candles
    .map((c) => ({ h: Number(c[2]), l: Number(c[3]) }))
    .filter((x) => Number.isFinite(x.h) && Number.isFinite(x.l) && x.h > 0 && x.l > 0 && x.h >= x.l)
    .slice(0, 24)
    .map((x) => (x.h - x.l) / price);
  if (ranges.length === 0) return 0.01;
  return ranges.reduce((s, r) => s + r, 0) / ranges.length;
}

async function fetchOrderBookWalls(symbol: string): Promise<{
  strongestBidWall: BookLevel | null;
  strongestAskWall: BookLevel | null;
}> {
  try {
    const res = await fetch(HL_INFO_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "l2Book", coin: symbol }),
      cache: "no-store",
    });
    if (!res.ok) return { strongestBidWall: null, strongestAskWall: null };
    const raw = await res.json() as { levels?: unknown[] } | unknown[];
    const levels = Array.isArray((raw as { levels?: unknown[] })?.levels)
      ? (raw as { levels?: unknown[] }).levels as unknown[]
      : (Array.isArray(raw) ? raw : []);
    const bidsRaw = Array.isArray(levels[0]) ? levels[0] as unknown[] : [];
    const asksRaw = Array.isArray(levels[1]) ? levels[1] as unknown[] : [];
    const parseLevels = (arr: unknown[]) =>
      arr
        .map((row) => {
          if (Array.isArray(row)) return { px: toNum(row[0]), sz: toNum(row[1]) };
          if (row && typeof row === "object") {
            const obj = row as Record<string, unknown>;
            return { px: toNum(obj.px ?? obj.price), sz: toNum(obj.sz ?? obj.size) };
          }
          return { px: 0, sz: 0 };
        })
        .filter((x) => x.px > 0 && x.sz > 0);
    const bids = parseLevels(bidsRaw);
    const asks = parseLevels(asksRaw);
    const strongestBidWall = bids.length ? bids.reduce((a, b) => (b.sz > a.sz ? b : a)) : null;
    const strongestAskWall = asks.length ? asks.reduce((a, b) => (b.sz > a.sz ? b : a)) : null;
    return { strongestBidWall, strongestAskWall };
  } catch {
    return { strongestBidWall: null, strongestAskWall: null };
  }
}

export async function POST(request: Request) {
  try {
    const { tier } = await getSessionAndSubscription();
    if (tier !== "vip") {
      return NextResponse.json(
        { success: false, error: "Nova+ is for VIP subscribers.", locked: true },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const symbol = normalizeSymbol(String(body.symbol ?? "BTC"));
    const timeframeId = String(body.timeframe ?? "4h").toLowerCase();
    const amount = Number(body.amount);
    const amountValid = Number.isFinite(amount) && amount > 0 ? amount : null;
    const tf = NOVA_PLUS_TIMEFRAMES.find((t) => t.id === timeframeId) ?? NOVA_PLUS_TIMEFRAMES[3];

    const [candles, ticker, walls] = await Promise.all([
      getCandles(symbol, tf.interval, tf.limit),
      getTicker(symbol),
      fetchOrderBookWalls(symbol),
    ]);
    if (!candles.length) {
      return NextResponse.json({ success: false, error: "No candle data for selected symbol/timeframe." }, { status: 400 });
    }

    const highs = candles.map((c) => Number(c[2])).filter((n) => Number.isFinite(n));
    const lows = candles.map((c) => Number(c[3])).filter((n) => Number.isFinite(n));
    const closes = candles.map((c) => Number(c[4])).filter((n) => Number.isFinite(n));
    if (!highs.length || !lows.length || !closes.length) {
      return NextResponse.json({ success: false, error: "Could not parse candle data." }, { status: 400 });
    }

    const high = Math.max(...highs);
    const low = Math.min(...lows);
    const currentPrice = ticker?.last ? Number(ticker.last) : closes[0];
    if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
      return NextResponse.json({ success: false, error: "Could not load current price." }, { status: 400 });
    }

    const trend = getTrend(closes);
    const mid = (high + low) / 2;
    const atrPct = getAtrPct(candles as CandleTuple[], currentPrice);
    const rangePct = high > 0 ? (high - low) / high : 0.01;
    const baseStopPct = Math.min(0.12, Math.max(0.005, Math.max(atrPct * 1.5, rangePct * 0.45)));

    const nearestSupport = Math.max(low, currentPrice * (1 - baseStopPct));
    const nearestResistance = Math.min(high, currentPrice * (1 + baseStopPct));
    const bidWall = walls.strongestBidWall;
    const askWall = walls.strongestAskWall;
    const bidWallBuffer = bidWall?.px ? bidWall.px * 0.995 : 0;
    const askWallBuffer = askWall?.px ? askWall.px * 1.005 : Number.MAX_SAFE_INTEGER;

    let bias: "long" | "short" | "neutral" = "neutral";
    if (trend === "bullish" && currentPrice <= high * 0.99) bias = "long";
    else if (trend === "bearish" && currentPrice >= low * 1.01) bias = "short";

    const entry = currentPrice;
    const stopLoss =
      bias === "long"
        ? Math.min(nearestSupport, bidWallBuffer > 0 ? bidWallBuffer : nearestSupport)
        : bias === "short"
          ? Math.max(nearestResistance, askWallBuffer < Number.MAX_SAFE_INTEGER ? askWallBuffer : nearestResistance)
          : currentPrice * (1 - baseStopPct);

    const stopDistance = Math.abs(entry - stopLoss);
    const stopLossPct = entry > 0 ? (stopDistance / entry) * 100 : 0;
    const takeProfit =
      bias === "short"
        ? Math.max(low, entry - stopDistance * 1.8)
        : entry + stopDistance * 1.8;
    const riskReward = stopDistance > 0 ? Math.abs((takeProfit - entry) / stopDistance) : 0;

    /** Geometric meaning of entry / SL / TP (may differ from trend bias when bias is neutral). */
    const tradeSetup: "long" | "short" =
      takeProfit > entry && stopLoss < entry
        ? "long"
        : takeProfit < entry && stopLoss > entry
          ? "short"
          : takeProfit >= entry
            ? "long"
            : "short";

    const tradeSetupSummary =
      tradeSetup === "long"
        ? "Take profit is above entry and stop loss is below — this is a long (buy) template: you gain if price moves up."
        : "Take profit is below entry and stop loss is above — this is a short (sell) template: you gain if price moves down.";

    const tradeSetupBiasNote =
      bias === "neutral"
        ? " Structure bias is neutral; the levels are for risk framing only—not a recommendation to enter."
        : bias === "long" && tradeSetup === "long"
          ? ""
          : bias === "short" && tradeSetup === "short"
            ? ""
            : " Note: structure bias and the drawn levels use different rules—read the trade setup line for what the prices mean.";

    const riskRewardExplained =
      "Risk:reward (R:R) is the ratio of distance to take profit versus distance to stop loss. " +
      `At ${riskReward.toFixed(2)}×, the target move is about ${riskReward.toFixed(2)} times as large as the stop move—roughly $${riskReward.toFixed(2)} of reward per $1.00 put at risk to the stop, if both levels were reached in proportion.`;

    const suggestedRiskAmount = amountValid != null ? amountValid * 0.01 : null;
    const suggestedPositionSize =
      suggestedRiskAmount != null && stopDistance > 0 ? suggestedRiskAmount / stopDistance : null;

    const wallBias =
      bidWall && askWall
        ? bidWall.sz > askWall.sz * 1.2
          ? "bid_support"
          : askWall.sz > bidWall.sz * 1.2
            ? "ask_resistance"
            : "balanced"
        : "unknown";

    const analysis =
      bias === "long"
        ? "Trend and structure favor long continuation. Place stop loss below support/wall invalidation, not directly at obvious round numbers."
        : bias === "short"
          ? "Trend and structure favor short continuation. Place stop loss above resistance/wall invalidation to avoid weak short entries."
          : "Market structure is mixed. Direction is not clean; either reduce size or wait for clearer trend confirmation before entering.";

    return NextResponse.json({
      success: true,
      result: {
        symbol,
        timeframe: tf.id,
        timeframeLabel: tf.label,
        currentPrice,
        marketDirection: trend,
        bias,
        recommendedEntry: entry,
        recommendedStopLoss: stopLoss,
        stopLossDistancePct: stopLossPct,
        recommendedTakeProfit: takeProfit,
        riskReward,
        riskRewardExplained,
        tradeSetup,
        tradeSetupSummary: tradeSetupSummary + tradeSetupBiasNote,
        analysis,
        levels: {
          rangeHigh: high,
          rangeLow: low,
          mid,
        },
        orderBook: {
          strongestBidWall: bidWall,
          strongestAskWall: askWall,
          wallBias,
        },
        riskManagement: {
          maxRiskPctPerTrade: 1,
          accountAmount: amountValid,
          suggestedRiskAmount,
          suggestedPositionSize,
          note:
            "The stop loss is an invalidation level. If price hits this level, the setup is likely broken and continuation risk increases.",
        },
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Nova+ failed";
    console.error("Nova+ error:", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
