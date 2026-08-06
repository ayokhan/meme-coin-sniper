/**
 * Liquidation Map — Your trade check scoring (shared by API + client re-score).
 */

import {
  buildLiquidationMapSuggestedPlan,
  type LiqPlanCluster,
  type LiquidationMapSuggestedPlan,
} from "@/lib/liquidation-map-plan";

export type TradeCheckCluster = LiqPlanCluster & {
  intensity?: string;
  estimatedLiquidityUsd?: number;
  reason?: string;
};

export type LiquidationMapTradeCheck = {
  score: number;
  verdict: "good_trade" | "risky_trade" | "avoid_trade";
  directionFit: string;
  trendlineFit: string;
  structureFit: string;
  liquidationRisk: string;
  notes: string[];
  analyzed: {
    traderType: "long" | "short";
    entry: number;
    exit: number;
    leverage: number;
    estLiquidationPrice: number | null;
    estLiquidationDistancePct: number | null;
    liqSource: "exchange" | "estimated" | null;
    rrMultiple: number | null;
  };
  scoreBreakdown: Array<{
    id: string;
    label: string;
    earned: number;
    max: number;
    detail: string;
    suggestedFix: string | null;
  }>;
  suggestedPlan: LiquidationMapSuggestedPlan;
};

function pctChange(from: number, to: number): number {
  if (!Number.isFinite(from) || from === 0 || !Number.isFinite(to)) return 0;
  return ((to - from) / from) * 100;
}

function approxIsolatedLiquidationPrice(
  side: "long" | "short",
  entry: number,
  leverage: number
): { price: number; distancePct: number } | null {
  const lev = Number.isFinite(leverage) && leverage >= 1 ? leverage : 0;
  if (!(entry > 0) || lev < 1) return null;
  const moveFrac = Math.max(0.02, 0.95 / lev);
  const price = side === "long" ? entry * (1 - moveFrac) : entry * (1 + moveFrac);
  return { price, distancePct: Math.abs(pctChange(entry, price)) };
}

function resolveLiqPrice(input: {
  traderType: "long" | "short";
  entry: number;
  leverage: number;
  exchangeLiquidationPrice?: number | null;
}): {
  liq: { price: number; distancePct: number } | null;
  source: "exchange" | "estimated" | null;
} {
  const exch = input.exchangeLiquidationPrice;
  if (exch != null && Number.isFinite(exch) && exch > 0 && input.entry > 0) {
    // Sanity: long liq should be below entry; short above.
    const sideOk =
      (input.traderType === "long" && exch < input.entry) ||
      (input.traderType === "short" && exch > input.entry);
    if (sideOk) {
      return {
        liq: { price: exch, distancePct: Math.abs(pctChange(input.entry, exch)) },
        source: "exchange",
      };
    }
  }
  const est = approxIsolatedLiquidationPrice(input.traderType, input.entry, input.leverage);
  return { liq: est, source: est ? "estimated" : null };
}

function scoreRrPoints(rrMultiple: number, rrValid: boolean, maxPts: number): number {
  if (!rrValid) return 0;
  if (rrMultiple >= 2.5) return maxPts;
  if (rrMultiple >= 2) return Math.round(maxPts * 0.87);
  if (rrMultiple >= 1.5) return Math.round(maxPts * 0.73);
  if (rrMultiple >= 1) return Math.round(maxPts * 0.53);
  if (rrMultiple >= 0.5) return Math.round(maxPts * 0.27);
  return 2;
}

function scoreLiquidationPoints(input: {
  leverage: number;
  entry: number;
  traderType: "long" | "short";
  estLiq: { price: number; distancePct: number } | null;
  liqSource: "exchange" | "estimated" | null;
  nearestRiskCluster: { price: number; distancePct: number } | null;
  maxPts: number;
}): { pts: number; risk: "low" | "medium" | "high"; detail: string } {
  const { leverage, entry, traderType, estLiq, liqSource, nearestRiskCluster, maxPts } = input;
  const lev = Number.isFinite(leverage) && leverage >= 1 ? leverage : 10;
  const pocketDistPct = nearestRiskCluster
    ? Math.abs(pctChange(entry, nearestRiskCluster.price))
    : 99;

  let liqInsidePocket = false;
  if (estLiq && nearestRiskCluster) {
    if (traderType === "long") {
      liqInsidePocket = estLiq.price >= nearestRiskCluster.price * 0.998;
    } else {
      liqInsidePocket = estLiq.price <= nearestRiskCluster.price * 1.002;
    }
  }

  let danger = 0;
  if (lev >= 50) danger += 5;
  else if (lev >= 25) danger += 4;
  else if (lev >= 15) danger += 3;
  else if (lev >= 10) danger += 2;
  else if (lev >= 5) danger += 1;

  if (pocketDistPct <= 0.5) danger += 4;
  else if (pocketDistPct <= 0.9) danger += 3;
  else if (pocketDistPct <= 1.5) danger += 2;
  else if (pocketDistPct <= 2.5) danger += 1;

  if (estLiq) {
    if (estLiq.distancePct <= 2) danger += 3;
    else if (estLiq.distancePct <= 4) danger += 2;
    else if (estLiq.distancePct <= 7) danger += 1;
  }
  if (liqInsidePocket) danger += 2;

  const risk: "low" | "medium" | "high" = danger >= 7 ? "high" : danger >= 4 ? "medium" : "low";
  const pts =
    risk === "low"
      ? maxPts
      : risk === "medium"
        ? Math.max(3, Math.round(maxPts * 0.5) - Math.min(2, danger - 4))
        : Math.max(0, Math.round(maxPts * 0.15) - Math.min(1, danger - 7));

  const levBit = `${lev.toFixed(lev >= 10 ? 0 : 1)}×`;
  const srcBit = liqSource === "exchange" ? "Blofin liq" : "est. liq";
  const liqBit = estLiq
    ? `${srcBit} ~${estLiq.price.toLocaleString(undefined, { maximumFractionDigits: 4 })} (${estLiq.distancePct.toFixed(2)}% from entry)`
    : "liq n/a";
  const pocketBit = nearestRiskCluster
    ? `nearest pocket ${pocketDistPct.toFixed(2)}% away`
    : "no pocket";
  const detail =
    risk === "high"
      ? `High risk at ${levBit}: ${liqBit}; ${pocketBit}${liqInsidePocket ? "; liq sits into/near the pocket" : ""}.`
      : risk === "medium"
        ? `Moderate at ${levBit}: ${liqBit}; ${pocketBit}.`
        : `More cushion at ${levBit}: ${liqBit}; ${pocketBit}.`;

  return { pts, risk, detail };
}

export function buildLiquidationMapTradeCheck(input: {
  traderType: "long" | "short";
  entry: number;
  exit: number;
  leverage: number;
  /** Live exchange liquidation (e.g. Blofin liqPx) when available. */
  exchangeLiquidationPrice?: number | null;
  markPrice: number;
  bias: "long" | "short" | "neutral";
  trend: "up" | "down" | "sideways";
  marketStructure: "higher-highs/higher-lows" | "lower-highs/lower-lows" | "mixed";
  clusters: TradeCheckCluster[];
}): LiquidationMapTradeCheck | null {
  const { traderType, entry, exit, markPrice, bias, trend, marketStructure, clusters } = input;
  if (!(entry > 0 && exit > 0 && Number.isFinite(entry) && Number.isFinite(exit))) return null;

  const W = { direction: 30, trend: 25, structure: 20, rr: 15, liquidation: 10 } as const;
  const levN = Number.isFinite(input.leverage) && input.leverage >= 1 ? input.leverage : 10;

  const expectedDirOk =
    (traderType === "long" && bias !== "short") || (traderType === "short" && bias !== "long");
  const trendOk =
    (traderType === "long" && trend !== "down") || (traderType === "short" && trend !== "up");
  const structureOk =
    (traderType === "long" && marketStructure !== "lower-highs/lower-lows") ||
    (traderType === "short" && marketStructure !== "higher-highs/higher-lows");

  const nearestRiskCluster =
    traderType === "long"
      ? clusters.filter((c) => c.side === "long_liq_below").sort((a, b) => a.distancePct - b.distancePct)[0]
      : clusters.filter((c) => c.side === "short_liq_above").sort((a, b) => a.distancePct - b.distancePct)[0];

  const suggestedPlan = buildLiquidationMapSuggestedPlan({
    traderType,
    entry,
    exit,
    markPrice,
    bias,
    trend,
    clusters,
  });

  const stopPx = suggestedPlan.suggestedStop.price;
  const riskAbs = Math.abs(entry - stopPx);
  const rewardAbs = traderType === "long" ? exit - entry : entry - exit;
  const rrValid = rewardAbs > 0 && riskAbs > 0;
  const rrMultiple = rrValid ? rewardAbs / riskAbs : 0;
  const rrPts = scoreRrPoints(rrMultiple, rrValid, W.rr);
  const planRr = suggestedPlan.planRrMultiple;

  const { liq: estLiq, source: liqSource } = resolveLiqPrice({
    traderType,
    entry,
    leverage: levN,
    exchangeLiquidationPrice: input.exchangeLiquidationPrice,
  });

  const liqScore = scoreLiquidationPoints({
    leverage: levN,
    entry,
    traderType,
    estLiq,
    liqSource,
    nearestRiskCluster: nearestRiskCluster
      ? { price: nearestRiskCluster.price, distancePct: nearestRiskCluster.distancePct }
      : null,
    maxPts: W.liquidation,
  });
  const liqPts = liqScore.pts;
  const liqRisk = liqScore.risk;

  const dirPts = expectedDirOk ? W.direction : 8;
  const trendPts = trendOk ? W.trend : 8;
  const structPts = structureOk ? W.structure : 6;

  const fmtPx = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 6 });
  const exitFor15R = traderType === "long" ? entry + 1.5 * riskAbs : entry - 1.5 * riskAbs;
  const exitFor25R = traderType === "long" ? entry + 2.5 * riskAbs : entry - 2.5 * riskAbs;

  const fixDirection =
    dirPts >= W.direction
      ? null
      : `Fade or counter-bias setups need smaller size and a hard invalidation at ~${fmtPx(suggestedPlan.suggestedStop.price)} — or wait until bias softens toward ${traderType === "long" ? "neutral/bullish" : "neutral/bearish"}.`;

  const fixTrend =
    trendPts >= W.trend
      ? null
      : `Prefer pullback or range-edge entries rather than chasing impulse while the read is "${trend}" against ${traderType}.${
          suggestedPlan.suggestedEntry
            ? ` Map suggests waiting near ${fmtPx(suggestedPlan.suggestedEntry.price)}.`
            : ""
        }`;

  const fixStructure =
    structPts >= W.structure
      ? null
      : `Consider waiting for a cleaner swing break (and retest) that supports ${traderType} before adding notional — structure "${marketStructure}" is awkward here.`;

  let fixRr: string | null = null;
  if (rrPts >= W.rr) {
    fixRr = null;
  } else if (!rrValid) {
    fixRr = `Set take-profit ${traderType === "long" ? "above" : "below"} entry — risk to stop is ${fmtPx(riskAbs)} (${suggestedPlan.suggestedStop.distancePctFromEntry.toFixed(2)}%).`;
  } else if (rrMultiple < 1.5) {
    const gapPct = (Math.abs(exitFor15R - exit) / entry) * 100;
    fixRr = `Improve R:R toward ~1.5× vs suggested stop ${fmtPx(stopPx)}: aim take-profit near ${fmtPx(exitFor15R)} (~${gapPct.toFixed(2)}% ${traderType === "long" ? "beyond" : "below"} your current exit). Plan R:R ≈ ${planRr?.toFixed(2) ?? rrMultiple.toFixed(2)}×.`;
  } else if (rrMultiple < 2.5) {
    const gapPct = (Math.abs(exitFor25R - exit) / entry) * 100;
    fixRr = `For the top RR bracket (~2.5× vs stop), stretch target toward ${fmtPx(exitFor25R)} (~${gapPct.toFixed(2)}% vs your exit) or tighten risk with stop near ${fmtPx(stopPx)}.`;
  }

  let fixLiq: string | null = null;
  if (liqPts >= W.liquidation) {
    fixLiq = null;
  } else if (liqRisk === "high") {
    const parts: string[] = [];
    if (levN > 10) parts.push(`cut leverage toward ≤8× (you used ${levN}×)`);
    if (estLiq) {
      parts.push(
        `${liqSource === "exchange" ? "Blofin" : "est."} liquidation ~${fmtPx(estLiq.price)} is only ${estLiq.distancePct.toFixed(2)}% from entry`
      );
    }
    if (nearestRiskCluster && Math.abs(pctChange(entry, nearestRiskCluster.price)) <= 0.9) {
      if (suggestedPlan.suggestedEntry) {
        parts.push(`wait for better entry near ${fmtPx(suggestedPlan.suggestedEntry.price)}`);
      } else {
        parts.push(`bias entry away from the nearest liquidation pocket`);
      }
    }
    parts.push(`place hard stop near ${fmtPx(suggestedPlan.suggestedStop.price)}`);
    fixLiq = parts.join("; ") + ".";
  } else {
    fixLiq = `Trim leverage (now ${levN}×) or add spacing from the nearest adverse cluster (${nearestRiskCluster ? `${nearestRiskCluster.distancePct.toFixed(2)}% away` : "see map"}). Suggested stop: ${fmtPx(suggestedPlan.suggestedStop.price)}.`;
  }

  const scoreBreakdown: LiquidationMapTradeCheck["scoreBreakdown"] = [
    {
      id: "direction",
      label: "Direction vs liquidity bias",
      earned: dirPts,
      max: W.direction,
      detail: expectedDirOk
        ? `Your ${traderType} aligns with NovaStaris liquidity bias (${bias}).`
        : `Your ${traderType} fights liquidity bias (${bias}) — fades can work but carry extra risk.`,
      suggestedFix: fixDirection,
    },
    {
      id: "trend",
      label: "Trend & MA slope",
      earned: trendPts,
      max: W.trend,
      detail: trendOk
        ? `15m/regression read: trend ${trend} — workable for ${traderType}.`
        : `15m/regression read: trend ${trend} — crowded against ${traderType}.`,
      suggestedFix: fixTrend,
    },
    {
      id: "structure",
      label: "Market structure",
      earned: structPts,
      max: W.structure,
      detail: structureOk
        ? `Structure ${marketStructure} is not aggressively against ${traderType}.`
        : `Structure ${marketStructure} argues against naive ${traderType} continuation.`,
      suggestedFix: fixStructure,
    },
    {
      id: "rr",
      label: "Risk / reward vs suggested stop",
      earned: rrPts,
      max: W.rr,
      detail: !rrValid
        ? `Exit must be ${traderType === "long" ? "above" : "below"} entry for reward; RR score is zero until fixed.`
        : `RR ≈ ${rrMultiple.toFixed(2)}× using stop ${fmtPx(stopPx)} (${suggestedPlan.suggestedStop.distancePctFromEntry.toFixed(2)}% risk) → exit ${fmtPx(exit)}.`,
      suggestedFix: fixRr,
    },
    {
      id: "liquidation",
      label: "Liquidation cushion & leverage",
      earned: liqPts,
      max: W.liquidation,
      detail: liqScore.detail,
      suggestedFix: fixLiq,
    },
  ];

  const score = Math.max(0, Math.min(100, Math.round(dirPts + trendPts + structPts + rrPts + liqPts)));
  const liqLabel = liqSource === "exchange" ? "Blofin liq" : "est. isolated liq";

  return {
    score,
    verdict: score >= 70 ? "good_trade" : score >= 45 ? "risky_trade" : "avoid_trade",
    directionFit: expectedDirOk
      ? "Trade direction aligns with current liquidity bias."
      : "Direction conflicts with current liquidity bias.",
    trendlineFit: trendOk
      ? `Trend is ${trend}; setup is acceptable for ${traderType}.`
      : `Trend is ${trend}; setup fights trend for ${traderType}.`,
    structureFit: structureOk
      ? `Market structure (${marketStructure}) supports this setup.`
      : `Market structure (${marketStructure}) is not favorable for this setup.`,
    liquidationRisk:
      liqRisk === "high"
        ? `High liquidation risk at ${levN}×${estLiq ? ` (${liqLabel} ~${fmtPx(estLiq.price)}, ${estLiq.distancePct.toFixed(2)}% away)` : ""}.`
        : liqRisk === "medium"
          ? `Moderate liquidation risk at ${levN}× — keep size conservative.`
          : `Lower liquidation risk at ${levN}× relative to pocket spacing.`,
    analyzed: {
      traderType,
      entry,
      exit,
      leverage: levN,
      estLiquidationPrice: estLiq?.price ?? null,
      estLiquidationDistancePct: estLiq?.distancePct ?? null,
      liqSource,
      rrMultiple: rrValid ? rrMultiple : null,
    },
    notes: [
      `Analyzed ${traderType} · entry ${fmtPx(entry)} · exit ${fmtPx(exit)} · leverage ${levN}×${
        estLiq ? ` · ${liqLabel} ~${fmtPx(estLiq.price)} (${estLiq.distancePct.toFixed(2)}% from entry)` : ""
      }.`,
      `Suggested hard stop: ${fmtPx(suggestedPlan.suggestedStop.price)} (${suggestedPlan.suggestedStop.distancePctFromEntry.toFixed(2)}% from your entry) — ${suggestedPlan.suggestedStop.reason}`,
      ...(suggestedPlan.suggestedEntry
        ? [
            `Better entry suggestion: ${fmtPx(suggestedPlan.suggestedEntry.price)} (${suggestedPlan.suggestedEntry.distancePctFromCurrent.toFixed(2)}% vs your entry) — ${suggestedPlan.suggestedEntry.reason}`,
          ]
        : ["Your entry location looks acceptable vs nearest pocket; no better-entry wait required."]),
      suggestedPlan.summary,
      `Score sums five pillars (max ${W.direction}+${W.trend}+${W.structure}+${W.rr}+${W.liquidation}=100): direction · trend · structure · RR · liquidation.`,
      "Market Bias / clusters above are symbol-wide (they do not change with your entry). Trade check below does — and re-scores when you edit entry/exit/leverage.",
    ],
    scoreBreakdown,
    suggestedPlan,
  };
}
