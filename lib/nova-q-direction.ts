/**
 * NovaQ / structure desk: HTF-weighted direction vote + LTF/HTF conflict → wait.
 */
import { NOVA_UI_TIMEFRAME_IDS } from "@/lib/nova-timeframes";

export type StructureDir = "bullish" | "bearish" | "sideways";

export type WeightedDirectionRow = {
  id: string;
  label?: string;
  direction: StructureDir;
};

export type WeightedMarketDirectionResult = {
  direction: StructureDir;
  /** Signed weighted score (bullish positive). */
  score: number;
  /** True when short vs long TFs in the set disagree — do not trade the raw short label. */
  hasConflict: boolean;
  /** Human-readable vote + conflict note for UI. */
  summary: string;
  /** Compact per-TF line e.g. "15m bearish · 1h sideways · 4h bullish". */
  breakdown: string;
};

/** Higher timeframes weigh more so 15m cannot cancel 1w 1:1. */
export function timeframeDirectionWeight(tfId: string): number {
  const id = tfId.trim().toLowerCase();
  const table: Record<string, number> = {
    "1m": 0.35,
    "5m": 0.5,
    "15m": 0.75,
    "30m": 0.9,
    "1h": 1.15,
    "2h": 1.35,
    "4h": 1.75,
    "6h": 2,
    "10h": 2.1,
    "12h": 2.25,
    "24h": 2.5,
    "48h": 2.75,
    "72h": 2.9,
    "1w": 3.25,
    "2w": 3.5,
    "3w": 3.6,
    "4w": 3.75,
    "5w": 3.85,
    "6w": 3.9,
    "52w": 4.25,
    "104w": 4.5,
  };
  if (table[id] != null) return table[id]!;
  const idx = NOVA_UI_TIMEFRAME_IDS.indexOf(id);
  if (idx < 0) return 1;
  // Unknown id: scale gently by position in the shared ladder
  return 0.5 + (idx / Math.max(NOVA_UI_TIMEFRAME_IDS.length - 1, 1)) * 3.5;
}

function tfSortIndex(id: string): number {
  const i = NOVA_UI_TIMEFRAME_IDS.indexOf(id);
  return i >= 0 ? i : 999;
}

function labelFor(row: WeightedDirectionRow): string {
  return (row.label ?? row.id).trim() || row.id;
}

/**
 * Weighted vote across selected frames.
 * If the shortest directional TF fights the longest directional TF → force sideways (wait).
 */
export function computeWeightedMarketDirection(
  rows: WeightedDirectionRow[]
): WeightedMarketDirectionResult {
  if (rows.length === 0) {
    return {
      direction: "sideways",
      score: 0,
      hasConflict: false,
      summary: "No timeframe rows — wait.",
      breakdown: "",
    };
  }

  const sorted = [...rows].sort((a, b) => tfSortIndex(a.id) - tfSortIndex(b.id));
  const breakdown = sorted
    .map((r) => `${labelFor(r)} ${r.direction}`)
    .join(" · ");

  let score = 0;
  let weightBull = 0;
  let weightBear = 0;
  for (const r of sorted) {
    const w = timeframeDirectionWeight(r.id);
    if (r.direction === "bullish") {
      score += w;
      weightBull += w;
    } else if (r.direction === "bearish") {
      score -= w;
      weightBear += w;
    }
  }

  const directional = sorted.filter((r) => r.direction === "bullish" || r.direction === "bearish");
  const shortest = directional[0];
  const longest = directional[directional.length - 1];
  const ltfHtfFight =
    directional.length >= 2 &&
    shortest != null &&
    longest != null &&
    shortest.id !== longest.id &&
    ((shortest.direction === "bullish" && longest.direction === "bearish") ||
      (shortest.direction === "bearish" && longest.direction === "bullish"));

  const bothSides = weightBull > 0 && weightBear > 0;
  const hasConflict = ltfHtfFight || bothSides;

  let direction: StructureDir =
    score > 0.15 ? "bullish" : score < -0.15 ? "bearish" : "sideways";

  // Hard wait when short TF fights long TF — classic trap (e.g. 15m bearish, 1w bullish).
  if (ltfHtfFight) {
    direction = "sideways";
  }

  const parts: string[] = [];
  if (ltfHtfFight && shortest && longest) {
    parts.push(
      `Wait: ${labelFor(shortest)} is ${shortest.direction} while ${labelFor(longest)} is ${longest.direction} — do not treat the short frame as a standalone sell/buy.`
    );
  } else if (bothSides && !ltfHtfFight) {
    parts.push(
      `Mixed weighted vote (${weightBull.toFixed(1)} bull / ${weightBear.toFixed(1)} bear) — prefer confirmation before size.`
    );
  }

  if (direction === "bullish") {
    parts.push(`HTF-weighted read leans bullish (score ${score.toFixed(2)}).`);
  } else if (direction === "bearish") {
    parts.push(`HTF-weighted read leans bearish (score ${score.toFixed(2)}).`);
  } else if (!ltfHtfFight) {
    parts.push(`HTF-weighted read is neutral/sideways (score ${score.toFixed(2)}).`);
  }

  return {
    direction,
    score,
    hasConflict,
    summary: parts.join(" "),
    breakdown,
  };
}

/** Simple wrapper for callers that only need the Dir3. */
export function getWeightedOverallDirection(rows: WeightedDirectionRow[]): StructureDir {
  return computeWeightedMarketDirection(rows).direction;
}
