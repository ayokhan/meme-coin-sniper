import type { AnalyzerVerdict, WalletAnalysis } from "./types";

/**
 * Heuristic copy-trade scoring.
 *
 * Inputs are the analyzer totals; we award/deduct points across:
 *   • Win rate (sample-size adjusted)
 *   • Realized PnL magnitude
 *   • Trade frequency (samples)
 *   • Position diversification
 *   • Loss asymmetry (biggest loss vs biggest win)
 *   • Holdings value (skin in the game)
 *
 * Final label:
 *   score ≥ 5 → Strong copy
 *   score 3–4.99 → Moderate
 *   score 1–2.99 → Mixed
 *   score < 1 → Avoid
 */
export function buildVerdict(a: Omit<WalletAnalysis, "verdict" | "notes" | "generatedAtMs" | "nativeSymbol" | "nativePriceUsd" | "chain" | "walletAddress" | "period">): AnalyzerVerdict {
  const t = a.totals;
  const reasons: string[] = [];
  const cautions: string[] = [];
  let score = 0;

  // Win rate
  if (t.winRatePct !== null) {
    if (t.winRatePct >= 70) {
      score += 2.5;
      reasons.push(`Win rate ${t.winRatePct.toFixed(0)}% is excellent.`);
    } else if (t.winRatePct >= 55) {
      score += 1.5;
      reasons.push(`Win rate ${t.winRatePct.toFixed(0)}% is above average.`);
    } else if (t.winRatePct < 30) {
      score -= 2;
      cautions.push(`Win rate is only ${t.winRatePct.toFixed(0)}% — most trades lose money.`);
    }
  } else {
    cautions.push("Win rate cannot be computed (no closed sells in this window).");
  }

  // Realized PnL magnitude
  if (t.realizedPnlUsd >= 10_000) {
    score += 2;
    reasons.push(`Realized PnL ${formatUsd(t.realizedPnlUsd)} is substantial.`);
  } else if (t.realizedPnlUsd >= 1_000) {
    score += 1;
    reasons.push(`Realized PnL ${formatUsd(t.realizedPnlUsd)} is meaningfully positive.`);
  } else if (t.realizedPnlUsd <= -1_000) {
    score -= 1.5;
    cautions.push(`Realized PnL ${formatUsd(t.realizedPnlUsd)} is meaningfully negative in this window.`);
  }

  // PnL % (relative to volume)
  if (t.realizedPnlPct !== null) {
    if (t.realizedPnlPct >= 50) {
      score += 1;
      reasons.push(`Realized PnL is ${t.realizedPnlPct.toFixed(0)}% of capital deployed — strong return-on-flow.`);
    } else if (t.realizedPnlPct <= -30) {
      score -= 1;
      cautions.push(`Realized return-on-flow is ${t.realizedPnlPct.toFixed(0)}%, capital is bleeding.`);
    }
  }

  // Trade count → sample size
  if (t.tradeCount >= 30) {
    score += 1;
    reasons.push(`${t.tradeCount} trades give a healthy sample size.`);
  } else if (t.tradeCount >= 8) {
    score += 0.5;
  } else if (t.tradeCount > 0 && t.tradeCount < 4) {
    cautions.push(`Only ${t.tradeCount} trade(s) — too few to judge skill vs luck.`);
  }

  // Diversification
  if (t.uniqueMints >= 6) {
    score += 1;
    reasons.push(`Active across ${t.uniqueMints} different tokens — not a single-coin lottery ticket.`);
  } else if (t.uniqueMints <= 2 && t.tradeCount > 0) {
    cautions.push(`Activity concentrated in ${t.uniqueMints} token(s).`);
  }

  // Loss asymmetry
  const biggestWin = t.biggestWinPnlUsd ?? 0;
  const biggestLoss = Math.abs(t.biggestLossPnlUsd ?? 0);
  if (biggestWin > 0 && biggestLoss > biggestWin * 1.5) {
    score -= 1;
    cautions.push(
      `Biggest loss (${formatUsd(t.biggestLossPnlUsd ?? 0)}) is larger than biggest win (${formatUsd(biggestWin)}) — poor risk control.`,
    );
  } else if (biggestWin >= biggestLoss * 2 && biggestWin > 0) {
    score += 0.5;
    reasons.push("Biggest win clearly outpaces biggest loss — good risk asymmetry.");
  }

  // Skin in the game
  if (t.holdingsValueUsd >= 5_000) {
    score += 0.5;
    reasons.push(`Holdings ~ ${formatUsd(t.holdingsValueUsd)} — wallet has real exposure.`);
  } else if (t.holdingsValueUsd < 100 && t.tradeCount > 0) {
    cautions.push("Holdings are tiny — wallet may be a one-off rather than a primary trader.");
  }

  let label: AnalyzerVerdict["label"];
  if (score >= 5) label = "Strong copy";
  else if (score >= 3) label = "Moderate copy";
  else if (score >= 1) label = "Mixed signal";
  else label = "Avoid";

  return { label, score: Math.round(score * 10) / 10, reasons, cautions };
}

function formatUsd(v: number): string {
  const sign = v < 0 ? "-" : "+";
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(2)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}
