import { NextResponse } from "next/server";
import { getSessionAndSubscription } from "@/lib/auth-server";
import { getCandles, getTicker } from "@/lib/hyperliquid";
import {
  getBlofinMetalCandles,
  getBlofinMetalInstId,
  getBlofinMetalTicker,
  isBlofinMetal,
  normalizeMetalBase,
  type BlofinMetal,
} from "@/lib/blofin-metals";
import {
  analyzeNovaRadarPlan,
  buildNovaRadarRecommendation,
  buildStructureTimeframes,
  getOverallDirection,
  NOVA_RADAR_DISCLAIMER,
  parseNovaRadarPlansFromBody,
  type NovaRadarMarketContext,
  type NovaRadarPlanInput,
} from "@/lib/nova-radar";
import { overallTrendlineSummary, type CandleTuple } from "@/lib/nova-q-analytics";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

function normalizeSymbol(raw: string): string {
  return normalizeMetalBase(raw) || "BTC";
}

async function loadMarketContext(symbolRaw: string): Promise<
  | { ok: true; ctx: NovaRadarMarketContext; normalizedSymbol: string }
  | { ok: false; error: string; status: number }
> {
  const symbol = normalizeSymbol(symbolRaw);
  const useBlofin = isBlofinMetal(symbol);
  const metal = useBlofin ? (symbol as BlofinMetal) : null;
  const blofinInst = metal ? getBlofinMetalInstId(metal)! : "";

  const [ticker, dailyCandles] = await Promise.all([
    useBlofin && metal ? getBlofinMetalTicker(metal) : getTicker(symbol),
    (useBlofin && metal
      ? getBlofinMetalCandles(metal, "1d", 400)
      : getCandles(symbol, "1d", 400)) as Promise<CandleTuple[]>,
  ]);

  let currentPrice = ticker?.last ? Number(ticker.last) : NaN;
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
    const c0 = dailyCandles[0]?.[4];
    const fallback = c0 != null ? Number(c0) : NaN;
    if (Number.isFinite(fallback) && fallback > 0) currentPrice = fallback;
  }

  if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
    return {
      ok: false,
      error: useBlofin
        ? `No live price for ${symbol}. Check Blofin (${blofinInst}) availability.`
        : `No live price for ${symbol}. Check the contract symbol (Hyperliquid perps).`,
      status: 400,
    };
  }

  const fetchCandles = (interval: string, limit: number) =>
    (useBlofin && metal
      ? getBlofinMetalCandles(metal, interval, limit)
      : getCandles(symbol, interval, limit)) as Promise<CandleTuple[]>;

  const tfRows = await buildStructureTimeframes(fetchCandles);

  if (tfRows.length === 0 && dailyCandles.length === 0) {
    return {
      ok: false,
      error: `No candle data for ${symbol}. Try another contract.`,
      status: 400,
    };
  }

  const marketDirection = getOverallDirection(tfRows);
  const trendlineSummary = overallTrendlineSummary(tfRows);

  return {
    ok: true,
    normalizedSymbol: symbol,
    ctx: {
      symbol,
      currentPrice,
      marketDirection,
      overallTrendlineSummary: trendlineSummary,
      structureTimeframes: tfRows,
      dailyCandles,
    },
  };
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
    const { plans, error: parseError } = parseNovaRadarPlansFromBody(body as Record<string, unknown>);
    if (parseError || plans.length === 0) {
      return NextResponse.json({ success: false, error: parseError ?? "Invalid request." }, { status: 400 });
    }

    if (plans.length > 2) {
      return NextResponse.json({ success: false, error: "At most two trade plans (plan 1 and optional plan 2)." }, { status: 400 });
    }

    const contexts = new Map<string, NovaRadarMarketContext>();
    const planResults = [];

    for (const plan of plans) {
      const symKey = normalizeSymbol(plan.symbol);
      let ctx = contexts.get(symKey);
      if (!ctx) {
        const loaded = await loadMarketContext(plan.symbol);
        if (!loaded.ok) {
          return NextResponse.json({ success: false, error: loaded.error }, { status: loaded.status });
        }
        ctx = loaded.ctx;
        contexts.set(symKey, ctx);
      }
      const normalizedPlan: NovaRadarPlanInput = { ...plan, symbol: ctx.symbol };
      planResults.push(analyzeNovaRadarPlan(normalizedPlan, ctx));
    }

    const recommendation = buildNovaRadarRecommendation(planResults);
    const primarySymbol = planResults[0]?.symbol ?? normalizeSymbol(plans[0].symbol);
    const sharedCtx = contexts.get(normalizeSymbol(primarySymbol));

    return NextResponse.json({
      success: true,
      plans: planResults,
      recommendation,
      shared: sharedCtx
        ? {
            symbol: sharedCtx.symbol,
            currentPrice: sharedCtx.currentPrice,
            marketDirection: sharedCtx.marketDirection,
            overallTrendlineSummary: sharedCtx.overallTrendlineSummary,
          }
        : null,
      /** @deprecated use plans[0] — kept for older clients */
      result: planResults[0] ?? null,
      disclaimer: NOVA_RADAR_DISCLAIMER,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "NovaRadar failed";
    console.error("NovaRadar error:", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
