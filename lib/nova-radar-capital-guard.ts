import {
  nearestStructureStressPrice,
  type NovaRadarTfRow,
} from "@/lib/nova-radar";
import { roePct, spotMovePctFromEntry } from "@/lib/nova-radar-leverage";

/** User-selected capital-at-risk tolerance (how much of margin they accept losing at SL). */
export type NovaRadarCapitalRiskTolerance = "low" | "medium" | "high" | "extreme_high";

export const CAPITAL_GUARD_LABELS: Record<NovaRadarCapitalRiskTolerance, string> = {
  low: "Low risk",
  medium: "Medium",
  high: "High risk",
  extreme_high: "Extreme high",
};

/** Max loss as % of investment (margin) at stop — still capped; not “no stop”. */
export const CAPITAL_GUARD_MAX_LOSS_PCT: Record<NovaRadarCapitalRiskTolerance, number> = {
  low: 2,
  medium: 5,
  high: 10,
  extreme_high: 20,
};

export type NovaRadarCapitalGuardInput = {
  riskTolerance: NovaRadarCapitalRiskTolerance;
  investmentAmountUsdt: number;
  leverage: number;
  entryPrice: number;
  side: "long" | "short";
  structureRows?: NovaRadarTfRow[];
  /** User-entered SL — if tighter than guard SL, we note it. */
  userStopLossPrice?: number | null;
  /** Live Blofin position context (open-position mode). */
  openPosition?: NovaRadarCapitalGuard["openPosition"];
};

export type NovaRadarFlipSuggestion = {
  oppositeSide: "long" | "short";
  headline: string;
  note: string;
  triggerCondition: string;
};

export type NovaRadarCapitalGuard = {
  featureName: "Nova Capital Guard";
  riskTolerance: NovaRadarCapitalRiskTolerance;
  riskToleranceLabel: string;
  investmentAmountUsdt: number;
  maxLossPctOfInvestment: number;
  maxLossAmountUsdt: number;
  recommendedStopLossPrice: number;
  structureStopLossPrice: number | null;
  /** SL Nova recommends placing (respects capital cap; may tighten to structure). */
  finalStopLossPrice: number;
  spotMoveToSlPct: number;
  roeAtSlPct: number;
  lossAtSlUsdt: number;
  lossAtSlPctOfInvestment: number;
  usesStructureTightening: boolean;
  flipSuggestion: NovaRadarFlipSuggestion | null;
  notes: string[];
  /** Set when guard runs against a live Blofin position. */
  openPosition?: {
    instId: string;
    symbol: string;
    side: "long" | "short";
    entryPrice: number;
    markPrice: number | null;
    leverage: number | null;
    liquidationPrice: number | null;
    marginUsdt: number | null;
    hasExchangeStopLoss: boolean;
    exchangeStopLossPrice: number | null;
    missingStopAlert: boolean;
  };
};

export function parseCapitalRiskTolerance(raw: unknown): NovaRadarCapitalRiskTolerance | null {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (!s) return null;
  if (s === "low") return "low";
  if (s === "medium" || s === "med") return "medium";
  if (s === "high" || s === "high_risk") return "high";
  if (s === "extreme_high" || s === "extreme" || s === "extreme_high_risk") return "extreme_high";
  return null;
}

export function parseInvestmentAmountUsdt(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
  const s = String(raw ?? "")
    .replace(/[$,\s]/g, "")
    .trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function slPriceFromMaxRoe(
  entry: number,
  side: "long" | "short",
  leverage: number,
  maxLossRoePct: number
): number {
  const spotMove = maxLossRoePct / leverage;
  if (side === "long") {
    return entry * (1 + spotMove / 100);
  }
  return entry * (1 - spotMove / 100);
}

function isTighterSl(
  candidate: number,
  reference: number,
  side: "long" | "short"
): boolean {
  if (side === "long") return candidate > reference;
  return candidate < reference;
}

function fmtMoney(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 4, minimumFractionDigits: 2 });
}

/**
 * Nova Capital Guard — defined-risk stop placement from investment + risk tolerance.
 * Caps max loss at SL; optionally tightens to structure; suggests flip-ready opposite side.
 */
export function computeNovaRadarCapitalGuard(input: NovaRadarCapitalGuardInput): NovaRadarCapitalGuard | null {
  const { riskTolerance, investmentAmountUsdt, leverage, entryPrice, side } = input;
  if (investmentAmountUsdt <= 0 || entryPrice <= 0 || leverage < 1) return null;

  const maxLossPct = CAPITAL_GUARD_MAX_LOSS_PCT[riskTolerance];
  const maxLossAmountUsdt = (investmentAmountUsdt * maxLossPct) / 100;
  const maxLossRoePct = -maxLossPct;

  const riskBasedSl = slPriceFromMaxRoe(entryPrice, side, leverage, maxLossRoePct);

  const structureSl =
    input.structureRows && input.structureRows.length > 0
      ? nearestStructureStressPrice(entryPrice, side, input.structureRows)
      : null;

  let finalSl = riskBasedSl;
  let usesStructureTightening = false;

  if (structureSl != null && Number.isFinite(structureSl) && structureSl > 0) {
    const structureRoe = roePct(spotMovePctFromEntry(entryPrice, structureSl, side), leverage);
    const structureLossPct = Math.abs(structureRoe);

    if (isTighterSl(structureSl, riskBasedSl, side) && structureLossPct <= maxLossPct * 1.05) {
      finalSl = structureSl;
      usesStructureTightening = true;
    } else if (!isTighterSl(structureSl, riskBasedSl, side) && structureLossPct > maxLossPct) {
      /* Structure is wider than risk budget — keep risk-based SL to protect capital */
    }
  }

  if (input.userStopLossPrice != null && input.userStopLossPrice > 0) {
    const userRoe = roePct(
      spotMovePctFromEntry(entryPrice, input.userStopLossPrice, side),
      leverage
    );
    if (Math.abs(userRoe) <= maxLossPct * 1.05 && isTighterSl(input.userStopLossPrice, finalSl, side)) {
      finalSl = input.userStopLossPrice;
      usesStructureTightening = false;
    }
  }

  const spotMoveToSlPct = spotMovePctFromEntry(entryPrice, finalSl, side);
  const roeAtSlPct = roePct(spotMoveToSlPct, leverage);
  const lossAtSlUsdt = (investmentAmountUsdt * Math.abs(roeAtSlPct)) / 100;
  const lossAtSlPctOfInvestment = (lossAtSlUsdt / investmentAmountUsdt) * 100;

  const notes: string[] = [];

  if (input.openPosition?.missingStopAlert) {
    notes.push(
      "⚠ No stop loss detected on Blofin for this position — Capital Guard recommends placing a stop on-exchange before the next dip (do not rely on hope or margin adds)."
    );
  } else if (input.openPosition?.hasExchangeStopLoss && input.openPosition.exchangeStopLossPrice != null) {
    notes.push(
      `Blofin SL already set @ $${fmtMoney(input.openPosition.exchangeStopLossPrice)} — compare with Capital Guard recommendation below.`
    );
  }

  notes.push(
    `Nova Capital Guard (${CAPITAL_GUARD_LABELS[riskTolerance]}): cap loss at ~${maxLossPct}% of $${fmtMoney(investmentAmountUsdt)} margin (≈ $${fmtMoney(maxLossAmountUsdt)} max).`
  );
  notes.push(
    `Recommended SL @ $${fmtMoney(finalSl)} — ~${Math.abs(spotMoveToSlPct).toFixed(3)}% price move, ~${roeAtSlPct.toFixed(1)}% ROE at ${leverage}×.`
  );
  notes.push(
    `If SL hits: ~$${fmtMoney(lossAtSlUsdt)} loss (${lossAtSlPctOfInvestment.toFixed(1)}% of your investment margin).`
  );

  if (usesStructureTightening && structureSl != null) {
    notes.push(
      `Tightened to nearest structure level ($${fmtMoney(structureSl)}) while staying within your ${maxLossPct}% risk budget.`
    );
  } else if (structureSl != null) {
    const structRoe = roePct(spotMovePctFromEntry(entryPrice, structureSl, side), leverage);
    if (Math.abs(structRoe) > maxLossPct) {
      notes.push(
        `Structure stress at $${fmtMoney(structureSl)} would exceed your risk cap — using Capital Guard SL instead of structure alone.`
      );
    }
  }

  if (riskTolerance === "extreme_high") {
    notes.push(
      "Extreme high still uses a defined stop — without SL, dips can force margin adds or liquidation. Place the stop on-exchange before entry."
    );
  }

  const oppositeSide: "long" | "short" = side === "long" ? "short" : "long";
  const flipSuggestion: NovaRadarFlipSuggestion = {
    oppositeSide,
    headline: "Flip-Ready play (after stop)",
    triggerCondition: `If SL @ $${fmtMoney(finalSl)} triggers on your ${side}, thesis is invalidated`,
    note:
      side === "long"
        ? `After a long stop-out, consider a defined-risk ${oppositeSide} if lower timeframes flip bearish — same Capital Guard rules, new direction. You cannot win every trade, but a stop gives a clear signal to flip instead of averaging down.`
        : `After a short stop-out, consider a defined-risk ${oppositeSide} if structure reclaims bullish — same Capital Guard rules. Stop = exit + optional reverse setup, not hope.`,
  };

  notes.push(flipSuggestion.note);

  return {
    featureName: "Nova Capital Guard",
    riskTolerance,
    riskToleranceLabel: CAPITAL_GUARD_LABELS[riskTolerance],
    investmentAmountUsdt,
    maxLossPctOfInvestment: maxLossPct,
    maxLossAmountUsdt,
    recommendedStopLossPrice: riskBasedSl,
    structureStopLossPrice: structureSl,
    finalStopLossPrice: finalSl,
    spotMoveToSlPct,
    roeAtSlPct,
    lossAtSlUsdt,
    lossAtSlPctOfInvestment,
    usesStructureTightening,
    flipSuggestion,
    notes,
    ...(input.openPosition ? { openPosition: input.openPosition } : {}),
  };
}
