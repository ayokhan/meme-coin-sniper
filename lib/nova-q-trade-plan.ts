import { NOVA_UI_TIMEFRAME_IDS } from "@/lib/nova-timeframes";

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
  const bull = timeframes.filter((r) => r.direction === "bullish").length;
  const bear = timeframes.filter((r) => r.direction === "bearish").length;
  const side = timeframes.length - bull - bear;
  const tf1h = timeframes.find((r) => r.id === "1h")?.direction;
  const tf4h = timeframes.find((r) => r.id === "4h")?.direction;
  const directConflict =
    tf1h != null &&
    tf4h != null &&
    ((tf1h === "bullish" && tf4h === "bearish") || (tf1h === "bearish" && tf4h === "bullish"));

  if (directConflict || (bull > 0 && bear > 0)) {
    return {
      label: "Conflict (pullback zone)",
      tone: "amber",
      note:
        directConflict
          ? "1h and 4h disagree—likely chop or pullback. Wait for alignment before sizing a directional trade."
          : `Mixed blended rows (${bull} bullish / ${bear} bearish / ${side} sideways). Prefer confirmation before committing size.`,
    };
  }
  if (bull > 0 && bear === 0) {
    return {
      label: "Aligned bullish",
      tone: "green",
      note: `Blended rows are aligned bullish (${bull} bullish / ${side} sideways). Long setups are higher quality while this holds.`,
    };
  }
  if (bear > 0 && bull === 0) {
    return {
      label: "Aligned bearish",
      tone: "red",
      note: `Blended rows are aligned bearish (${bear} bearish / ${side} sideways). Short setups are higher quality while this holds.`,
    };
  }
  return {
    label: "Range / wait",
    tone: "zinc",
    note: "Most rows are sideways—wait for a cleaner break or timeframe alignment.",
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
  const conflict = bull > 0 && bear > 0;

  if (conflict) {
    reasons.push(alignment?.note ?? "Timeframes disagree on blended direction.");
    reasons.push(
      `Use ${exec.label} for timing; ${bias.label} for bias. Do not force a full-size long or short until rows align.`
    );
    return {
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
    };
  }

  if (marketDirection === "sideways" || (bull === 0 && bear === 0)) {
    reasons.push(alignment?.note ?? "Blended vote is sideways across selected frames.");
    if (posExec > 0.35 && posExec < 0.65) {
      reasons.push(`Price is mid ${exec.label} range—range scalp only between support and resistance, or wait.`);
      return {
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
      };
    }
    if (posExec <= 0.35) {
      const entry = roundPx(exec.support, currentPrice);
      reasons.push(`Price is in the lower part of ${exec.label} range—optional bounce long toward resistance if you accept chop risk.`);
      return {
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
      };
    } else {
      const entry = roundPx(exec.resistance, currentPrice);
      reasons.push(`Price is in the upper part of ${exec.label} range—optional fade short toward support if you accept chop risk.`);
      return {
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
      };
    }
  }

  const preferLong = marketDirection === "bullish";
  const preferShort = marketDirection === "bearish";

  if (preferLong) {
    reasons.push(alignment?.note ?? "Aligned bullish across selected timeframes.");
    if (posExec > 0.72 || posBias > 0.78) {
      const entry = roundPx(exec.support, currentPrice);
      reasons.push("Price is extended toward resistance—do not chase; wait for pullback to support.");
      return {
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
      };
    }
    if (posExec <= 0.38) {
      const entry = roundPx(currentPrice, currentPrice);
      reasons.push(`Price is near ${exec.label} support—favorable zone for longs while bias stays bullish.`);
      return {
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
      };
    }
    const entry = roundPx(exec.support, currentPrice);
    reasons.push("Price is mid-range—prefer limit long at support rather than market chasing.");
    return {
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
    };
  }

  if (preferShort) {
    reasons.push(alignment?.note ?? "Aligned bearish across selected timeframes.");
    if (posExec < 0.28 || posBias < 0.22) {
      const entry = roundPx(exec.resistance, currentPrice);
      reasons.push("Price is sitting on support—avoid shorting the floor; wait for bounce toward resistance.");
      return {
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
      };
    }
    if (posExec >= 0.62) {
      const entry = roundPx(currentPrice, currentPrice);
      reasons.push(`Price is near ${exec.label} resistance—favorable zone for shorts while bias stays bearish.`);
      return {
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
      };
    }
    const entry = roundPx(exec.resistance, currentPrice);
    reasons.push("Price is mid-range—prefer limit short at resistance rather than pressing into the middle.");
    return {
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
    };
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
