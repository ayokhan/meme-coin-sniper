import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import { isBlofinMetal, toBlofinInstId } from "@/lib/blofin-metals";
import { getForexSpotMid, usesSpotCalibration } from "@/lib/forex-spot-feed";
import { getForexCandles, getForexTicker, normalizeForexSymbol, validateForexScalpSymbol } from "@/lib/forex-market";
import { computeAllPivots, type PivotOhlc } from "@/lib/forex-pivots";
import { getForexRoroMeter, roroAlignmentForTrade, type RoroMeter } from "@/lib/forex-roro";
import type { Candle } from "@/lib/hyperliquid";
import { resolveScalpSymbol } from "@/lib/nova-scalp-agent";
import { getNovaScalpCandles, getNovaScalpTicker } from "@/lib/nova-scalp-blofin-market";
import { assertPnlCalculatorCalculate, getPnlCalculatorAccess } from "@/lib/pnl-calculator-access";
import { recordPnlCalculatorUse } from "@/lib/pnl-calculator-quota";

export const dynamic = "force-dynamic";

async function cryptoPrice(symbol: string): Promise<number | null> {
  let price: number | null = null;
  if (isBlofinMetal(symbol) && usesSpotCalibration(symbol)) {
    const spotMid = await getForexSpotMid(symbol);
    if (spotMid != null && Number.isFinite(spotMid)) price = spotMid;
  }
  if (price == null) {
    const ticker = await getNovaScalpTicker(symbol);
    price = ticker?.last ? Number(ticker.last) : null;
  }
  return price != null && Number.isFinite(price) && price > 0 ? price : null;
}

function pivotBarFromCandles(candles: Candle[]): PivotOhlc | null {
  if (!candles?.length) return null;
  const bar = candles.length >= 2 ? candles[1]! : candles[0]!;
  const open = Number(bar[1]);
  const high = Number(bar[2]);
  const low = Number(bar[3]);
  const close = Number(bar[4]);
  if (!(high > 0) || !(low > 0) || !(close > 0)) return null;
  return { open: open > 0 ? open : close, high, low, close, ts: bar[0] ?? null };
}

async function loadPivotOhlc(
  market: "crypto" | "forex",
  symbol: string,
  period: "1d" | "1w" | "1M"
): Promise<PivotOhlc | null> {
  try {
    if (market === "forex") {
      const candles = await getForexCandles(symbol, period === "1M" ? "1M" : period, 8);
      return pivotBarFromCandles(candles);
    }
    const bar = period === "1w" ? "1W" : period === "1M" ? "1M" : "1d";
    const candles = await getNovaScalpCandles(symbol, bar, 8);
    return pivotBarFromCandles(candles);
  } catch {
    return null;
  }
}

async function forexPrice(symbol: string): Promise<number | null> {
  if (usesSpotCalibration(symbol)) {
    const mid = await getForexSpotMid(symbol);
    if (mid != null && Number.isFinite(mid) && mid > 0) return mid;
  }
  const ticker = await getForexTicker(symbol);
  const last = ticker?.last ? Number(ticker.last) : NaN;
  return Number.isFinite(last) && last > 0 ? last : null;
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const isOwner = isOwnerSession(session);
    const url = new URL(request.url);
    const wantsCalculate = url.searchParams.get("calculate") === "1" || url.searchParams.get("calculate") === "true";

    const access = wantsCalculate
      ? await assertPnlCalculatorCalculate(session, { isOwner })
      : await getPnlCalculatorAccess(session, { isOwner });

    if (!access.ok) {
      return NextResponse.json(
        {
          success: false,
          error: access.error,
          locked: access.locked,
          disabled: access.disabled,
          needsSignIn: access.needsSignIn,
          limitReached: access.status === 429,
        },
        { status: access.status }
      );
    }

    const market = url.searchParams.get("market") === "forex" ? "forex" : "crypto";
    const rawSymbol = url.searchParams.get("symbol")?.trim() ?? (market === "forex" ? "EURUSD" : "BTC");
    const wantRoro = url.searchParams.get("roro") === "1" || url.searchParams.get("roro") === "true";
    const side = url.searchParams.get("side") === "short" ? "short" : "long";
    const pivotPeriodRaw = url.searchParams.get("pivotPeriod");
    const pivotPeriod: "1d" | "1w" | "1M" =
      pivotPeriodRaw === "1w" || pivotPeriodRaw === "1M" ? pivotPeriodRaw : "1d";

    if (market === "crypto") {
      const symbol = resolveScalpSymbol(rawSymbol);
      const [price, pivotOhlc] = await Promise.all([cryptoPrice(symbol), loadPivotOhlc("crypto", symbol, pivotPeriod)]);
      if (wantsCalculate && !isOwner) {
        await recordPnlCalculatorUse(access.userId);
      }
      return NextResponse.json({
        success: true,
        market,
        symbol,
        price,
        marketVenue: "blofin",
        blofinInstId: toBlofinInstId(symbol),
        pivotPeriod,
        pivotOhlc,
        pivots: pivotOhlc ? computeAllPivots(pivotOhlc) : [],
        quota: {
          unlimited: access.unlimited,
          used: wantsCalculate && !access.unlimited ? access.used + 1 : access.used,
          limit: access.limit,
          remaining:
            access.unlimited || access.limit == null
              ? null
              : Math.max(0, access.limit - (wantsCalculate ? access.used + 1 : access.used)),
        },
      });
    }

    const validated = validateForexScalpSymbol(rawSymbol);
    if (!validated.ok) {
      return NextResponse.json({ success: false, error: validated.error }, { status: 400 });
    }
    const symbol = normalizeForexSymbol(validated.symbol);
    const [price, usdJpyTicker, roro, pivotOhlc] = await Promise.all([
      forexPrice(symbol),
      symbol.includes("JPY") && symbol !== "USDJPY" ? forexPrice("USDJPY") : Promise.resolve(null),
      wantRoro ? getForexRoroMeter().catch(() => null) : Promise.resolve(null),
      loadPivotOhlc("forex", symbol, pivotPeriod),
    ]);

    const meter = roro as RoroMeter | null;
    const alignment = meter ? roroAlignmentForTrade(symbol, side, meter) : null;

    if (wantsCalculate && !isOwner) {
      await recordPnlCalculatorUse(access.userId);
    }

    return NextResponse.json({
      success: true,
      market,
      symbol,
      price,
      usdJpy: usdJpyTicker,
      roro: meter,
      alignment,
      pivotPeriod,
      pivotOhlc,
      pivots: pivotOhlc ? computeAllPivots(pivotOhlc) : [],
      quota: {
        unlimited: access.unlimited,
        used: wantsCalculate && !access.unlimited ? access.used + 1 : access.used,
        limit: access.limit,
        remaining:
          access.unlimited || access.limit == null
            ? null
            : Math.max(0, access.limit - (wantsCalculate ? access.used + 1 : access.used)),
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Price fetch failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
