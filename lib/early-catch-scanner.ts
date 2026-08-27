/**
 * Early Catch: memes with strong narrative signals still under a micro market cap.
 * Uses DexScreener (free) — no Helius CU for the scan itself.
 */

import {
  fetchSolanaPairsViaSearch,
  getNewSolanaPairsFromWebSocket,
  type DexPair,
} from "@/lib/api-clients/dexscreener";
import { fetchGoogleNewsHeadlines } from "@/lib/nova-crypto-narratives";

/** Default: still early — pair younger than 3 days. */
export const EARLY_CATCH_MAX_AGE_MINUTES = 72 * 60;
/** Default: need real narrative heat, not noise scores like 1–7. */
export const EARLY_CATCH_MIN_NARRATIVE_SCORE = 25;

export type EarlyCatchCoin = {
  name: string;
  symbol: string;
  address: string;
  chain: string;
  marketCapUsd: number;
  liquidityUsd: number;
  volumeUsd: number;
  priceChange24h: number;
  ageMinutes: number;
  narrativeScore: number;
  narrativeTags: string[];
  reason: string;
  pairUrl: string;
};

export type EarlyCatchResult = {
  scannedAt: string;
  maxMarketCapUsd: number;
  minLiquidityUsd: number;
  maxAgeMinutes: number;
  minNarrativeScore: number;
  pairsScanned: number;
  coins: EarlyCatchCoin[];
};

function pairCreatedMs(p: DexPair): number {
  const created = p.pairCreatedAt ?? 0;
  return created < 1e12 ? created * 1000 : created;
}

function mcap(p: DexPair): number {
  const raw = (p as DexPair & { marketCap?: number }).marketCap ?? p.fdv ?? 0;
  return Number(raw) || 0;
}

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3);
}

/** Score how well token name/symbol aligns with live headlines + volume heat. */
function scorePair(p: DexPair, headlineTokens: Set<string>): { score: number; tags: string[]; reason: string } {
  const name = p.baseToken?.name ?? "";
  const symbol = p.baseToken?.symbol ?? "";
  const tokens = new Set([...tokenize(name), ...tokenize(symbol)]);
  const tags: string[] = [];
  for (const t of tokens) {
    if (headlineTokens.has(t)) tags.push(t);
  }

  const vol = p.volume?.h1 ?? p.volume?.h6 ?? p.volume?.h24 ?? 0;
  const change = Math.abs(p.priceChange?.h1 ?? p.priceChange?.m5 ?? p.priceChange?.h24 ?? 0);
  const txns =
    (p.txns?.h1?.buys ?? 0) +
    (p.txns?.h1?.sells ?? 0) +
    (p.txns?.h6?.buys ?? 0) +
    (p.txns?.h6?.sells ?? 0);

  let score = 0;
  score += Math.min(40, tags.length * 18);
  score += Math.min(25, Math.log10(Math.max(vol, 1)) * 8);
  score += Math.min(20, change / 5);
  score += Math.min(15, txns / 20);

  const reasonParts: string[] = [];
  if (tags.length) reasonParts.push(`Narrative overlap: ${tags.slice(0, 4).join(", ")}`);
  if (vol > 500) reasonParts.push(`Active volume $${Math.round(vol).toLocaleString()}`);
  if (change > 10) reasonParts.push(`Momentum ${change.toFixed(0)}%`);
  if (!reasonParts.length) reasonParts.push("Micro-cap with early flow");

  return { score: Math.round(Math.min(100, score)), tags, reason: reasonParts.join(" · ") };
}

export async function runEarlyCatchScan(opts: {
  maxMarketCapUsd?: number;
  minLiquidityUsd?: number;
  maxAgeMinutes?: number;
  minNarrativeScore?: number;
  /** Require at least one headline-token overlap (default true). */
  requireNarrativeTag?: boolean;
  limit?: number;
}): Promise<EarlyCatchResult> {
  const maxMarketCapUsd = opts.maxMarketCapUsd ?? 20_000;
  const minLiquidityUsd = opts.minLiquidityUsd ?? 2_000;
  const maxAgeMinutes = opts.maxAgeMinutes ?? EARLY_CATCH_MAX_AGE_MINUTES;
  const minNarrativeScore = opts.minNarrativeScore ?? EARLY_CATCH_MIN_NARRATIVE_SCORE;
  const requireNarrativeTag = opts.requireNarrativeTag ?? true;
  const limit = opts.limit ?? 30;

  const [wsPairs, searchPairs, headlines] = await Promise.all([
    getNewSolanaPairsFromWebSocket(10_000).catch(() => [] as DexPair[]),
    fetchSolanaPairsViaSearch(["meme", "ai", "trump", "elon", "cat", "dog", "pepe"]).catch(() => [] as DexPair[]),
    fetchGoogleNewsHeadlines("crypto OR meme OR solana OR bitcoin OR trump", 12).catch(() => [] as { title: string }[]),
  ]);

  const headlineTokens = new Set<string>();
  for (const h of headlines) {
    for (const t of tokenize(h.title ?? "")) headlineTokens.add(t);
  }

  const seen = new Set<string>();
  const all: DexPair[] = [];
  for (const p of [...wsPairs, ...searchPairs]) {
    const addr = p.baseToken?.address;
    if (!addr || seen.has(addr)) continue;
    seen.add(addr);
    all.push(p);
  }

  const now = Date.now();
  const coins: EarlyCatchCoin[] = [];

  for (const p of all) {
    if ((p.chainId || "").toLowerCase() !== "solana") continue;
    const cap = mcap(p);
    if (!cap || cap <= 0 || cap > maxMarketCapUsd) continue;
    const liq = p.liquidity?.usd ?? 0;
    if (liq < minLiquidityUsd) continue;

    const created = pairCreatedMs(p);
    if (!created) continue;
    const ageMinutes = Math.max(0, (now - created) / 60_000);
    if (ageMinutes > maxAgeMinutes) continue;

    const { score, tags, reason } = scorePair(p, headlineTokens);
    if (score < minNarrativeScore) continue;
    if (requireNarrativeTag && tags.length === 0) continue;

    const addr = p.baseToken.address;

    coins.push({
      name: p.baseToken.name,
      symbol: p.baseToken.symbol,
      address: addr,
      chain: "solana",
      marketCapUsd: cap,
      liquidityUsd: liq,
      volumeUsd: p.volume?.h24 ?? p.volume?.h6 ?? p.volume?.h1 ?? 0,
      priceChange24h: p.priceChange?.h24 ?? p.priceChange?.h1 ?? 0,
      ageMinutes,
      narrativeScore: score,
      narrativeTags: tags,
      reason,
      pairUrl: `https://dexscreener.com/solana/${p.pairAddress}`,
    });
  }

  coins.sort((a, b) => b.narrativeScore - a.narrativeScore || a.marketCapUsd - b.marketCapUsd);

  return {
    scannedAt: new Date().toISOString(),
    maxMarketCapUsd,
    minLiquidityUsd,
    maxAgeMinutes,
    minNarrativeScore,
    pairsScanned: all.length,
    coins: coins.slice(0, limit),
  };
}
