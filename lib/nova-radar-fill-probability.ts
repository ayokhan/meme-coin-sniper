/**
 * Illustrative limit-fill probability from spot vs recent daily range (not a guarantee).
 */

export type NovaRadarFillProbability = {
  probabilityPct: number;
  label: "very likely" | "likely" | "possible" | "unlikely" | "at level";
  note: string;
};

export function estimateLimitFillProbability(params: {
  currentPrice: number;
  targetPrice: number;
  side: "long" | "short";
  avgDailyRangeUsd: number | null;
  pessimisticDays: number | null;
  pricePath: "up" | "down" | "at_target";
  structureAlignment: "aligned" | "mixed" | "against_trend";
}): NovaRadarFillProbability | null {
  const { currentPrice, targetPrice, pricePath, avgDailyRangeUsd, pessimisticDays, structureAlignment } =
    params;
  if (currentPrice <= 0 || targetPrice <= 0) return null;

  if (pricePath === "at_target") {
    return {
      probabilityPct: 88,
      label: "at level",
      note: "Limit is near spot—fill depends on liquidity when price trades there.",
    };
  }

  const distanceUsd = Math.abs(targetPrice - currentPrice);
  const distancePct = (distanceUsd / currentPrice) * 100;
  const rangeUsd = Math.max(avgDailyRangeUsd ?? currentPrice * 0.008, currentPrice * 0.004);
  const rangePct = (rangeUsd / currentPrice) * 100;

  let base = 72;
  const ratio = distancePct / Math.max(rangePct, 0.1);
  if (ratio <= 0.35) base = 78;
  else if (ratio <= 0.65) base = 62;
  else if (ratio <= 1) base = 48;
  else if (ratio <= 1.5) base = 32;
  else if (ratio <= 2.2) base = 20;
  else base = 12;

  if (structureAlignment === "aligned") base += 8;
  else if (structureAlignment === "against_trend") base -= 14;
  else base -= 4;

  if (pessimisticDays != null) {
    if (pessimisticDays <= 1) base += 6;
    else if (pessimisticDays >= 5) base -= 8;
  }

  const probabilityPct = Math.max(8, Math.min(85, Math.round(base)));

  let label: NovaRadarFillProbability["label"] = "possible";
  if (probabilityPct >= 65) label = "likely";
  else if (probabilityPct >= 45) label = "possible";
  else label = "unlikely";
  if (probabilityPct >= 75) label = "very likely";

  const note =
    `Illustrative ~${probabilityPct}% chance spot trades your limit within the ETA band (distance ${distancePct.toFixed(2)}% vs ~${rangePct.toFixed(2)}% typical daily range)—not a guarantee.`;

  return { probabilityPct, label, note };
}
