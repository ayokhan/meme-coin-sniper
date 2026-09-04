import { NOVA_UI_TIMEFRAME_IDS } from "@/lib/nova-timeframes";
import { computeWeightedMarketDirection } from "@/lib/nova-q-direction";

export type NovaQTfRow = {
  id: string;
  label: string;
  support: number;
  resistance: number;
  direction: "bullish" | "bearish" | "sideways";
  supportTouches?: number;
  resistanceTouches?: number;
};

export type NovaQAlignment = {
  label: string;
  tone: "green" | "red" | "amber" | "zinc";
  note: string;
};

export type NovaQEntryType =
  | "wait"
  | "long_limit"
  | "short_limit"
  | "long_market"
  | "short_market";

export type NovaQVoteStrength = "strong" | "weak" | "mixed";

export type NovaQTradePlan = {
  side: "long" | "short" | "wait";
  entryType: NovaQEntryType;
  /** Suggested limit or reference entry price (not a guaranteed fill). */
  suggestedEntryPrice: number | null;
  stopLossPrice: number | null;
  takeProfitPrice: number | null;
  executionTimeframeId: string | null;
  executionTimeframeLabel: string | null;
  confidence: "high" | "medium" | "low";
  headline: string;
  reasons: string[];
  /** How unanimous the blended vote is across selected TFs. */
  voteStrength: NovaQVoteStrength;
  voteSummary: string;
  /** Reward ÷ risk (price units); null when not applicable. */
  riskRewardRatio: number | null;
  riskRewardWarning: string | null;
  /** Short thesis invalid if price trades above this level. */
  invalidatedAbove: number | null;
  /** Long thesis invalid if price trades below this level. */
  invalidatedBelow: number | null;
  leverageNote: string | null;
};

function roundPx(n: number, ref: number): number {
  if (!Number.isFinite(n)) return n;
  const decimals = ref >= 1000 ? 2 : ref >= 10 ? 3 : ref >= 1 ? 4 : 6;
  return Number(n.toFixed(decimals));
}

function tfSortIndex(id: string): number {
  const i = NOVA_UI_TIMEFRAME_IDS.indexOf(id);
  return i >= 0 ? i : 999;
}

function positionInRange(price: number, low: number, high: number): number {
  const span = high - low;
  if (span <= 0) return 0.5;
  return Math.max(0, Math.min(1, (price - low) / span));
}

export function computeNovaQAlignment(timeframes: NovaQTfRow[]): NovaQAlignment | null {
  if (timeframes.length === 0) return null;
  const weighted = computeWeightedMarketDirection(timeframes);
  const bull = timeframes.filter((r) => r.direction === "bullish").length;
  const bear = timeframes.filter((r) => r.direction === "bearish").length;
  const side = timeframes.length - bull - bear;
  const tf1h = timeframes.find((r) => r.id === "1h")?.direction;
  const tf4h = timeframes.find((r) => r.id === "4h")?.direction;
  const directConflict =
    tf1h != null &&
    tf4h != null &&
    ((tf1h === "bullish" && tf4h === "bearish") || (tf1h === "bearish" && tf4h === "bullish"));

  if (weighted.hasConflict || directConflict || (bull > 0 && bear > 0)) {
    return {
      label: "Conflict — wait",
      tone: "amber",
      note:
        weighted.summary ||
        (directConflict
          ? "1h and 4h disagree—likely chop or pullback. Wait for alignment before sizing a directional trade."
          : `Mixed frames (${weighted.breakdown || `${bull} bullish / ${bear} bearish / ${side} sideways`}). Prefer confirmation before committing size.`),
    };
  }
  if (weighted.direction === "bullish" && bull > 0 && bear === 0) {
    return {
      label: "Aligned bullish (HTF-weighted)",
      tone: "green",
      note: `${weighted.breakdown}. Long setups are higher quality while this holds.`,
    };
  }
  if (weighted.direction === "bearish" && bear > 0 && bull === 0) {
    return {
      label: "Aligned bearish (HTF-weighted)",
      tone: "red",
      note: `${weighted.breakdown}. Short setups are higher quality while this holds.`,
    };
  }
  return {
    label: "Range / wait",
    tone: "zinc",
    note: weighted.breakdown
      ? `${weighted.breakdown}. Most rows are sideways—wait for a cleaner break or timeframe alignment.`
      : "Most rows are sideways—wait for a cleaner break or timeframe alignment.",
  };
}

function pickExecutionRow(rows: NovaQTfRow[]): NovaQTfRow {
  return [...rows].sort((a, b) => tfSortIndex(a.id) - tfSortIndex(b.id))[0];
}

function pickBiasRow(rows: NovaQTfRow[]): NovaQTfRow {
  return [...rows].sort((a, b) => tfSortIndex(b.id) - tfSortIndex(a.id))[0];
}

function clusterSupport(rows: NovaQTfRow[]): number {
  const supports = rows.map((r) => r.support).filter((n) => Number.isFinite(n));
  if (supports.length === 0) return NaN;
  return Math.min(...supports);
}

function clusterResistance(rows: NovaQTfRow[]): number {
  const res = rows.map((r) => r.resistance).filter((n) => Number.isFinite(n));
  if (res.length === 0) return NaN;
  return Math.max(...res);
}

export function computeVoteStrength(
  bull: number,
  bear: number,
  side: number,
  tfCount: number
): NovaQVoteStrength {
  if (bull > 0 && bear > 0) return "mixed";
  if (bull >= 2 && bear === 0) return "strong";
  if (bear >= 2 && bull === 0) return "strong";
  if (tfCount === 1 && (bull === 1 || bear === 1)) return "strong";
  if ((bull === 1 && bear === 0 && side >= 1) || (bear === 1 && bull === 0 && side >= 1)) return "weak";
  if (bull === 0 && bear === 0) return "weak";
  return "weak";
}

function computeRiskReward(plan: NovaQTradePlanCore): { ratio: number | null; warning: string | null } {
  const entry = plan.suggestedEntryPrice;
  const stop = plan.stopLossPrice;
  const target = plan.takeProfitPrice;
  if (entry == null || stop == null || target == null || plan.side === "wait") {
    return { ratio: null, warning: null };
  }
  const risk = plan.side === "long" ? entry - stop : stop - entry;
  const reward = plan.side === "long" ? target - entry : entry - target;
  if (!(risk > 0) || !Number.isFinite(reward)) {
    return { ratio: null, warning: null };
  }
  const ratio = reward / risk;
  let warning: string | null = null;
  if (reward <= 0) {
    warning = "Target is on the wrong side of entry for this side—re-run after price moves or widen the target level.";
  } else if (ratio < 0.75) {
    warning = `Poor reward vs risk (~${ratio.toFixed(2)}:1). At 30–50× leverage you can be stopped out before target—widen target, tighten stop, or size down.`;
  } else if (ratio < 1.25) {
    warning = `Tight reward vs risk (~${ratio.toFixed(2)}:1). OK for a quick scalp only if you accept frequent stop-outs at high leverage.`;
  }
  return { ratio: Number.isFinite(ratio) ? ratio : null, warning };
}

type FinalizeCtx = {
  bull: number;
  bear: number;
  side: number;
  tfCount: number;
  currentPrice: number;
  support: number;
  resistance: number;
  buffer: number;
};

function finalizeTradePlan(plan: NovaQTradePlanCore, ctx: FinalizeCtx): NovaQTradePlan {
  const voteStrength = computeVoteStrength(ctx.bull, ctx.bear, ctx.side, ctx.tfCount);
  const voteSummary = `${ctx.bear} bearish / ${ctx.bull} bullish / ${ctx.side} sideways`;

  let confidence = plan.confidence;
  if (voteStrength === "weak" && confidence === "high") {
    confidence = "medium";
  }
  if (voteStrength === "mixed") {
    confidence = "low";
  }

  const { ratio, warning: rrWarning } = computeRiskReward(plan);
  if (rrWarning && confidence === "high") {
    confidence = "medium";
  }

  let invalidatedAbove: number | null = null;
  let invalidatedBelow: number | null = null;
  if (plan.side === "short" && plan.stopLossPrice != null) {
    invalidatedAbove = plan.stopLossPrice;
  } else if (plan.side === "long" && plan.stopLossPrice != null) {
    invalidatedBelow = plan.stopLossPrice;
  }

  const reasons = [...plan.reasons];
  if (voteStrength === "weak" && plan.side !== "wait") {
    const dirWord = plan.side === "short" ? "bearish" : "bullish";
    reasons.push(
      `Weak vote (${voteSummary})—only one timeframe is fully ${dirWord}; others are sideways. Treat as a scalp, not a trend hold.`
    );
  }
  if (rrWarning) {
    reasons.push(rrWarning);
  }
  if (plan.side === "short" && invalidatedAbove != null) {
    reasons.push(
      `Thesis invalidated if price holds above ~$${invalidatedAbove.toLocaleString(undefined, { maximumFractionDigits: 2 })}—re-run NovaQ after a break.`
    );
  }
  if (plan.side === "long" && invalidatedBelow != null) {
    reasons.push(
      `Thesis invalidated if price holds below ~$${invalidatedBelow.toLocaleString(undefined, { maximumFractionDigits: 2 })}—re-run NovaQ after a break.`
    );
  }

  let leverageNote: string | null = null;
  if (plan.side !== "wait") {
    if (voteStrength === "weak" || (ratio != null && ratio < 1)) {
      leverageNote =
        "High leverage (30–50×): use limit entries, size so a stop is a small % of account, and re-run NovaQ when price crosses the invalidation level.";
    }
  }

  return {
    ...plan,
    confidence,
    reasons,
    voteStrength,
    voteSummary,
    riskRewardRatio: ratio,
    riskRewardWarning: rrWarning,
    invalidatedAbove,
    invalidatedBelow,
    leverageNote,
  };
}

type NovaQTradePlanCore = Omit<
  NovaQTradePlan,
  | "voteStrength"
  | "voteSummary"
  | "riskRewardRatio"
  | "riskRewardWarning"
  | "invalidatedAbove"
  | "invalidatedBelow"
  | "leverageNote"
>;

function finish(plan: NovaQTradePlanCore, ctx: FinalizeCtx): NovaQTradePlan {
  return finalizeTradePlan(plan, ctx);
}

/**
 * Structure-based trade plan: side, entry style, illustrative entry/stop/target.
 * Not position sizing—not financial advice.
 */
export function buildNovaQTradePlan(input: {
  marketDirection: "bullish" | "bearish" | "sideways";
  timeframes: NovaQTfRow[];
  currentPrice: number | null;
}): NovaQTradePlan | null {
  const { marketDirection, timeframes, currentPrice } = input;
  if (timeframes.length === 0 || currentPrice == null || !Number.isFinite(currentPrice)) {
    return null;
  }

  const alignment = computeNovaQAlignment(timeframes);
  const exec = pickExecutionRow(timeframes);
  const bias = pickBiasRow(timeframes);
  const support = clusterSupport(timeframes);
  const resistance = clusterResistance(timeframes);
  const span = resistance - support;
  const buffer = Math.max(span * 0.06, currentPrice * 0.0004);
  const posExec = positionInRange(currentPrice, exec.support, exec.resistance);
  const posBias = positionInRange(currentPrice, bias.support, bias.resistance);

  const reasons: string[] = [];
  const bull = timeframes.filter((r) => r.direction === "bullish").length;
  const bear = timeframes.filter((r) => r.direction === "bearish").length;
  const sideCount = timeframes.length - bull - bear;
  const conflict = bull > 0 && bear > 0;
  const ctx: FinalizeCtx = {
    bull,
    bear,
    side: sideCount,
    tfCount: timeframes.length,
    currentPrice,
    support,
    resistance,
    buffer,
  };

  if (conflict) {
    reasons.push(alignment?.note ?? "Timeframes disagree on blended direction.");
    reasons.push(
      `Use ${exec.label} for timing; ${bias.label} for bias. Do not force a full-size long or short until rows align.`
    );
    return finish(
      {
        side: "wait",
        entryType: "wait",
        suggestedEntryPrice: null,
        stopLossPrice: null,
        takeProfitPrice: null,
        executionTimeframeId: exec.id,
        executionTimeframeLabel: exec.label,
        confidence: "low",
        headline: "No preferred entry — timeframe conflict.",
        reasons,
      },
      ctx
    );
  }

  if (marketDirection === "sideways" || (bull === 0 && bear === 0)) {
    reasons.push(alignment?.note ?? "Blended vote is sideways across selected frames.");
    if (posExec > 0.35 && posExec < 0.65) {
      reasons.push(`Price is mid ${exec.label} range—range scalp only between support and resistance, or wait.`);
      return finish(
        {
          side: "wait",
          entryType: "wait",
          suggestedEntryPrice: null,
          stopLossPrice: null,
          takeProfitPrice: null,
          executionTimeframeId: exec.id,
          executionTimeframeLabel: exec.label,
          confidence: "low",
          headline: "No directional entry — mid-range with sideways vote.",
          reasons,
        },
        ctx
      );
    }
    if (posExec <= 0.35) {
      const entry = roundPx(exec.support, currentPrice);
      reasons.push(`Price is in the lower part of ${exec.label} range—optional bounce long toward resistance if you accept chop risk.`);
      return finish(
        {
          side: "long",
          entryType: "long_limit",
          suggestedEntryPrice: entry,
          stopLossPrice: roundPx(entry - buffer, currentPrice),
          takeProfitPrice: roundPx(exec.resistance, currentPrice),
          executionTimeframeId: exec.id,
          executionTimeframeLabel: exec.label,
          confidence: "low",
          headline: `Optional long limit near $${entry.toLocaleString()} (sideways vote—lower conviction).`,
          reasons,
        },
        ctx
      );
    } else {
      const entry = roundPx(exec.resistance, currentPrice);
      reasons.push(`Price is in the upper part of ${exec.label} range—optional fade short toward support if you accept chop risk.`);
      return finish(
        {
          side: "short",
          entryType: "short_limit",
          suggestedEntryPrice: entry,
          stopLossPrice: roundPx(entry + buffer, currentPrice),
          takeProfitPrice: roundPx(exec.support, currentPrice),
          executionTimeframeId: exec.id,
          executionTimeframeLabel: exec.label,
          confidence: "low",
          headline: `Optional short limit near $${entry.toLocaleString()} (sideways vote—lower conviction).`,
          reasons,
        },
        ctx
      );
    }
  }

  const preferLong = marketDirection === "bullish";
  const preferShort = marketDirection === "bearish";

  if (preferLong) {
    reasons.push(alignment?.note ?? "Aligned bullish across selected timeframes.");
    if (posExec > 0.72 || posBias > 0.78) {
      const entry = roundPx(exec.support, currentPrice);
      reasons.push("Price is extended toward resistance—do not chase; wait for pullback to support.");
      return finish(
        {
          side: "long",
          entryType: "long_limit",
          suggestedEntryPrice: entry,
          stopLossPrice: roundPx(entry - buffer, currentPrice),
          takeProfitPrice: roundPx(exec.resistance, currentPrice),
          executionTimeframeId: exec.id,
          executionTimeframeLabel: exec.label,
          confidence: "medium",
          headline: `Long limit near $${entry.toLocaleString()} (pullback entry; spot is high in range).`,
          reasons,
        },
        ctx
      );
    }
    if (posExec <= 0.38) {
      const entry = roundPx(currentPrice, currentPrice);
      reasons.push(`Price is near ${exec.label} support—favorable zone for longs while bias stays bullish.`);
      return finish(
        {
          side: "long",
          entryType: "long_market",
          suggestedEntryPrice: entry,
          stopLossPrice: roundPx(support - buffer, currentPrice),
          takeProfitPrice: roundPx(exec.resistance, currentPrice),
          executionTimeframeId: exec.id,
          executionTimeframeLabel: exec.label,
          confidence: "high",
          headline: `Long bias — enter near spot ~$${entry.toLocaleString()} with stop below support.`,
          reasons,
        },
        ctx
      );
    }
    const entry = roundPx(exec.support, currentPrice);
    reasons.push("Price is mid-range—prefer limit long at support rather than market chasing.");
    return finish(
      {
        side: "long",
        entryType: "long_limit",
        suggestedEntryPrice: entry,
        stopLossPrice: roundPx(entry - buffer, currentPrice),
        takeProfitPrice: roundPx(exec.resistance, currentPrice),
        executionTimeframeId: exec.id,
        executionTimeframeLabel: exec.label,
        confidence: "medium",
        headline: `Long limit near $${entry.toLocaleString()} (bullish vote; wait for dip).`,
        reasons,
      },
      ctx
    );
  }

  if (preferShort) {
    reasons.push(alignment?.note ?? "Aligned bearish across selected timeframes.");
    if (posExec < 0.28 || posBias < 0.22) {
      const entry = roundPx(exec.resistance, currentPrice);
      reasons.push("Price is sitting on support—avoid shorting the floor; wait for bounce toward resistance.");
      return finish(
        {
          side: "short",
          entryType: "short_limit",
          suggestedEntryPrice: entry,
          stopLossPrice: roundPx(entry + buffer, currentPrice),
          takeProfitPrice: roundPx(exec.support, currentPrice),
          executionTimeframeId: exec.id,
          executionTimeframeLabel: exec.label,
          confidence: "medium",
          headline: `Short limit near $${entry.toLocaleString()} (fade rally; spot is on support).`,
          reasons,
        },
        ctx
      );
    }
    if (posExec >= 0.62) {
      const entry = roundPx(currentPrice, currentPrice);
      reasons.push(`Price is near ${exec.label} resistance—favorable zone for shorts while bias stays bearish.`);
      return finish(
        {
          side: "short",
          entryType: "short_market",
          suggestedEntryPrice: entry,
          stopLossPrice: roundPx(resistance + buffer, currentPrice),
          takeProfitPrice: roundPx(exec.support, currentPrice),
          executionTimeframeId: exec.id,
          executionTimeframeLabel: exec.label,
          confidence: "high",
          headline: `Short bias — enter near spot ~$${entry.toLocaleString()} with stop above resistance.`,
          reasons,
        },
        ctx
      );
    }
    const entry = roundPx(exec.resistance, currentPrice);
    reasons.push("Price is mid-range—prefer limit short at resistance rather than pressing into the middle.");
    return finish(
      {
        side: "short",
        entryType: "short_limit",
        suggestedEntryPrice: entry,
        stopLossPrice: roundPx(entry + buffer, currentPrice),
        takeProfitPrice: roundPx(exec.support, currentPrice),
        executionTimeframeId: exec.id,
        executionTimeframeLabel: exec.label,
        confidence: "medium",
        headline: `Short limit near $${entry.toLocaleString()} (bearish vote; wait for bounce).`,
        reasons,
      },
      ctx
    );
  }

  return null;
}

export function formatNovaQEntryType(entryType: NovaQEntryType): string {
  switch (entryType) {
    case "long_limit":
      return "Long · limit";
    case "short_limit":
      return "Short · limit";
    case "long_market":
      return "Long · near spot";
    case "short_market":
      return "Short · near spot";
    default:
      return "Wait — no entry";
  }
}
