import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSessionAndSubscription } from "@/lib/auth-server";
import { getBlofinConfigForUser } from "@/lib/blofin-user-config";
import { buildUnifiedMarketRead } from "@/lib/nova-market-read";
import { buildSplitOrderSuggestion } from "@/lib/nova-radar-split";
import { getCandles, getTicker } from "@/lib/hyperliquid";
import { getInstrument } from "@/lib/blofin";
import {
  getBlofinMetalCandles,
  getBlofinMetalInstId,
  getBlofinMetalTicker,
  isBlofinMetal,
  normalizeMetalBase,
  type BlofinMetal,
} from "@/lib/blofin-metals";
import { resolveBlofinMaintenanceMargin } from "@/lib/blofin-margin-tiers";
import {
  analyzeNovaRadarPlan,
  buildNovaRadarRecommendation,
  buildStructureTimeframes,
  getOverallDirection,
  NOVA_RADAR_DISCLAIMER,
  parseNovaRadarPlansFromBody,
  parseNovaRadarRunOptions,
  type NovaRadarMarketContext,
  type NovaRadarPlanInput,
  type NovaRadarRunOptions,
} from "@/lib/nova-radar";
import { overallTrendlineSummary, type CandleTuple } from "@/lib/nova-q-analytics";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

async function enrichRunOptionsForSymbol(
  base: NovaRadarRunOptions,
  symbol: string,
  markPrice: number,
  userBlofinConfig: Awaited<ReturnType<typeof getBlofinConfigForUser>>
): Promise<NovaRadarRunOptions> {
  if (base.leverage == null || base.maintenanceMarginRate != null) return base;

  const sym = normalizeSymbol(symbol);
  let contractValue: number | null = null;
  if (isBlofinMetal(sym)) {
    const instId = getBlofinMetalInstId(sym);
    if (instId) {
      try {
        const inst = await getInstrument(instId, {
          config: userBlofinConfig ?? undefined,
          demo: userBlofinConfig?.demo,
        });
        const cv = inst ? Number(inst.contractValue) : NaN;
        if (Number.isFinite(cv) && cv > 0) contractValue = cv;
      } catch {
        /* public instrument lookup optional */
      }
    }
  }

  const resolved = resolveBlofinMaintenanceMargin({
    symbol: sym,
    markPrice,
    positionNotionalUsdt: base.positionNotionalUsdt,
    positionContracts: base.positionContracts,
    contractValue,
  });

  return {
    ...base,
    maintenanceMarginRate: resolved.maintenanceMarginRate,
    contractValue: contractValue ?? undefined,
    maintenanceMarginNote:
      resolved.contracts != null
        ? `Blofin ${resolved.tierLabel}${userBlofinConfig ? " (your API keys)" : ""}, ~${resolved.contracts.toLocaleString(undefined, { maximumFractionDigits: 2 })} contracts${contractValue != null ? `, ${contractValue} per contract` : ""}`
        : `Blofin ${resolved.tierLabel}${userBlofinConfig ? " (your API keys)" : ""}`,
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
    const bodyRec = body as Record<string, unknown>;
    const { plans, error: parseError } = parseNovaRadarPlansFromBody(bodyRec);
    const runOptions = parseNovaRadarRunOptions(bodyRec);
    if (parseError || plans.length === 0) {
      return NextResponse.json({ success: false, error: parseError ?? "Invalid request." }, { status: 400 });
    }

    if (plans.length > 2) {
      return NextResponse.json({ success: false, error: "At most two trade plans (plan 1 and optional plan 2)." }, { status: 400 });
    }

    const contexts = new Map<string, NovaRadarMarketContext>();
    const normalizedPlans: NovaRadarPlanInput[] = [];

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
      normalizedPlans.push({ ...plan, symbol: contexts.get(symKey)!.symbol });
    }

    const session = await getServerSession(authOptions);
    const userBlofinConfig = session?.user?.id
      ? await getBlofinConfigForUser(session.user.id)
      : null;

    const mmrBySymbol = new Map<string, NovaRadarRunOptions>();
    if (runOptions.leverage != null) {
      for (const [symKey, ctx] of contexts.entries()) {
        mmrBySymbol.set(
          symKey,
          await enrichRunOptionsForSymbol(runOptions, ctx.symbol, ctx.currentPrice, userBlofinConfig)
        );
      }
    }

    const planResults = normalizedPlans.map((p) => {
      const symKey = normalizeSymbol(p.symbol);
      const ctx = contexts.get(symKey)!;
      const opts =
        runOptions.leverage != null
          ? mmrBySymbol.get(symKey) ?? runOptions
          : Object.keys(runOptions).length > 0
            ? runOptions
            : undefined;
      return analyzeNovaRadarPlan(p, ctx, opts, normalizedPlans);
    });

    const recommendation = buildNovaRadarRecommendation(planResults);
    const primarySymbol = planResults[0]?.symbol ?? normalizeSymbol(plans[0].symbol);
    const sharedCtx = contexts.get(normalizeSymbol(primarySymbol));

    const marketRead = sharedCtx
      ? buildUnifiedMarketRead(
          sharedCtx.structureTimeframes,
          sharedCtx.currentPrice,
          sharedCtx.overallTrendlineSummary
        )
      : null;

    const tpForSplit =
      runOptions.takeProfitPrice ??
      planResults[0]?.leverage?.takeProfitPrice ??
      planResults[1]?.leverage?.takeProfitPrice ??
      null;
    const splitSuggestion =
      runOptions.leverage != null
        ? buildSplitOrderSuggestion(planResults, tpForSplit, runOptions.leverage)
        : null;

    return NextResponse.json({
      success: true,
      plans: planResults,
      recommendation,
      marketRead,
      splitSuggestion,
      blofinKeysConfigured: !!userBlofinConfig,
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
      runOptions: Object.keys(runOptions).length > 0 ? runOptions : null,
      disclaimer: NOVA_RADAR_DISCLAIMER,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "NovaRadar failed";
    console.error("NovaRadar error:", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
