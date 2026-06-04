import type { NovaRadarPlanResult } from "@/lib/nova-radar";
import { roePct, spotMovePctFromEntry } from "@/lib/nova-radar-leverage";

export type NovaRadarSplitSuggestion = {
  deepPct: number;
  shallowPct: number;
  deepPlanId: string;
  shallowPlanId: string;
  blendedEntry: number;
  note: string;
  roeAtTpPct: number | null;
  roeAtStressPct: number | null;
};

/** Suggest split between two same-side limits (deeper = larger allocation default). */
export function buildSplitOrderSuggestion(
  plans: NovaRadarPlanResult[],
  takeProfitPrice: number | null,
  leverage: number | null,
  deepPct = 70
): NovaRadarSplitSuggestion | null {
  if (plans.length < 2 || leverage == null || leverage < 1) return null;
  const [a, b] = plans;
  if (a.side !== b.side || a.symbol.toUpperCase() !== b.symbol.toUpperCase()) return null;

  const deep = a.targetPrice < b.targetPrice && a.side === "long" ? a : b;
  const shallow = deep.planId === a.planId ? b : a;
  if (a.side === "short") {
    const deepShort = a.targetPrice > b.targetPrice ? a : b;
    const shallowShort = deepShort.planId === a.planId ? b : a;
    return buildSplitForPair(deepShort, shallowShort, takeProfitPrice, leverage, deepPct);
  }

  return buildSplitForPair(deep, shallow, takeProfitPrice, leverage, deepPct);
}

function buildSplitForPair(
  deep: NovaRadarPlanResult,
  shallow: NovaRadarPlanResult,
  takeProfitPrice: number | null,
  leverage: number,
  deepPct: number
): NovaRadarSplitSuggestion {
  const shallowPct = 100 - deepPct;
  const blendedEntry =
    (deep.targetPrice * deepPct + shallow.targetPrice * shallowPct) / 100;

  let roeAtTpPct: number | null = null;
  let roeAtStressPct: number | null = null;
  if (takeProfitPrice != null) {
    roeAtTpPct = roePct(spotMovePctFromEntry(blendedEntry, takeProfitPrice, deep.side), leverage);
  }
  const stressDeep = deep.leverage?.stressPrice ?? deep.targetPrice;
  const stressShallow = shallow.leverage?.roeAtStressPct ?? null;
  const stressDeepRoe = deep.leverage?.roeAtStressPct ?? null;
  if (stressDeepRoe != null && stressShallow != null) {
    roeAtStressPct = (stressDeepRoe * deepPct + stressShallow * shallowPct) / 100;
  } else if (stressDeepRoe != null) {
    roeAtStressPct = (stressDeepRoe * deepPct) / 100;
  }

  const note = `Example split: ${deepPct}% at ${deep.planLabel} ($${deep.targetPrice.toLocaleString()}) + ${shallowPct}% at ${shallow.planLabel} ($${shallow.targetPrice.toLocaleString()}) → blended entry ~$${blendedEntry.toFixed(2)}. Reduces "miss the dip" risk while keeping most size on the better R:R level.`;

  return {
    deepPct,
    shallowPct,
    deepPlanId: deep.planId,
    shallowPlanId: shallow.planId,
    blendedEntry,
    note,
    roeAtTpPct,
    roeAtStressPct,
  };
}
