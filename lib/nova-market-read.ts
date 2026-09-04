import { computeWeightedMarketDirection } from "@/lib/nova-q-direction";

export type StructureLevelRow = {
  support: number;
  resistance: number;
  direction: "bullish" | "bearish" | "sideways";
  id?: string;
  label?: string;
};

export type UnifiedMarketRead = {
  direction: "bullish" | "bearish" | "sideways";
  headline: string;
  bullets: string[];
  nearestSupport: number | null;
  nearestResistance: number | null;
};

export function buildUnifiedMarketRead(
  tfRows: StructureLevelRow[],
  currentPrice: number,
  trendlineSummary: string
): UnifiedMarketRead {
  const weighted = computeWeightedMarketDirection(
    tfRows.map((r, i) => ({
      id: r.id ?? `tf-${i}`,
      label: r.label,
      direction: r.direction,
    }))
  );
  const direction = weighted.direction;

  const supports = tfRows.map((r) => r.support).filter((s) => s > 0 && s < currentPrice);
  const resistances = tfRows.map((r) => r.resistance).filter((r) => r > currentPrice);
  const nearestSupport = supports.length > 0 ? Math.max(...supports) : null;
  const nearestResistance = resistances.length > 0 ? Math.min(...resistances) : null;

  const bullets: string[] = [];
  if (weighted.breakdown) {
    bullets.push(`Frames: ${weighted.breakdown}.`);
  }
  if (weighted.hasConflict) {
    bullets.push(weighted.summary);
  } else {
    bullets.push(
      direction === "bearish"
        ? "HTF-weighted structure skews bearish—dips toward lower limits are more intuitive than chasing shorts into a squeeze."
        : direction === "bullish"
          ? "HTF-weighted structure skews bullish—pullbacks to buy limits may be shallower or shorter-lived."
          : "Structure is mixed/neutral—treat timing as uncertain until frames align."
    );
  }
  if (nearestSupport != null) {
    bullets.push(`Nearest structure support (below spot): ~$${nearestSupport.toFixed(2)}.`);
  }
  if (nearestResistance != null) {
    bullets.push(`Nearest structure resistance (above spot): ~$${nearestResistance.toFixed(2)}.`);
  }
  if (trendlineSummary) bullets.push(trendlineSummary);

  const headline = weighted.hasConflict
    ? "Wait — timeframe conflict. Do not size a directional trade on the short frame alone."
    : direction === "bearish"
      ? "Bearish weighted read — favor deeper limits or smaller size on shallow entries."
      : direction === "bullish"
        ? "Bullish weighted read — limits below spot are pullback buys; watch resistance overhead."
        : "Neutral read — compare both limits on fill odds and leverage stress.";

  return {
    direction,
    headline,
    bullets,
    nearestSupport,
    nearestResistance,
  };
}
