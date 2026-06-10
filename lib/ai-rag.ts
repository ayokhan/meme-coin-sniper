import { prisma } from '@/lib/db';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const MAX_CANDIDATES = 500;
const DEFAULT_TOP_K = 3;

export type TokenSummaryForRag = {
  symbol?: string;
  name?: string;
  contractAddress: string;
  liquidityUsd?: number;
  volume24h?: number;
  priceUsd?: number | null;
  marketCapUsd?: number | null;
  priceChange24hPct?: number;
  hasTwitter?: boolean;
  hasTelegram?: boolean;
  hasWebsite?: boolean;
  security?: {
    isHoneypot?: boolean;
    isMintable?: boolean;
    topHolderPercent?: number;
    issues?: string[];
    warnings?: string[];
  };
};

export type RagSnippet = {
  contractAddress: string;
  symbol?: string | null;
  score?: number | null;
  signal?: string | null;
  feedbackOutcome?: string | null;
  summaryText: string;
  similarity: number;
  sameToken?: boolean;
};

export function isRagConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY?.trim();
}

export function buildRagSummaryText(
  summary: TokenSummaryForRag,
  result?: { score?: number; signal?: string; reasons?: string[] },
): string {
  const parts = [
    summary.symbol ?? 'UNKNOWN',
    summary.name ?? '',
    `liq $${Math.round(summary.liquidityUsd ?? 0)}`,
    `vol24 $${Math.round(summary.volume24h ?? 0)}`,
    summary.marketCapUsd != null ? `mcap $${Math.round(summary.marketCapUsd)}` : null,
    summary.priceChange24hPct != null ? `chg24 ${summary.priceChange24hPct.toFixed(1)}%` : null,
    `twitter ${summary.hasTwitter ? 'yes' : 'no'}`,
    `telegram ${summary.hasTelegram ? 'yes' : 'no'}`,
    summary.security?.isHoneypot ? 'honeypot' : null,
    summary.security?.isMintable ? 'mintable' : null,
    summary.security?.topHolderPercent != null ? `topHolder ${summary.security.topHolderPercent}%` : null,
    ...(summary.security?.issues ?? []).slice(0, 2),
  ].filter(Boolean);

  if (result?.score != null) {
    parts.push(`score ${result.score}`, `signal ${result.signal ?? ''}`);
  }
  if (result?.reasons?.length) {
    parts.push(result.reasons.slice(0, 2).join('; '));
  }

  return parts.join(' | ');
}

export async function embedText(text: string): Promise<number[] | null> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;

  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: text.slice(0, 8000),
      }),
    });

    if (!res.ok) {
      console.warn('RAG embed failed:', res.status);
      return null;
    }

    const data = (await res.json()) as { data?: Array<{ embedding?: number[] }> };
    const emb = data.data?.[0]?.embedding;
    return Array.isArray(emb) ? emb : null;
  } catch (e) {
    console.warn('RAG embed error:', e);
    return null;
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom > 0 ? dot / denom : 0;
}

function parseEmbedding(raw: unknown): number[] | null {
  if (!Array.isArray(raw)) return null;
  const nums = raw.filter((n) => typeof n === 'number' && Number.isFinite(n)) as number[];
  return nums.length === raw.length ? nums : null;
}

export async function retrieveRelevantAnalyses(
  summary: TokenSummaryForRag,
  options?: { topK?: number },
): Promise<RagSnippet[]> {
  const topK = options?.topK ?? DEFAULT_TOP_K;
  const queryText = buildRagSummaryText(summary);
  const queryEmb = await embedText(queryText);
  if (!queryEmb) return [];

  const rows = await prisma.aiAnalysisEmbedding.findMany({
    orderBy: { createdAt: 'desc' },
    take: MAX_CANDIDATES,
    select: {
      contractAddress: true,
      symbol: true,
      summaryText: true,
      embedding: true,
      score: true,
      signal: true,
      feedbackOutcome: true,
    },
  });

  const scored: RagSnippet[] = [];
  for (const row of rows) {
    const emb = parseEmbedding(row.embedding);
    if (!emb) continue;
    scored.push({
      contractAddress: row.contractAddress,
      symbol: row.symbol,
      score: row.score,
      signal: row.signal,
      feedbackOutcome: row.feedbackOutcome,
      summaryText: row.summaryText,
      similarity: cosineSimilarity(queryEmb, emb),
      sameToken: row.contractAddress === summary.contractAddress,
    });
  }

  scored.sort((a, b) => b.similarity - a.similarity);

  const sameToken = scored.find((s) => s.sameToken);
  const topOthers = scored.filter((s) => !s.sameToken).slice(0, topK);
  if (sameToken) {
    return [sameToken, ...topOthers].slice(0, topK);
  }
  return scored.slice(0, topK);
}

export function formatRagPromptBlock(snippets: RagSnippet[]): string {
  if (!snippets.length) return '';
  const lines = snippets.map((s, i) => {
    const fb = s.feedbackOutcome ? ` owner feedback: ${s.feedbackOutcome}` : '';
    const meta = [s.symbol, `score ${s.score ?? '?'}`, `signal ${s.signal ?? '?'}`, fb].filter(Boolean).join(', ');
    return `${i + 1}. (${meta}) ${s.summaryText}`;
  });
  return `\nRELEVANT PAST ANALYSES (use for consistency; do not contradict without strong new evidence):\n${lines.join('\n')}\n`;
}

export async function storeAnalysisEmbedding(args: {
  summary: TokenSummaryForRag;
  score: number;
  signal: string;
  reasons: string[];
}): Promise<void> {
  if (!isRagConfigured()) return;

  const summaryText = buildRagSummaryText(args.summary, {
    score: args.score,
    signal: args.signal,
    reasons: args.reasons,
  });
  const embedding = await embedText(summaryText);
  if (!embedding) return;

  let feedbackOutcome: string | null = null;
  try {
    const fb = await prisma.aiAnalysisFeedback.findFirst({
      where: { contractAddress: args.summary.contractAddress },
      orderBy: { createdAt: 'desc' },
      select: { outcome: true },
    });
    feedbackOutcome = fb?.outcome ?? null;
  } catch {
    /* ignore */
  }

  await prisma.aiAnalysisEmbedding.create({
    data: {
      contractAddress: args.summary.contractAddress,
      chain: 'solana',
      symbol: args.summary.symbol ?? null,
      summaryText,
      embedding,
      score: args.score,
      signal: args.signal,
      feedbackOutcome,
    },
  });
}
