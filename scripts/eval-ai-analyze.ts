/**
 * Run offline eval: re-analyze labeled tokens and compare to expected signal/score.
 *
 * Prereq: export eval set first
 *   npm run eval:export-feedback
 *
 * Usage:
 *   npm run eval:ai-analyze
 *   npm run eval:ai-analyze -- --limit 5 --delay 3000
 *   npm run eval:ai-analyze -- --input data/eval-ai-feedback.jsonl --out data/eval-results.json
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import {
  formatEvalSummary,
  summarizeEvalRuns,
  type EvalRow,
  type EvalRunRow,
} from '../lib/ai-eval-metrics';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function parseArgs() {
  const get = (flag: string, fallback: string) => {
    const i = process.argv.indexOf(flag);
    return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
  };
  return {
    input: path.resolve(process.cwd(), get('--input', 'data/eval-ai-feedback.jsonl')),
    out: path.resolve(process.cwd(), get('--out', 'data/eval-results.json')),
    limit: Number(get('--limit', '0')) || 0,
    delayMs: Number(get('--delay', '2500')) || 2500,
  };
}

function loadEvalRows(file: string): EvalRow[] {
  if (!fs.existsSync(file)) {
    throw new Error(`Eval file not found: ${file}\nRun: npm run eval:export-feedback`);
  }
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l) as EvalRow);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const { input, out, limit, delayMs } = parseArgs();

  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    throw new Error('ANTHROPIC_API_KEY is required in .env.local (or .env) for local eval runs.');
  }

  const { runAiAnalysis } = await import('../lib/ai-analyze');

  let rows = loadEvalRows(input);
  if (limit > 0) rows = rows.slice(0, limit);

  console.log(`Running eval on ${rows.length} row(s) (delay ${delayMs}ms between calls)…`);
  console.log('Note: eval uses standard analysis (no RAG) for reproducible baseline.\n');

  const results: EvalRunRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    process.stdout.write(`[${i + 1}/${rows.length}] ${row.contractAddress.slice(0, 8)}… `);

    try {
      const result = await runAiAnalysis(row.contractAddress);
      const signalMatch =
        row.expectedSignal != null ? result.signal === row.expectedSignal : null;

      results.push({
        ...row,
        actualSignal: result.signal,
        actualScore: result.score,
        signalMatch,
      });
      const mark = signalMatch === true ? '✓' : signalMatch === false ? '✗' : '?';
      console.log(`${mark}  score=${result.score} signal=${result.signal} (expected ${row.expectedSignal ?? 'n/a'})`);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      results.push({
        ...row,
        actualSignal: null,
        actualScore: null,
        signalMatch: null,
        error: message,
      });
      console.log(`ERR  ${message}`);
    }

    if (i < rows.length - 1) await sleep(delayMs);
  }

  const summary = summarizeEvalRuns(results);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(
    out,
    JSON.stringify({ summary, results, ranAt: new Date().toISOString() }, null, 2),
    'utf8',
  );

  console.log('\n' + formatEvalSummary(summary));
  console.log(`\nFull results → ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
