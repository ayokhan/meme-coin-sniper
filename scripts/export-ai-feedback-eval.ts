/**
 * Export AiAnalysisFeedback from Postgres to JSONL for offline evals.
 *
 * Usage:
 *   npm run eval:export-feedback
 *   npm run eval:export-feedback -- --out data/eval-ai-feedback.jsonl
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { expectedSignalFromFeedback, type EvalRow } from '../lib/ai-eval-metrics';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function parseArgs() {
  const outIdx = process.argv.indexOf('--out');
  const out = outIdx >= 0 ? process.argv[outIdx + 1] : 'data/eval-ai-feedback.jsonl';
  const dedupe = !process.argv.includes('--all-rows');
  return { out: path.resolve(process.cwd(), out), dedupe };
}

type FeedbackRow = {
  id: string;
  contractAddress: string;
  outcome: string;
  score: number | null;
  signal: string | null;
  createdAt: Date;
};

async function main() {
  const { prisma } = await import('../lib/db');
  const { out, dedupe } = parseArgs();

  const rows = (await prisma.aiAnalysisFeedback.findMany({
    orderBy: { createdAt: 'desc' },
  })) as FeedbackRow[];

  const evalRows: EvalRow[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    if (row.outcome !== 'good' && row.outcome !== 'bad') continue;
    const ca = row.contractAddress?.trim();
    if (!ca) continue;
    if (dedupe && seen.has(ca)) continue;
    seen.add(ca);

    const signalAtFeedback = row.signal === 'buy' || row.signal === 'no_buy' ? row.signal : null;
    evalRows.push({
      id: row.id,
      contractAddress: ca,
      outcome: row.outcome,
      scoreAtFeedback: row.score ?? null,
      signalAtFeedback,
      expectedSignal: expectedSignalFromFeedback(row.outcome, signalAtFeedback),
      feedbackAt: row.createdAt.toISOString(),
    });
  }

  fs.mkdirSync(path.dirname(out), { recursive: true });
  const body = evalRows.map((r) => JSON.stringify(r)).join('\n') + (evalRows.length ? '\n' : '');
  fs.writeFileSync(out, body, 'utf8');

  console.log(`Exported ${evalRows.length} eval row(s) → ${out}`);
  if (evalRows.length < 10) {
    console.log('Tip: label more analyses in Admin → AI Feedback for stronger evals (target 50+).');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
