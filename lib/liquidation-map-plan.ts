/**
 * Map-derived suggested entry / hard-invalidation stop for Liquidation Map trade check.
 * Educational only — clusters are modelled magnets, not exchange liquidation books.
 */

export type LiqPlanCluster = {
  label: string;
  side: "long_liq_below" | "short_liq_above";
  price: number;
  distancePct: number;
};

export type SuggestedStop = {
  price: number;
  distancePctFromEntry: number;
  basis: "nearest_liq_pocket" | "structural_proxy";
  reason: string;
};

export type SuggestedEntry = {
  price: number;
  distancePctFromCurrent: number;
  reason: string;
};

export type LiquidationMapSuggestedPlan = {
  suggestedStop: SuggestedStop;
  /** Present only when waiting for a better price improves clearance vs current entry. */
  suggestedEntry: SuggestedEntry | null;
  keepYourEntry: boolean;
  /** R:R using (suggested entry or your entry) → your exit vs suggested stop. */
  planRrMultiple: number | null;
  summary: string;
};

/** Clearance above/below pocket before considering entry “safe enough”. */
export const LIQ_ENTRY_CLEARANCE_PCT = 0.9;
/** Buffer past pocket for hard invalidation stop. */
export const LIQ_STOP_BUFFER_PCT = 0.2;
/** Only suggest a new entry if it improves vs current by at least this %. */
const MIN_ENTRY_IMPROVE_PCT = 0.25;
/** Cap how far “better” entry can be from current (avoid absurd waits). */
const MAX_ENTRY_IMPROVE_PCT = 5;

function pctFrom(from: number, to: number): number {
  if (!Number.isFinite(from) || from === 0 || !Number.isFinite(to)) return 0;
  return ((to - from) / from) * 100;
}

function roundPx(n: number, ref: number): number {
  if (!Number.isFinite(n)) return n;
  const decimals = ref >= 1000 ? 2 : ref >= 10 ? 3 : ref >= 1 ? 4 : 6;
  return Number(n.toFixed(decimals));
}

export function pickNearestAdverseCluster(
  traderType: "long" | "short",
  clusters: LiqPlanCluster[]
): LiqPlanCluster | undefined {
  const side = traderType === "long" ? "long_liq_below" : "short_liq_above";
  return [...clusters]
    .filter((c) => c.side === side && Number.isFinite(c.price) && c.price > 0)
    .sort((a, b) => a.distancePct - b.distancePct)[0];
}

/**
 * Build suggested hard stop + optional better entry from map clusters / bias.
 */
export function buildLiquidationMapSuggestedPlan(input: {
  traderType: "long" | "short";
  entry: number;
  exit: number;
  markPrice: number;
  bias: "long" | "short" | "neutral";
  trend: "up" | "down" | "sideways";
  clusters: LiqPlanCluster[];
}): LiquidationMapSuggestedPlan {
  const { traderType, entry, exit, markPrice, bias, trend, clusters } = input;
  const riskProxy = Math.max(entry * 0.004, markPrice * 0.003);
  const cluster = pickNearestAdverseCluster(traderType, clusters);

  let suggestedStop: SuggestedStop;
  if (cluster) {
    let stop =
      traderType === "long"
        ? cluster.price * (1 - LIQ_STOP_BUFFER_PCT / 100)
        : cluster.price * (1 + LIQ_STOP_BUFFER_PCT / 100);
    // Must invalidate the thesis (beyond entry).
    if (traderType === "long" && stop >= entry) stop = entry - riskProxy;
    if (traderType === "short" && stop <= entry) stop = entry + riskProxy;
    stop = roundPx(stop, entry);
    suggestedStop = {
      price: stop,
      distancePctFromEntry: Math.abs(pctFrom(entry, stop)),
      basis: "nearest_liq_pocket",
      reason: `Hard invalidation outside ${cluster.label} (~${roundPx(cluster.price, entry)}) with a ${LIQ_STOP_BUFFER_PCT}% buffer past the trap.`,
    };
  } else {
    const stop = roundPx(traderType === "long" ? entry - riskProxy : entry + riskProxy, entry);
    suggestedStop = {
      price: stop,
      distancePctFromEntry: Math.abs(pctFrom(entry, stop)),
      basis: "structural_proxy",
      reason: "No clear adverse pocket on the map — use ~0.3–0.4% structural proxy from your entry.",
    };
  }

  let suggestedEntry: SuggestedEntry | null = null;

  if (cluster) {
    const clearanceTarget =
      traderType === "long"
        ? cluster.price * (1 + LIQ_ENTRY_CLEARANCE_PCT / 100)
        : cluster.price * (1 - LIQ_ENTRY_CLEARANCE_PCT / 100);

    const clearanceNow =
      traderType === "long"
        ? pctFrom(cluster.price, entry) // positive = entry above pocket
        : pctFrom(entry, cluster.price);

    const pocketThreat = clearanceNow < LIQ_ENTRY_CLEARANCE_PCT;
    const biasSuggestsWait =
      (traderType === "long" && (bias === "short" || trend === "down")) ||
      (traderType === "short" && (bias === "long" || trend === "up"));
    const markSuggestsProbe =
      (traderType === "long" && markPrice < entry * 0.999) ||
      (traderType === "short" && markPrice > entry * 1.001);

    const wantBetter = pocketThreat || biasSuggestsWait || markSuggestsProbe;

    if (wantBetter) {
      let candidate = clearanceTarget;
      // Cap move vs current entry
      if (traderType === "long") {
        const floor = entry * (1 - MAX_ENTRY_IMPROVE_PCT / 100);
        candidate = Math.max(candidate, floor);
        // Must improve (lower) and stay below exit / above pocket
        const improves = pctFrom(candidate, entry) >= MIN_ENTRY_IMPROVE_PCT;
        const valid = candidate < exit && candidate > cluster.price && improves;
        if (valid) {
          candidate = roundPx(candidate, entry);
          suggestedEntry = {
            price: candidate,
            distancePctFromCurrent: pctFrom(entry, candidate),
            reason: pocketThreat
              ? `Wait for a dip toward the long-liq pocket, then enter with ~${LIQ_ENTRY_CLEARANCE_PCT}% clearance above it (your entry hugs the trap).`
              : biasSuggestsWait
                ? `Liquidity/trend leans against your long — a lower entry near the pocket improves location if you still want the long.`
                : `Mark is already below your entry — a pullback fill near the pocket is a better location than chasing.`,
          };
        }
      } else {
        const ceiling = entry * (1 + MAX_ENTRY_IMPROVE_PCT / 100);
        candidate = Math.min(candidate, ceiling);
        const improves = pctFrom(entry, candidate) >= MIN_ENTRY_IMPROVE_PCT;
        const validShort = candidate > exit && candidate < cluster.price && improves;
        if (validShort) {
          candidate = roundPx(candidate, entry);
          suggestedEntry = {
            price: candidate,
            distancePctFromCurrent: pctFrom(entry, candidate),
            reason: pocketThreat
              ? `Wait for a squeeze toward the short-liq pocket, then enter with ~${LIQ_ENTRY_CLEARANCE_PCT}% clearance below it.`
              : biasSuggestsWait
                ? `Liquidity/trend leans against your short — a higher entry near the pocket improves location if you still want the short.`
                : `Mark is already above your entry — a bounce into the pocket is a better short location than chasing lower.`,
          };
        }
      }
    }
  }

  const planEntry = suggestedEntry?.price ?? entry;
  const riskAbs = Math.abs(planEntry - suggestedStop.price);
  const rewardAbs = traderType === "long" ? exit - planEntry : planEntry - exit;
  const planRrMultiple =
    riskAbs > 1e-12 && rewardAbs > 0 ? Math.round((rewardAbs / riskAbs) * 100) / 100 : null;

  const keepYourEntry = suggestedEntry == null;
  const summary = keepYourEntry
    ? `Keep entry ${roundPx(entry, entry)}; use suggested stop ${suggestedStop.price}${
        planRrMultiple != null ? ` (≈${planRrMultiple.toFixed(2)}× R vs your exit)` : ""
      }.`
    : `Prefer entry ${suggestedEntry!.price} (vs your ${roundPx(entry, entry)}) with stop ${suggestedStop.price}${
        planRrMultiple != null ? ` (≈${planRrMultiple.toFixed(2)}× R vs your exit)` : ""
      }.`;

  return {
    suggestedStop,
    suggestedEntry,
    keepYourEntry,
    planRrMultiple,
    summary,
  };
}
