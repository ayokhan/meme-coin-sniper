import type { NovaRadarTfRow } from "@/lib/nova-radar";

export type UnifiedMarketRead = {
  direction: "bullish" | "bearish" | "sideways";
  headline: string;
  bullets: string[];
  nearestSupport: number | null;
  nearestResistance: number | null;
};

export function buildUnifiedMarketRead(
  tfRows: NovaRadarTfRow[],
  currentPrice: number,
  trendlineSummary: string
): UnifiedMarketRead {
  let score = 0;
  for (const r of tfRows) {
    if (r.direction === "bullish") score += 1;
    if (r.direction === "bearish") score -= 1;
  }
  const direction: UnifiedMarketRead["direction"] =
    score > 0 ? "bullish" : score < 0 ? "bearish" : "sideways";

  const supports = tfRows.map((r) => r.support).filter((s) => s > 0 && s < currentPrice);
  const resistances = tfRows.map((r) => r.resistance).filter((r) => r > currentPrice);
  const nearestSupport = supports.length > 0 ? Math.max(...supports) : null;
  const nearestResistance = resistances.length > 0 ? Math.min(...resistances) : null;

  const bullets: string[] = [];
  bullets.push(
    direction === "bearish"
      ? "Sampled timeframes skew bearish—dips toward lower limits are more intuitive than sustained rallies."
      : direction === "bullish"
        ? "Sampled timeframes skew bullish—pullbacks to buy limits may be shallower or shorter-lived."
        : "Structure is mixed—treat limit timing as uncertain until a clear bias emerges."
  );
  if (nearestSupport != null) {
    bullets.push(`Nearest structure support (below spot): ~$${nearestSupport.toFixed(2)}.`);
  }
  if (nearestResistance != null) {
    bullets.push(`Nearest structure resistance (above spot): ~$${nearestResistance.toFixed(2)}.`);
  }
  if (trendlineSummary) bullets.push(trendlineSummary);

  const headline =
    direction === "bearish"
      ? "Bearish read — favor deeper limits or smaller size on shallow entries."
      : direction === "bullish"
        ? "Bullish read — limits below spot are pullback buys; watch resistance overhead."
        : "Neutral read — compare both limits on fill odds and leverage stress.";

  return {
    direction,
    headline,
    bullets,
    nearestSupport,
    nearestResistance,
  };
}
