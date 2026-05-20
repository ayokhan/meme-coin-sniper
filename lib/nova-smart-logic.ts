/** Shared NovaSmart derivation (used by crypto and forex routes). */

export function deriveStrategy(
  tfData: { id: string; high: number; low: number; direction: "bullish" | "bearish" | "sideways" }[],
  currentPrice: number | null
): { strategy: "scalp" | "swing" | "mixed"; note: string } {
  if (tfData.length === 0) return { strategy: "swing", note: "Insufficient data." };
  const ranges = tfData.map((t) => ({ id: t.id, range: t.high - t.low }));
  const minRange = Math.min(...ranges.map((r) => r.range));
  const maxRange = Math.max(...ranges.map((r) => r.range));
  const allHighs = tfData.map((t) => t.high);
  const allLows = tfData.map((t) => t.low);
  const smartHigh = Math.max(...allHighs);
  const smartLow = Math.min(...allLows);
  const fullRange = smartHigh - smartLow;
  if (fullRange <= 0) return { strategy: "swing", note: "Range too small." };

  const ratio = maxRange > 0 ? minRange / maxRange : 0;
  let strategy: "scalp" | "swing" | "mixed" = "swing";
  let note = "";

  if (ratio < 0.2) {
    strategy = "scalp";
    note = "Short timeframes show tight range vs longer TFs—consider quick scalps.";
  } else if (ratio > 0.6) {
    strategy = "swing";
    note = "Timeframes aligned—consider swinging for a larger move.";
  } else {
    strategy = "mixed";
    note = "Mix of timeframes—scalp on pullbacks or swing at smart entry.";
  }

  if (currentPrice != null) {
    if (currentPrice >= smartHigh * 0.99) note += " Price near smart short zone.";
    else if (currentPrice <= smartLow * 1.01) note += " Price near smart long zone.";
    else if (currentPrice > (smartHigh + smartLow) / 2) note += " Above range mid—bias short.";
    else note += " Below range mid—bias long.";
  }
  const bulls = tfData.filter((t) => t.direction === "bullish").length;
  const bears = tfData.filter((t) => t.direction === "bearish").length;
  if (bulls > bears) note += ` Blended tilts bullish (${bulls}/${tfData.length}).`;
  else if (bears > bulls) note += ` Blended tilts bearish (${bears}/${tfData.length}).`;
  else note += " Blended direction is mixed.";

  return { strategy, note };
}

function applyTrendlineFilter(
  base: { direction: "long" | "short" | "neutral"; recommendationNote: string },
  tfData: { direction: "bullish" | "bearish" | "sideways" }[]
): { direction: "long" | "short" | "neutral"; recommendationNote: string } {
  if (!tfData.length || base.direction === "neutral") return base;
  const bulls = tfData.filter((t) => t.direction === "bullish").length;
  const bears = tfData.filter((t) => t.direction === "bearish").length;
  if (base.direction === "long" && bears > bulls) {
    return {
      direction: "neutral",
      recommendationNote: `${base.recommendationNote} Structure leans bearish—reduced confidence until confirmation.`,
    };
  }
  if (base.direction === "short" && bulls > bears) {
    return {
      direction: "neutral",
      recommendationNote: `${base.recommendationNote} Structure leans bullish—reduced confidence until confirmation.`,
    };
  }
  return base;
}

export function getRecommendedDirection(
  smartHigh: number,
  smartLow: number,
  currentPrice: number | null,
  tfData: { direction: "bullish" | "bearish" | "sideways" }[]
): { direction: "long" | "short" | "neutral"; recommendationNote: string } {
  if (currentPrice == null || smartHigh <= smartLow) {
    return { direction: "neutral", recommendationNote: "No price data—enter when price reaches a smart level." };
  }
  const mid = (smartHigh + smartLow) / 2;
  const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  if (currentPrice >= smartHigh * 0.995) {
    return applyTrendlineFilter(
      { direction: "short", recommendationNote: `Best entry: Short near $${fmt(smartHigh)}.` },
      tfData
    );
  }
  if (currentPrice <= smartLow * 1.005) {
    return applyTrendlineFilter(
      { direction: "long", recommendationNote: `Best entry: Long near $${fmt(smartLow)}.` },
      tfData
    );
  }
  if (currentPrice > mid * 1.005) {
    return applyTrendlineFilter(
      {
        direction: "short",
        recommendationNote: `Bias short on rally to $${fmt(smartHigh)}; long on dip to $${fmt(smartLow)}.`,
      },
      tfData
    );
  }
  if (currentPrice < mid * 0.995) {
    return applyTrendlineFilter(
      {
        direction: "long",
        recommendationNote: `Bias long on pullback to $${fmt(smartLow)}; short on rally to $${fmt(smartHigh)}.`,
      },
      tfData
    );
  }
  return applyTrendlineFilter(
    {
      direction: "neutral",
      recommendationNote: `Neutral near mid—wait for $${fmt(smartLow)} (long) or $${fmt(smartHigh)} (short).`,
    },
    tfData
  );
}

export function suggestEntryExit(
  smartShort: number,
  smartLong: number,
  _currentPrice: number | null,
  strategy: "scalp" | "swing" | "mixed"
) {
  const scalpPct = 0.005;
  const longEntry = smartLong;
  const shortEntry = smartShort;
  let longExit: number;
  let shortExit: number;
  if (strategy === "scalp") {
    longExit = longEntry * (1 + scalpPct);
    shortExit = shortEntry * (1 - scalpPct);
  } else if (strategy === "swing") {
    longExit = smartShort;
    shortExit = smartLong;
  } else {
    longExit = Math.min(smartShort, longEntry * 1.015);
    shortExit = Math.max(smartLong, shortEntry * 0.985);
  }
  const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 4, minimumFractionDigits: 2 });
  return {
    suggestedLongEntry: longEntry,
    suggestedLongExit: longExit,
    suggestedShortEntry: shortEntry,
    suggestedShortExit: shortExit,
    entryExitNote: `Long: $${fmt(longEntry)} → $${fmt(longExit)}. Short: $${fmt(shortEntry)} → $${fmt(shortExit)}.`,
  };
}

export function suggestTrendlineEntry(
  smartShort: number,
  smartLong: number,
  currentPrice: number | null,
  tfData: Array<{ id: string; direction: "bullish" | "bearish" | "sideways"; trendlineBias: "up" | "down" | "flat" }>
) {
  const bulls = tfData.filter((t) => t.direction === "bullish").length;
  const bears = tfData.filter((t) => t.direction === "bearish").length;
  const nonSide = bulls + bears;
  const lead = Math.max(bulls, bears);
  const trendlineConfidence: "high" | "medium" | "low" =
    nonSide >= 3 && lead / Math.max(nonSide, 1) >= 0.75
      ? "high"
      : nonSide >= 2 && lead / Math.max(nonSide, 1) >= 0.6
        ? "medium"
        : "low";
  const trendlineConfidenceNote = `${bulls} bullish / ${bears} bearish across ${tfData.length} frames.`;
  const lean = bulls > bears ? "bullish" : bears > bulls ? "bearish" : "mixed";
  const anchor = currentPrice != null && currentPrice > 0 ? currentPrice : (smartShort + smartLong) / 2;
  if (lean === "bullish") {
    return {
      trendlineEntryLong: Math.max(smartLong, anchor * 0.9965),
      trendlineEntryShort: smartShort,
      trendlineEntryNote: "Trendline bias: prefer long pullbacks.",
      trendlineConfidence,
      trendlineConfidenceNote,
    };
  }
  if (lean === "bearish") {
    return {
      trendlineEntryLong: smartLong,
      trendlineEntryShort: Math.min(smartShort, anchor * 1.0035),
      trendlineEntryNote: "Trendline bias: prefer short rallies.",
      trendlineConfidence,
      trendlineConfidenceNote,
    };
  }
  return {
    trendlineEntryLong: null,
    trendlineEntryShort: null,
    trendlineEntryNote: "Mixed structure—wait for clearer break.",
    trendlineConfidence,
    trendlineConfidenceNote,
  };
}
