import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSessionAndSubscription } from "@/lib/auth-server";
import { getBlofinConfigForUser } from "@/lib/blofin-user-config";
import { buildUnifiedMarketRead } from "@/lib/nova-market-read";
import { buildSplitOrderSuggestion } from "@/lib/nova-radar-split";
import { getInstrument } from "@/lib/blofin";
import { toBlofinInstId } from "@/lib/blofin-metals";
import { resolveBlofinMaintenanceMargin } from "@/lib/blofin-margin-tiers";
import {
  analyzeNovaRadarPlan,
  buildNovaRadarRecommendation,
  NOVA_RADAR_DISCLAIMER,
  parseNovaRadarPlansFromBody,
  parseNovaRadarRunOptions,
  type NovaRadarMarketContext,
  type NovaRadarPlanInput,
  type NovaRadarRunOptions,
} from "@/lib/nova-radar";
import {
  loadNovaRadarMarketContext,
  normalizeNovaRadarSymbol,
} from "@/lib/nova-radar-market-context";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function enrichRunOptionsForSymbol(
  base: NovaRadarRunOptions,
  symbol: string,
  markPrice: number,
  userBlofinConfig: Awaited<ReturnType<typeof getBlofinConfigForUser>>
): Promise<NovaRadarRunOptions> {
  if (base.leverage == null || base.maintenanceMarginRate != null) return base;

  const sym = normalizeNovaRadarSymbol(symbol);
  let contractValue: number | null = null;
  const instId = toBlofinInstId(sym);
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
    const { tier, userId } = await getSessionAndSubscription();
    if (tier !== "vip") {
      return NextResponse.json(
        { success: false, error: "NovaRadar is for VIP subscribers.", locked: true },
        { status: 403 }
      );
    }
    const { trialDeskLimitResponse } = await import("@/lib/trial-desk-gate");
    const blocked = await trialDeskLimitResponse(userId, "nova_radar");
    if (blocked) return blocked;

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
      const symKey = normalizeNovaRadarSymbol(plan.symbol);
      let ctx = contexts.get(symKey);
      if (!ctx) {
        const loaded = await loadNovaRadarMarketContext(plan.symbol);
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
      const symKey = normalizeNovaRadarSymbol(p.symbol);
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
    const primarySymbol = planResults[0]?.symbol ?? normalizeNovaRadarSymbol(plans[0].symbol);
    const sharedCtx = contexts.get(normalizeNovaRadarSymbol(primarySymbol));

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
