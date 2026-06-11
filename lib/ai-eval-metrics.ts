export type EvalRow = {
  id: string;
  contractAddress: string;
  outcome: 'good' | 'bad';
  scoreAtFeedback: number | null;
  signalAtFeedback: 'buy' | 'no_buy' | null;
  expectedSignal: 'buy' | 'no_buy' | null;
  feedbackAt: string;
};

export type EvalRunRow = EvalRow & {
  actualSignal: 'buy' | 'no_buy' | null;
  actualScore: number | null;
  signalMatch: boolean | null;
  error?: string;
};

export type EvalSummary = {
  total: number;
  ran: number;
  errors: number;
  signalAccuracy: number | null;
  signalMatches: number;
  signalScored: number;
  buyPrecision: number | null;
  buyRecall: number | null;
  avgScoreWhenGood: number | null;
  avgScoreWhenBad: number | null;
  avgScoreExpectedBuy: number | null;
  avgScoreExpectedNoBuy: number | null;
};

export function expectedSignalFromFeedback(
  outcome: 'good' | 'bad',
  signalAtFeedback: 'buy' | 'no_buy' | null,
): 'buy' | 'no_buy' | null {
  if (!signalAtFeedback) return null;
  if (outcome === 'good') return signalAtFeedback;
  return signalAtFeedback === 'buy' ? 'no_buy' : 'buy';
}

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

export function summarizeEvalRuns(rows: EvalRunRow[]): EvalSummary {
  const ran = rows.filter((r) => r.actualSignal != null);
  const errors = rows.filter((r) => r.error).length;
  const scored = ran.filter((r) => r.expectedSignal != null && r.actualSignal != null);
  const signalMatches = scored.filter((r) => r.signalMatch === true).length;

  const predictedBuy = scored.filter((r) => r.actualSignal === 'buy');
  const expectedBuy = scored.filter((r) => r.expectedSignal === 'buy');
  const truePositiveBuy = predictedBuy.filter((r) => r.expectedSignal === 'buy').length;

  const goodScores = ran.filter((r) => r.outcome === 'good' && r.actualScore != null).map((r) => r.actualScore!);
  const badScores = ran.filter((r) => r.outcome === 'bad' && r.actualScore != null).map((r) => r.actualScore!);
  const expectedBuyScores = scored.filter((r) => r.expectedSignal === 'buy' && r.actualScore != null).map((r) => r.actualScore!);
  const expectedNoBuyScores = scored.filter((r) => r.expectedSignal === 'no_buy' && r.actualScore != null).map((r) => r.actualScore!);

  return {
    total: rows.length,
    ran: ran.length,
    errors,
    signalAccuracy: scored.length ? Math.round((signalMatches / scored.length) * 1000) / 10 : null,
    signalMatches,
    signalScored: scored.length,
    buyPrecision: predictedBuy.length ? Math.round((truePositiveBuy / predictedBuy.length) * 1000) / 10 : null,
    buyRecall: expectedBuy.length ? Math.round((truePositiveBuy / expectedBuy.length) * 1000) / 10 : null,
    avgScoreWhenGood: avg(goodScores),
    avgScoreWhenBad: avg(badScores),
    avgScoreExpectedBuy: avg(expectedBuyScores),
    avgScoreExpectedNoBuy: avg(expectedNoBuyScores),
  };
}

export function formatEvalSummary(summary: EvalSummary): string {
  const lines = [
    '--- NovaStaris AI Analyze Eval ---',
    `Rows: ${summary.total}  |  Ran: ${summary.ran}  |  Errors: ${summary.errors}`,
    `Signal accuracy: ${summary.signalAccuracy != null ? `${summary.signalAccuracy}% (${summary.signalMatches}/${summary.signalScored})` : 'n/a'}`,
    `Buy precision: ${summary.buyPrecision != null ? `${summary.buyPrecision}%` : 'n/a'}  |  Buy recall: ${summary.buyRecall != null ? `${summary.buyRecall}%` : 'n/a'}`,
    `Avg score (good feedback): ${summary.avgScoreWhenGood ?? 'n/a'}  |  (bad feedback): ${summary.avgScoreWhenBad ?? 'n/a'}`,
    `Avg score (expected buy): ${summary.avgScoreExpectedBuy ?? 'n/a'}  |  (expected no_buy): ${summary.avgScoreExpectedNoBuy ?? 'n/a'}`,
  ];
  return lines.join('\n');
}
