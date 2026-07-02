import type { NovaScalpAnalysis } from "@/lib/nova-scalp-agent";
import { resolveScalpSymbol } from "@/lib/nova-scalp-agent";
import type { PropFirmGuards } from "@/lib/prop-firm-bot";

export type PropFirmCombinedVerdict = "do_not_enter" | "wait" | "clear";

export type PropFirmSetupVerdict = {
  verdict: PropFirmCombinedVerdict;
  headline: string;
  detail: string;
};

export function propFirmSymbolToScalp(symbol: string): string {
  return resolveScalpSymbol(symbol);
}

/** Risk at recommended stop (USD loss on margin) for challenge check. */
export function riskAtStopFromSetup(setup: NovaScalpAnalysis): number {
  const risk =
    setup.lossAtRiskStopUsd != null && Number.isFinite(setup.lossAtRiskStopUsd)
      ? Math.abs(setup.lossAtRiskStopUsd)
      : setup.lossAtStopUsd != null && Number.isFinite(setup.lossAtStopUsd)
        ? Math.abs(setup.lossAtStopUsd)
        : 0;
  return Number(risk.toFixed(2));
}

export function combinePropFirmVerdict(
  guards: PropFirmGuards,
  setup: NovaScalpAnalysis | null,
  proposedRiskUsd: number
): PropFirmSetupVerdict {
  if (guards.entry.severity === "stop") {
    return {
      verdict: "do_not_enter",
      headline: "DO NOT ENTER",
      detail: guards.entry.detail,
    };
  }

  if (!setup) {
    return {
      verdict: "wait",
      headline: "ANALYZE SETUP FIRST",
      detail: "Run setup analysis on your primary market for entry, stop, and target before trading.",
    };
  }

  if (setup.side === "no_entry") {
    return {
      verdict: "wait",
      headline: "WAIT — NO A+ SETUP",
      detail: setup.rationale || "Structure does not support a clear entry on this timeframe.",
    };
  }

  const risk = proposedRiskUsd > 0 ? proposedRiskUsd : riskAtStopFromSetup(setup);

  if (risk > 0 && guards.entry.severity === "caution") {
    return {
      verdict: "wait",
      headline: "WAIT — RULE CAUTION",
      detail: `${guards.entry.detail} Setup: ${setup.side.toUpperCase()} ${setup.symbol}.`,
    };
  }

  if (setup.recommendedStopPrice == null || setup.entryPrice == null) {
    return {
      verdict: "wait",
      headline: "WAIT — INCOMPLETE PLAN",
      detail: "Setup missing entry or stop — wait for clearer structure.",
    };
  }

  const rr =
    setup.expectedPnlUsd != null && risk > 0 && setup.expectedPnlUsd > 0
      ? setup.expectedPnlUsd / risk
      : null;
  if (rr != null && rr < 1.2) {
    return {
      verdict: "wait",
      headline: "WAIT — LOW REWARD/RISK",
      detail: `Estimated R:R ~${rr.toFixed(1)}:1 — prefer ≥1.2:1 for challenge passes.`,
    };
  }

  return {
    verdict: "clear",
    headline: "CLEAR — PLAN THE TRADE",
    detail: `${setup.side.toUpperCase()} ${setup.symbol}: enter near ${setup.entryPrice}, stop ${setup.recommendedStopPrice}, target ${setup.exitPrice}. ${setup.rationale}`,
  };
}

export function verdictSeverityClass(verdict: PropFirmCombinedVerdict): string {
  if (verdict === "do_not_enter") {
    return "border-rose-500/80 bg-rose-950/40 text-rose-100";
  }
  if (verdict === "wait") {
    return "border-amber-500/80 bg-amber-950/40 text-amber-100";
  }
  return "border-emerald-500/80 bg-emerald-950/40 text-emerald-100";
}
