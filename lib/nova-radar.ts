import {
  type CandleTuple,
  combineStructureAndTrendline,
  countSupportResistanceTouches,
  highLowFromCandles,
  overallTrendlineSummary,
  structureDirectionFromCloses,
  trendlineRegressionFromCloses,
} from "@/lib/nova-q-analytics";
import {
  computeNovaRadarLeverageMetrics,
  parseLeverage,
  type NovaRadarLeverageMetrics,
  type NovaRadarLeverageRisk,
  type NovaRadarStressSource,
} from "@/lib/nova-radar-leverage";
import {
  parsePositionContracts,
  parsePositionNotionalUsdt,
} from "@/lib/blofin-margin-tiers";
import {
  estimateLimitFillProbability,
  type NovaRadarFillProbability,
} from "@/lib/nova-radar-fill-probability";

/** Structure table timeframes (short → long). */
export const NOVA_RADAR_STRUCTURE_TFS = [
  { id: "5m", label: "5 mins", interval: "1m", limit: 5 },
  { id: "15m", label: "15 mins", interval: "1m", limit: 15 },
  { id: "40m", label: "40 mins", interval: "1m", limit: 40 },
  { id: "1h", label: "1 hour", interval: "1m", limit: 60 },
  { id: "4h", label: "4 hours", interval: "5m", limit: 48 },
  { id: "24h", label: "24 hours", interval: "1h", limit: 24 },
  { id: "1w", label: "1 week", interval: "1d", limit: 7 },
  { id: "4w", label: "4 weeks", interval: "1d", limit: 28 },
] as const;

export type NovaRadarTfRow = {
  id: string;
  label: string;
  support: number;
  resistance: number;
  supportTouches: number;
  resistanceTouches: number;
  structureDirection: "bullish" | "bearish" | "sideways";
  trendlineBias: "up" | "down" | "flat";
  trendlineRead: string;
  direction: "bullish" | "bearish" | "sideways";
};

export type NovaRadarPlanId = "plan1" | "plan2";

export type NovaRadarPlanInput = {
  id: NovaRadarPlanId;
  symbol: string;
  targetPrice: number;
  side: "long" | "short";
  takeProfitPrice?: number;
  stopLossPrice?: number;
};

export type NovaRadarPlanResult = {
  planId: NovaRadarPlanId;
  planLabel: string;
  symbol: string;
  side: "long" | "short";
  targetPrice: number;
  currentPrice: number;
  marketDirection: "bullish" | "bearish" | "sideways";
  overallTrendlineSummary: string;
  pricePath: "up" | "down" | "at_target";
  pctMoveFromSpot: number;
  structureAlignment: "aligned" | "mixed" | "against_trend";
  realism: "realistic" | "stretched" | "unrealistic";
  unrealistic: boolean;
  caveats: string[];
  estimatedReachDateEarly: string | null;
  estimatedReachDateLate: string | null;
  optimisticDays: number | null;
  pessimisticDays: number | null;
  structureTimeframes: NovaRadarTfRow[];
  range52w: { low: number; high: number } | null;
  avgDailyRangeUsd: number | null;
  summary: string;
  orderIntentNote: string;
  score: number;
  leverage?: NovaRadarLeverageMetrics | null;
  fillProbability?: NovaRadarFillProbability | null;
};

export type { NovaRadarFillProbability };

export type NovaRadarRunOptions = {
  leverage?: number;
  takeProfitPrice?: number;
  stopLossPrice?: number;
  /** Position size in USDT notional (Blofin tier MMR). */
  positionNotionalUsdt?: number;
  /** Alternative: number of contracts (uses Blofin contractValue when available). */
  positionContracts?: number;
  maintenanceMarginRate?: number;
  maintenanceMarginNote?: string;
};

export type { NovaRadarLeverageMetrics, NovaRadarLeverageRisk, NovaRadarStressSource };

export type NovaRadarRecommendationKind = "best_rr" | "best_fill" | "balanced" | "single";

export type NovaRadarRecommendation = {
  bestPlanId: NovaRadarPlanId;
  bestPlanLabel: string;
  reasons: string[];
  headline: string;
  subheadline: string | null;
  compareMode: boolean;
  kind: NovaRadarRecommendationKind;
  alternatePlanId: NovaRadarPlanId | null;
  alternatePlanLabel: string | null;
};

export type NovaRadarMarketContext = {
  symbol: string;
  currentPrice: number;
  marketDirection: "bullish" | "bearish" | "sideways";
  overallTrendlineSummary: string;
  structureTimeframes: NovaRadarTfRow[];
  dailyCandles: CandleTuple[];
};

export const NOVA_RADAR_PLAN_LABELS: Record<NovaRadarPlanId, string> = {
  plan1: "Trade plan 1",
  plan2: "Trade plan 2",
};

export function parseTargetPrice(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
  const s = String(raw ?? "").replace(/[$,\s]/g, "").trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function parseSide(raw: unknown): "long" | "short" {
  return String(raw ?? "long").toLowerCase() === "short" ? "short" : "long";
}

function parsePlanBlock(
  raw: unknown,
  id: NovaRadarPlanId,
  fallbackSymbol?: string
): NovaRadarPlanInput | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const symbol = String(o.symbol ?? fallbackSymbol ?? "").trim();
  const targetPrice = parseTargetPrice(o.targetPrice ?? o.price ?? o.limitPrice);
  if (!symbol || targetPrice == null) return null;
  const takeProfitPrice = parseTargetPrice(o.takeProfitPrice ?? o.takeProfit ?? o.tp) ?? undefined;
  const stopLossPrice = parseTargetPrice(o.stopLossPrice ?? o.stopLoss ?? o.sl) ?? undefined;
  return {
    id,
    symbol,
    targetPrice,
    side: parseSide(o.side ?? o.direction),
    ...(takeProfitPrice != null ? { takeProfitPrice } : {}),
    ...(stopLossPrice != null ? { stopLossPrice } : {}),
  };
}

/** Accept plan1/plan2, plans[], or legacy single fields. */
export function parseNovaRadarPlansFromBody(
  body: Record<string, unknown>
): { plans: NovaRadarPlanInput[]; error?: string } {
  const plan1Direct = parsePlanBlock(body.plan1, "plan1");
  const plan2Direct = parsePlanBlock(body.plan2, "plan2");

  if (plan1Direct) {
    const plans = [plan1Direct];
    if (plan2Direct) plans.push(plan2Direct);
    return { plans };
  }

  const plansArr = Array.isArray(body.plans) ? body.plans : null;
  if (plansArr && plansArr.length > 0) {
    const parsed: NovaRadarPlanInput[] = [];
    for (let i = 0; i < Math.min(2, plansArr.length); i++) {
      const id: NovaRadarPlanId = i === 0 ? "plan1" : "plan2";
      const p = parsePlanBlock(plansArr[i], id);
      if (p) parsed.push({ ...p, id });
    }
    if (parsed.length === 0) {
      return { plans: [], error: "Enter a valid trade plan 1 (contract, limit price, side)." };
    }
    return { plans: parsed };
  }

  const symbol = String(body.symbol ?? "").trim();
  const targetPrice = parseTargetPrice(body.targetPrice ?? body.price ?? body.amount);
  if (!symbol || targetPrice == null) {
    return {
      plans: [],
      error: "Enter trade plan 1: contract, limit price, and side.",
    };
  }
  return {
    plans: [
      {
        id: "plan1",
        symbol,
        targetPrice,
        side: parseSide(body.side ?? body.direction),
      },
    ],
  };
}

/** Shared leverage / TP / SL for the NovaRadar run (optional). */
export function parseNovaRadarRunOptions(body: Record<string, unknown>): NovaRadarRunOptions {
  const leverage = parseLeverage(body.leverage ?? body.lev);
  const takeProfitPrice = parseTargetPrice(body.takeProfitPrice ?? body.takeProfit ?? body.tp);
  const stopLossPrice = parseTargetPrice(body.stopLossPrice ?? body.stopLoss ?? body.sl);
  const opts: NovaRadarRunOptions = {};
  if (leverage != null) opts.leverage = leverage;
  if (takeProfitPrice != null) opts.takeProfitPrice = takeProfitPrice;
  if (stopLossPrice != null) opts.stopLossPrice = stopLossPrice;
  const positionNotionalUsdt = parsePositionNotionalUsdt(
    body.positionNotionalUsdt ?? body.positionNotional ?? body.notionalUsdt
  );
  const positionContracts = parsePositionContracts(
    body.positionContracts ?? body.contracts ?? body.positionSize
  );
  if (positionNotionalUsdt != null) opts.positionNotionalUsdt = positionNotionalUsdt;
  if (positionContracts != null) opts.positionContracts = positionContracts;
  if (typeof body.maintenanceMarginRate === "number" && Number.isFinite(body.maintenanceMarginRate)) {
    opts.maintenanceMarginRate = body.maintenanceMarginRate;
  }
  if (typeof body.maintenanceMarginNote === "string") {
    opts.maintenanceMarginNote = body.maintenanceMarginNote;
  }
  return opts;
}

/** Nearest structure level adverse to entry (support below long, resistance above short). */
export function nearestStructureStressPrice(
  entry: number,
  side: "long" | "short",
  rows: NovaRadarTfRow[]
): number | null {
  if (rows.length === 0 || entry <= 0) return null;
  if (side === "long") {
    const supports = rows.map((r) => r.support).filter((s) => s > 0 && s < entry * 0.9995);
    if (supports.length === 0) return null;
    return Math.max(...supports);
  }
  const resistances = rows.map((r) => r.resistance).filter((r) => r > entry * 1.0005);
  if (resistances.length === 0) return null;
  return Math.min(...resistances);
}

export function resolvePlanLeverageTargets(
  plan: NovaRadarPlanInput,
  run?: NovaRadarRunOptions
): { takeProfitPrice?: number; stopLossPrice?: number } {
  return {
    takeProfitPrice: plan.takeProfitPrice ?? run?.takeProfitPrice,
    stopLossPrice: plan.stopLossPrice ?? run?.stopLossPrice,
  };
}

export function resolveStressForPlan(
  plan: NovaRadarPlanInput,
  allPlans: NovaRadarPlanInput[] | undefined,
  tfRows: NovaRadarTfRow[]
): { price: number | null; source: NovaRadarStressSource } {
  if (allPlans && allPlans.length > 1) {
    const other = pickStressPriceForPlan(plan, allPlans);
    if (other != null) return { price: other, source: "other_plan" };
  }
  const structure = nearestStructureStressPrice(plan.targetPrice, plan.side, tfRows);
  if (structure != null) return { price: structure, source: "structure" };
  return { price: null, source: "none" };
}

/** Adverse price for the other limit: deeper long or higher short among compared plans. */
export function pickStressPriceForPlan(
  plan: NovaRadarPlanInput,
  allPlans: NovaRadarPlanInput[]
): number | null {
  const same = allPlans.filter(
    (p) => p.symbol.toUpperCase() === plan.symbol.toUpperCase() && p.side === plan.side
  );
  if (same.length < 2) return null;
  if (plan.side === "long") {
    const deeper = same
      .filter((p) => p.id !== plan.id && p.targetPrice < plan.targetPrice)
      .map((p) => p.targetPrice);
    return deeper.length > 0 ? Math.min(...deeper) : null;
  }
  const higher = same
    .filter((p) => p.id !== plan.id && p.targetPrice > plan.targetPrice)
    .map((p) => p.targetPrice);
  return higher.length > 0 ? Math.max(...higher) : null;
}

export function getOverallDirection(rows: NovaRadarTfRow[]): "bullish" | "bearish" | "sideways" {
  if (rows.length === 0) return "sideways";
  let score = 0;
  for (const r of rows) {
    if (r.direction === "bullish") score += 1;
    if (r.direction === "bearish") score -= 1;
  }
  if (score > 0) return "bullish";
  if (score < 0) return "bearish";
  return "sideways";
}

export function pathFromSpot(target: number, current: number): "up" | "down" | "at_target" {
  if (current <= 0) return "at_target";
  const rel = Math.abs(target - current) / current;
  if (rel < 0.0005) return "at_target";
  return target > current ? "up" : "down";
}

export function structureAlignment(
  path: "up" | "down" | "at_target",
  market: "bullish" | "bearish" | "sideways"
): "aligned" | "mixed" | "against_trend" {
  if (path === "at_target") return "aligned";
  if (path === "up") {
    if (market === "bullish") return "aligned";
    if (market === "bearish") return "against_trend";
    return "mixed";
  }
  if (market === "bearish") return "aligned";
  if (market === "bullish") return "against_trend";
  return "mixed";
}

function meanDailyRangeUsd(candles: CandleTuple[], maxBars = 60): number {
  const n = Math.min(maxBars, candles.length);
  if (n < 5) return 0;
  let sum = 0;
  let count = 0;
  for (let i = 0; i < n; i++) {
    const h = Number(candles[i][2]);
    const l = Number(candles[i][3]);
    if (Number.isFinite(h) && Number.isFinite(l) && h >= l) {
      sum += h - l;
      count++;
    }
  }
  return count > 0 ? sum / count : 0;
}

function addCalendarDays(from: Date, days: number): Date {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function fmtMoney(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 6, minimumFractionDigits: 2 });
}

export function buildStructureTimeframes(
  fetchCandles: (interval: string, limit: number) => Promise<CandleTuple[]>
): Promise<NovaRadarTfRow[]> {
  return (async () => {
    const tfRows: NovaRadarTfRow[] = [];
    for (const tf of NOVA_RADAR_STRUCTURE_TFS) {
      try {
        const candles = await fetchCandles(tf.interval, tf.limit);
        const hl = highLowFromCandles(candles);
        if (!hl) continue;
        const { supportTouches, resistanceTouches } = countSupportResistanceTouches(candles, hl.low, hl.high);
        const structureDirection = structureDirectionFromCloses(candles);
        const tl =
          trendlineRegressionFromCloses(candles) ?? {
            bias: "flat" as const,
            slopePctWindow: 0,
            closeVsLinePct: 0,
            read: "Too few candles for regression trendline.",
          };
        tfRows.push({
          id: tf.id,
          label: tf.label,
          support: hl.low,
          resistance: hl.high,
          supportTouches,
          resistanceTouches,
          structureDirection,
          trendlineBias: tl.bias,
          trendlineRead: tl.read,
          direction: combineStructureAndTrendline(structureDirection, tl.bias),
        });
      } catch {
        /* skip */
      }
    }
    return tfRows;
  })();
}

export function scoreNovaRadarPlan(r: NovaRadarPlanResult): number {
  let s = 0;
  if (r.realism === "realistic") s += 40;
  else if (r.realism === "stretched") s += 12;
  else s -= 60;

  if (r.structureAlignment === "aligned") s += 28;
  else if (r.structureAlignment === "mixed") s += 8;
  else s -= 18;

  if (r.pricePath === "at_target") s += 22;

  if (r.pessimisticDays != null) {
    s += Math.max(0, 18 - Math.min(18, r.pessimisticDays / 8));
  } else if (r.pricePath === "at_target") {
    s += 12;
  }

  if (r.side === "long" && r.marketDirection === "bullish") s += 8;
  if (r.side === "short" && r.marketDirection === "bearish") s += 8;

  s -= Math.min(25, r.pctMoveFromSpot / 4);

  const lev = r.leverage;
  if (lev) {
    if (lev.leverageRisk === "extreme") s -= 22;
    else if (lev.leverageRisk === "high") s -= 12;
    else if (lev.leverageRisk === "moderate") s -= 4;
    if (lev.riskRewardToTp != null && lev.riskRewardToTp < 1) s -= 10;
    else if (lev.riskRewardToTp != null && lev.riskRewardToTp >= 2) s += 6;
  }

  if (r.fillProbability) {
    s += Math.min(12, Math.floor(r.fillProbability.probabilityPct / 8));
  }

  return s;
}

function realismLabel(r: NovaRadarPlanResult["realism"]): string {
  if (r === "unrealistic") return "unrealistic";
  if (r === "stretched") return "stretched";
  return "plausible";
}

export function buildNovaRadarRecommendation(
  plans: NovaRadarPlanResult[]
): NovaRadarRecommendation {
  if (plans.length === 0) {
    return {
      bestPlanId: "plan1",
      bestPlanLabel: NOVA_RADAR_PLAN_LABELS.plan1,
      reasons: ["No plans to compare."],
      headline: "Add trade plan 1 to run NovaRadar.",
      subheadline: null,
      compareMode: false,
      kind: "single",
      alternatePlanId: null,
      alternatePlanLabel: null,
    };
  }

  if (plans.length === 1) {
    const p = plans[0];
    const reasons: string[] = [];
    if (p.realism === "unrealistic") {
      reasons.push("Level is flagged unrealistic versus recent structure and range.");
    } else if (p.realism === "stretched") {
      reasons.push("Level is reachable but stretched—wider timing uncertainty.");
    } else {
      reasons.push("Level sits within a plausible band versus spot and ~1y history.");
    }
    if (p.structureAlignment === "aligned") {
      reasons.push("Price path to your limit aligns with sampled multi-timeframe structure.");
    } else if (p.structureAlignment === "against_trend") {
      reasons.push("Fill likely needs a counter-trend move—expect wider date bands.");
    } else {
      reasons.push("Structure is mixed across timeframes—treat timing as illustrative only.");
    }
    if (p.pricePath === "at_target") {
      reasons.push("Limit is already near spot—fill timing is immediate if liquidity is there.");
    } else if (p.optimisticDays != null && p.pessimisticDays != null) {
      reasons.push(
        `Illustrative reach window: ~${p.optimisticDays}–${p.pessimisticDays} calendar days (${p.estimatedReachDateEarly ?? "?"} → ${p.estimatedReachDateLate ?? "?"}).`
      );
    }
    if (p.leverage) {
      if (p.leverage.roeAtTpPct != null) {
        reasons.push(
          `At ${p.leverage.leverage}×, TP ≈ ${p.leverage.roeAtTpPct >= 0 ? "+" : ""}${p.leverage.roeAtTpPct.toFixed(1)}% ROE; leverage risk ${p.leverage.leverageRisk}.`
        );
      }
      if (p.leverage.riskRewardToTp != null && p.leverage.riskRewardToTp < 1) {
        reasons.push("ROE reward to TP is smaller than risk to SL/stress—consider lower leverage or a deeper limit.");
      }
    }
    reasons.push(p.orderIntentNote);

    if (p.fillProbability) {
      reasons.push(p.fillProbability.note);
    }
    return {
      bestPlanId: p.planId,
      bestPlanLabel: p.planLabel,
      reasons,
      headline: `${p.planLabel} (${p.symbol} ${p.side} @ $${fmtMoney(p.targetPrice)}) — ${realismLabel(p.realism)}, structure ${p.structureAlignment.replace("_", " ")}.`,
      subheadline: p.fillProbability
        ? `Illustrative fill odds: ~${p.fillProbability.probabilityPct}% (${p.fillProbability.label}).`
        : null,
      compareMode: false,
      kind: "single",
      alternatePlanId: null,
      alternatePlanLabel: null,
    };
  }

  const sorted = [...plans].sort((a, b) => scoreNovaRadarPlan(b) - scoreNovaRadarPlan(a));
  const best = sorted[0];
  const other = sorted[1];
  const reasons: string[] = [];

  if (best.realism !== other.realism) {
    reasons.push(
      `${best.planLabel} is ${realismLabel(best.realism)} vs ${other.planLabel} (${realismLabel(other.realism)}).`
    );
  }
  if (best.structureAlignment !== other.structureAlignment) {
    reasons.push(
      `${best.planLabel} has ${best.structureAlignment.replace("_", " ")} structure vs path; ${other.planLabel} is ${other.structureAlignment.replace("_", " ")}.`
    );
  }
  const bestDays = best.pessimisticDays ?? 9999;
  const otherDays = other.pessimisticDays ?? 9999;
  if (bestDays < otherDays && best.realism !== "unrealistic") {
    reasons.push(
      `${best.planLabel} has a tighter illustrative timing band (~${best.optimisticDays ?? "?"}–${best.pessimisticDays ?? "?"} days vs ~${other.optimisticDays ?? "?"}–${other.pessimisticDays ?? "?"}).`
    );
  }
  if (best.pctMoveFromSpot < other.pctMoveFromSpot) {
    reasons.push(
      `${best.planLabel} is closer to spot (${best.pctMoveFromSpot.toFixed(2)}% vs ${other.pctMoveFromSpot.toFixed(2)}%)—generally easier to reach.`
    );
  } else if (best.pctMoveFromSpot > other.pctMoveFromSpot) {
    reasons.push(
      `${best.planLabel} is farther from spot but scores better on structure and realism—not always the nearest level.`
    );
  }
  if (best.side !== other.side) {
    reasons.push(`Sides differ (${best.side} vs ${other.side})—comparison favors fit with current structure, not direction alone.`);
  }
  if (best.leverage && other.leverage) {
    if (best.leverage.riskRewardToTp != null && other.leverage.riskRewardToTp != null) {
      if (best.leverage.riskRewardToTp > other.leverage.riskRewardToTp * 1.15) {
        reasons.push(
          `${best.planLabel} has better ROE risk/reward to TP (~${best.leverage.riskRewardToTp.toFixed(2)}:1 vs ~${other.leverage.riskRewardToTp.toFixed(2)}:1) at ${best.leverage.leverage}×.`
        );
      }
    }
    if (best.leverage.leverageRisk !== other.leverage.leverageRisk) {
      reasons.push(
        `Leverage risk: ${best.planLabel} ${best.leverage.leverageRisk} vs ${other.planLabel} ${other.leverage.leverageRisk} (entry distance changes drawdown).`
      );
    }
    if (
      best.pctMoveFromSpot < other.pctMoveFromSpot &&
      best.leverage.roeAtStressPct != null &&
      other.leverage.roeAtStressPct != null &&
      best.leverage.roeAtStressPct < other.leverage.roeAtStressPct - 15
    ) {
      reasons.push(
        `${best.planLabel} is closer to spot but suffers more ROE if price reaches ${other.planLabel}'s limit (~${best.leverage.roeAtStressPct.toFixed(0)}% vs ~${other.leverage.roeAtStressPct.toFixed(0)}% ROE)—not always the safer fill at ${best.leverage.leverage}×.`
      );
    }
  }
  if (best.fillProbability) reasons.push(best.fillProbability.note);
  if (other.fillProbability && best.planId !== other.planId) {
    reasons.push(
      `${other.planLabel} illustrative fill ~${other.fillProbability.probabilityPct}% vs ${best.planLabel} ~${best.fillProbability?.probabilityPct ?? "?"}%.`
    );
  }
  reasons.push(best.orderIntentNote);

  const scoreGap = scoreNovaRadarPlan(best) - scoreNovaRadarPlan(other);
  const closerIsOther = other.pctMoveFromSpot < best.pctMoveFromSpot;
  const betterFillOther =
    (other.fillProbability?.probabilityPct ?? 0) >
    (best.fillProbability?.probabilityPct ?? 0) + 12;
  const betterRrBest =
    best.leverage?.riskRewardToTp != null &&
    other.leverage?.riskRewardToTp != null &&
    best.leverage.riskRewardToTp > other.leverage.riskRewardToTp * 1.2;

  let kind: NovaRadarRecommendationKind = scoreGap < 8 ? "balanced" : "best_rr";
  let subheadline: string | null = null;
  let alternatePlanId: NovaRadarPlanId | null = null;
  let alternatePlanLabel: string | null = null;

  if (closerIsOther && betterFillOther && betterRrBest) {
    kind = "best_rr";
    subheadline = `Recommended for risk/reward and structure — not the easiest fill. For higher fill odds, consider ${other.planLabel} (~${other.fillProbability?.probabilityPct ?? "?"}% illustrative).`;
    alternatePlanId = other.planId;
    alternatePlanLabel = other.planLabel;
  } else if (best.pctMoveFromSpot < other.pctMoveFromSpot && betterRrBest) {
    subheadline = `${best.planLabel} is farther from spot but scores better on R:R and structure—${other.planLabel} is closer if you fear missing the dip.`;
    alternatePlanId = other.planId;
    alternatePlanLabel = other.planLabel;
  }

  const headline =
    scoreGap < 8
      ? `${best.planLabel} edges ${other.planLabel}—both are workable; review flags on each card.`
      : kind === "best_rr" && subheadline
        ? `Recommended for R:R: ${best.planLabel} over ${other.planLabel}`
        : `Recommended: ${best.planLabel} over ${other.planLabel} for this structure snapshot.`;

  return {
    bestPlanId: best.planId,
    bestPlanLabel: best.planLabel,
    reasons,
    headline,
    subheadline,
    compareMode: true,
    kind,
    alternatePlanId,
    alternatePlanLabel,
  };
}

export function analyzeNovaRadarPlan(
  plan: NovaRadarPlanInput,
  ctx: NovaRadarMarketContext,
  runOptions?: NovaRadarRunOptions,
  allPlans?: NovaRadarPlanInput[]
): NovaRadarPlanResult {
  const { currentPrice, marketDirection, structureTimeframes: tfRows, dailyCandles } = ctx;
  const targetPrice = plan.targetPrice;
  const side = plan.side;
  const symbol = plan.symbol;
  const trendlineSummary = ctx.overallTrendlineSummary;

  const pricePath = pathFromSpot(targetPrice, currentPrice);
  const alignment = structureAlignment(pricePath, marketDirection);

  const slice52 = dailyCandles.slice(0, Math.min(364, dailyCandles.length));
  const hl52 = highLowFromCandles(slice52);
  const low52 = hl52?.low ?? null;
  const high52 = hl52?.high ?? null;

  const pctMove = Math.abs(targetPrice - currentPrice) / currentPrice;
  const caveats: string[] = [];
  let realism: "realistic" | "stretched" | "unrealistic" = "realistic";

  if (pctMove > 2) {
    realism = "unrealistic";
    caveats.push("Target implies a move greater than 200% from spot—this is not a practical near-term limit scenario.");
  } else if (pctMove > 0.85) {
    realism = "stretched";
    caveats.push("Target implies a very large percentage move—timing and path risk are elevated.");
  }

  if (low52 != null && high52 != null && high52 > low52) {
    if (targetPrice < low52 * 0.25) {
      realism = "unrealistic";
      caveats.push("Target is far below the ~1y trough of the loaded history—outside normal structural reach without a major regime shift.");
    } else if (targetPrice > high52 * 4) {
      realism = "unrealistic";
      caveats.push("Target is far above the ~1y peak of the loaded history—implies repricing far beyond recent structure.");
    } else if (realism === "realistic" && (targetPrice < low52 * 0.65 || targetPrice > high52 * 1.55)) {
      realism = "stretched";
      caveats.push("Target sits notably outside the recent ~1y range—expect wide uncertainty on when (or if) price trades there.");
    }
  }

  const avgRange = meanDailyRangeUsd(dailyCandles, 56);
  const floorMove = Math.max(avgRange, currentPrice * 0.004);
  const distance = Math.abs(targetPrice - currentPrice);

  let optimisticDays: number | null = null;
  let pessimisticDays: number | null = null;
  let estimatedReachDateEarly: string | null = null;
  let estimatedReachDateLate: string | null = null;

  if (realism !== "unrealistic" && pricePath !== "at_target" && floorMove > 0) {
    let base = distance / floorMove;
    if (alignment === "against_trend") base *= 1.85;
    else if (alignment === "mixed" || marketDirection === "sideways") base *= 1.2;
    if (realism === "stretched") base *= 1.35;

    optimisticDays = Math.max(1, Math.floor(base * 0.55));
    pessimisticDays = Math.max(optimisticDays, Math.ceil(base * 1.5));
    const cap = 720;
    if (pessimisticDays > cap) {
      pessimisticDays = cap;
      caveats.push("Even the late estimate hit the model cap (720 days)—the path is too uncertain to narrow further from structure alone.");
    }

    const now = new Date();
    estimatedReachDateEarly = addCalendarDays(now, optimisticDays).toISOString().slice(0, 10);
    estimatedReachDateLate = addCalendarDays(now, pessimisticDays).toISOString().slice(0, 10);
  }

  const orderNotes =
    side === "long"
      ? targetPrice < currentPrice
        ? "Long limit below spot: you are waiting for a pullback (price must move down to your limit)."
        : targetPrice > currentPrice
          ? "Long limit above spot: you are waiting for a breakout (price must move up to your limit)."
          : "Limit is essentially at spot."
      : targetPrice > currentPrice
        ? "Short limit above spot: you are waiting for a rally into a higher price (price must move up to your limit)."
        : targetPrice < currentPrice
          ? "Short limit below spot: you are waiting for a continuation lower (price must move down to your limit)."
          : "Limit is essentially at spot.";

  let alignmentNote = "";
  if (pricePath === "at_target") {
    alignmentNote = "Price is already at your limit area—fill risk is immediate if liquidity is available.";
  } else if (alignment === "aligned") {
    alignmentNote =
      pricePath === "up"
        ? "Broad structure favors upward progression toward your limit—path and timing are more intuitive, not guaranteed."
        : "Broad structure favors downward progression toward your limit—path and timing are more intuitive, not guaranteed.";
  } else if (alignment === "against_trend") {
    alignmentNote =
      pricePath === "up"
        ? "Price must rally to your limit while shorter structure skews bearish—expect a counter-trend move; timing bands widen."
        : "Price must drop to your limit while shorter structure skews bullish—expect a counter-trend pullback; timing bands widen.";
  } else {
    alignmentNote = "Structure is mixed across sampled periods—use the banded dates as a rough compass, not a schedule.";
  }

  const planLabel = NOVA_RADAR_PLAN_LABELS[plan.id];
  const summaryParts = [
    `${planLabel} — ${symbol}: spot $${fmtMoney(currentPrice)}, ${side} limit $${fmtMoney(targetPrice)} (${((targetPrice - currentPrice) / currentPrice * 100).toFixed(2)}% vs spot).`,
    `Market structure (sampled TFs): ${marketDirection}. Price path to fill: ${pricePath === "at_target" ? "already near limit" : pricePath === "up" ? "needs higher prices" : "needs lower prices"}.`,
    trendlineSummary,
    orderNotes,
    alignmentNote,
  ];
  if (realism === "unrealistic") {
    summaryParts.push("Verdict: unrealistic as a baseline limit plan—consider revising the level or thesis.");
  } else if (optimisticDays != null && pessimisticDays != null && estimatedReachDateEarly && estimatedReachDateLate) {
    summaryParts.push(
      `Illustrative timing (volatility- and structure-based, not advice): roughly ${optimisticDays}–${pessimisticDays} calendar days (${estimatedReachDateEarly} → ${estimatedReachDateLate}), wider if liquidity gaps or regime shifts occur.`
    );
  } else if (pricePath === "at_target") {
    summaryParts.push("No ETA needed—level is already near current trading.");
  }

  const fillProbability = estimateLimitFillProbability({
    currentPrice,
    targetPrice,
    side,
    avgDailyRangeUsd: avgRange > 0 ? avgRange : null,
    pessimisticDays,
    pricePath,
    structureAlignment: alignment,
  });

  let leverageMetrics: NovaRadarLeverageMetrics | null = null;
  if (runOptions?.leverage != null && runOptions.leverage >= 1) {
    const targets = resolvePlanLeverageTargets(plan, runOptions);
    const stress = resolveStressForPlan(plan, allPlans, tfRows);
    leverageMetrics = computeNovaRadarLeverageMetrics(
      targetPrice,
      side,
      {
        leverage: runOptions.leverage,
        takeProfitPrice: targets.takeProfitPrice,
        stopLossPrice: targets.stopLossPrice,
        maintenanceMarginRate: runOptions.maintenanceMarginRate,
      },
      {
        stressPrice: stress.price,
        stressSource: stress.source,
        maintenanceMarginNote: runOptions.maintenanceMarginNote ?? null,
      }
    );
    if (leverageMetrics) {
      if (leverageMetrics.leverageRisk === "extreme" || leverageMetrics.leverageRisk === "high") {
        caveats.push(
          leverageMetrics.leverageRisk === "extreme"
            ? `At ${leverageMetrics.leverage}×, drawdown to stress/SL can approach liquidation band—verify Est. Liq. on your exchange.`
            : `At ${leverageMetrics.leverage}×, adverse moves before fill can stress margin even when structure is aligned.`
        );
      }
      summaryParts.push(leverageMetrics.notes[0] ?? "");
      if (leverageMetrics.roeAtTpPct != null && targets.takeProfitPrice != null) {
        summaryParts.push(
          `TP $${fmtMoney(targets.takeProfitPrice)}: ~${leverageMetrics.roeAtTpPct >= 0 ? "+" : ""}${leverageMetrics.roeAtTpPct.toFixed(1)}% ROE at ${leverageMetrics.leverage}×.`
        );
      }
    }
  }

  const result: NovaRadarPlanResult = {
    planId: plan.id,
    planLabel,
    symbol,
    side,
    targetPrice,
    currentPrice,
    marketDirection,
    overallTrendlineSummary: trendlineSummary,
    pricePath,
    pctMoveFromSpot: pctMove * 100,
    structureAlignment: alignment,
    realism,
    unrealistic: realism === "unrealistic",
    caveats: [...new Set(caveats)],
    estimatedReachDateEarly,
    estimatedReachDateLate,
    optimisticDays,
    pessimisticDays,
    structureTimeframes: tfRows,
    range52w: low52 != null && high52 != null ? { low: low52, high: high52 } : null,
    avgDailyRangeUsd: avgRange > 0 ? avgRange : null,
    summary: summaryParts.join(" "),
    orderIntentNote: orderNotes,
    score: 0,
    leverage: leverageMetrics,
    fillProbability,
  };
  result.score = scoreNovaRadarPlan(result);
  return result;
}

export const NOVA_RADAR_DISCLAIMER =
  "NovaRadar estimates structure, trend, and typical daily ranges from recent history. Optional leverage/TP/SL math is illustrative (isolated-margin ROE and approximate liquidation)—use your exchange’s Est. Liq. Price and margin ratio before trading. This is not financial advice; markets can gap, liquidate, and invalidate levels quickly.";
