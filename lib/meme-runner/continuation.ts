import type { DexPair } from "@/lib/api-clients/dexscreener";
import type { MemeRunnerSolConfig } from "@/lib/meme-runner/types";

export type ContinuationInput = {
  pair: DexPair;
  mcap: number | null;
  bondingProgressPct: number | null;
  config: MemeRunnerSolConfig;
};

export type ContinuationResult = {
  score: number;
  notes: string[];
};

function buyRatioH1(pair: DexPair): number | null {
  const t = pair.txns?.h1;
  if (!t) return null;
  const buys = t.buys ?? 0;
  const sells = t.sells ?? 0;
  const total = buys + sells;
  if (total < 5) return null;
  return buys / total;
}

/** Score 0–100: higher = more likely to keep running vs +20% then fade. */
export function scoreContinuation({ pair, mcap, bondingProgressPct, config }: ContinuationInput): ContinuationResult {
  const notes: string[] = [];
  let score = 50;
  const soon = config.soon;
  const sweetMin = soon.continuationSweetMinMcapUsd;
  const sweetMax = soon.continuationSweetMaxMcapUsd;
  const mc = mcap ?? 0;

  if (mc >= sweetMin && mc <= sweetMax) {
    score += 22;
    notes.push("MC in continuation band");
  } else if (mc > sweetMax && mc <= (soon.maxMarketCapUsd || sweetMax)) {
    score -= 12;
    notes.push("MC above sweet spot (late)");
  } else if (mc > 0 && mc < sweetMin) {
    score += 8;
    notes.push("MC still building");
  }

  if (bondingProgressPct != null) {
    if (bondingProgressPct >= 45 && bondingProgressPct <= 78) {
      score += 18;
      notes.push("Curve mid-band (room to run)");
    } else if (bondingProgressPct > 88) {
      if (mc >= 85_000 && mc <= 120_000) {
        score += 10;
        notes.push("Graduating band (90k→1M setup)");
      } else {
        score -= 28;
        notes.push("Curve near graduation (fade risk)");
      }
    } else if (bondingProgressPct < 35) {
      score += 5;
      notes.push("Early curve");
    }
  }

  const volH1 = pair.volume?.h1 ?? 0;
  const volH24 = pair.volume?.h24 ?? 0;
  if (volH1 > 0 && volH24 > 0) {
    const recentShare = (volH1 * 12) / volH24;
    if (recentShare >= 0.45) {
      score += 14;
      notes.push("Volume accelerating");
    } else if (recentShare < 0.15) {
      score -= 10;
      notes.push("Volume fading");
    }
  }

  const buyRatio = buyRatioH1(pair);
  if (buyRatio != null) {
    if (buyRatio >= 0.56) {
      score += 12;
      notes.push("Buy pressure (1h)");
    } else if (buyRatio < 0.44) {
      score -= 12;
      notes.push("Sell pressure (1h)");
    }
  }

  const ch1 = pair.priceChange?.h1;
  if (ch1 != null && Number.isFinite(ch1)) {
    if (ch1 >= 3 && ch1 <= 45) {
      score += 12;
      notes.push("Healthy 1h momentum");
    } else if (ch1 > 70) {
      score -= 18;
      notes.push("1h already vertical");
    } else if (ch1 < -12) {
      score -= 20;
      notes.push("1h dump");
    }
  }

  const liq = pair.liquidity?.usd ?? 0;
  if (liq > 0 && mc > 0) {
    const volToLiq = volH24 / liq;
    if (volToLiq >= 2 && volToLiq <= 25) {
      score += 6;
      notes.push("Active vs liquidity");
    }
  }

  return { score: Math.min(100, Math.max(0, Math.round(score))), notes };
}

export function passesContinuationFilters(
  continuationScore: number,
  bondingProgressPct: number | null,
  config: MemeRunnerSolConfig
): { passes: boolean; notes: string[] } {
  const soon = config.soon;
  const notes: string[] = [];
  if (soon.minContinuationScore > 0 && continuationScore < soon.minContinuationScore) {
    notes.push(`Continuation ${continuationScore} < ${soon.minContinuationScore}`);
  }
  if (
    soon.maxBondingProgressPct != null &&
    bondingProgressPct != null &&
    bondingProgressPct > soon.maxBondingProgressPct
  ) {
    notes.push(`Curve ${bondingProgressPct.toFixed(0)}% > max ${soon.maxBondingProgressPct}%`);
  }
  return { passes: notes.length === 0, notes };
}
