/**
 * Early Catch: fresh micro-caps with narrative heat + real early flow.
 * Uses DexScreener (free) — no Helius CU for the scan itself.
 */

import {
  fetchSolanaPairsViaSearch,
  getNewSolanaPairsFromWebSocket,
  type DexPair,
} from "@/lib/api-clients/dexscreener";
import { fetchGoogleNewsHeadlines } from "@/lib/nova-crypto-narratives";

/** Still early — pair younger than 3 days. */
export const EARLY_CATCH_MAX_AGE_MINUTES = 72 * 60;
/** Soft floor when there is narrative theme/headline overlap. */
export const EARLY_CATCH_MIN_NARRATIVE_SCORE = 28;
/** Higher bar when there is no narrative tag — pure heat only if strong. */
export const EARLY_CATCH_MIN_HEAT_ONLY_SCORE = 40;
/** Kill dead / idle pools. */
export const EARLY_CATCH_MIN_VOLUME_USD = 400;
export const EARLY_CATCH_MIN_TXNS = 12;

/** Recurring meme themes that count as narrative even without a news hit. */
const NARRATIVE_THEMES = [
  "trump",
  "elon",
  "musk",
  "pepe",
  "wojak",
  "doge",
  "shib",
  "cat",
  "dog",
  "ai",
  "gpt",
  "agent",
  "solana",
  "pump",
  "meme",
  "frog",
  "moon",
  "maga",
  "bitcoin",
  "btc",
  "eth",
] as const;

const SEARCH_QUERIES = ["meme", "ai", "trump", "elon", "cat", "dog", "pepe", "maga", "solana"];

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
    .filter((w) => w.length >= 2);
}

function recentVolume(p: DexPair): number {
  return p.volume?.h1 ?? p.volume?.h6 ?? p.volume?.h24 ?? 0;
}

function recentTxns(p: DexPair): { buys: number; sells: number; total: number } {
  // Prefer h1+h6 when present; fall back to h24 if those windows are empty
  const windowBuys = (p.txns?.h1?.buys ?? 0) + (p.txns?.h6?.buys ?? 0);
  const windowSells = (p.txns?.h1?.sells ?? 0) + (p.txns?.h6?.sells ?? 0);
  if (windowBuys + windowSells > 0) {
    return { buys: windowBuys, sells: windowSells, total: windowBuys + windowSells };
  }
  const h24Buys = p.txns?.h24?.buys ?? 0;
  const h24Sells = p.txns?.h24?.sells ?? 0;
  return { buys: h24Buys, sells: h24Sells, total: h24Buys + h24Sells };
}

function matchTags(tokens: Set<string>, pool: Set<string>): string[] {
  const tags: string[] = [];
  for (const t of tokens) {
    if (pool.has(t)) tags.push(t);
  }
  return tags;
}

/** Score narrative alignment + early flow quality. */
function scorePair(
  p: DexPair,
  headlineTokens: Set<string>,
  themeTokens: Set<string>,
  ageMinutes: number
): { score: number; tags: string[]; reason: string } {
  const name = p.baseToken?.name ?? "";
  const symbol = p.baseToken?.symbol ?? "";
  const tokens = new Set([...tokenize(name), ...tokenize(symbol)]);

  const headlineTags = matchTags(tokens, headlineTokens);
  const themeTags = matchTags(tokens, themeTokens).filter((t) => !headlineTags.includes(t));
  const tags = [...headlineTags, ...themeTags];

  const vol = recentVolume(p);
  const change = p.priceChange?.h1 ?? p.priceChange?.m5 ?? p.priceChange?.h24 ?? 0;
  const absChange = Math.abs(change);
  const { buys, sells, total: txns } = recentTxns(p);
  const buyRatio = txns > 0 ? buys / txns : 0;

  let score = 0;
  // Headline overlap is strongest narrative signal
  score += Math.min(35, headlineTags.length * 20);
  // Theme keywords still count (meme / trump / pepe / ai …)
  score += Math.min(20, themeTags.length * 10);
  // Real early flow
  score += Math.min(20, Math.log10(Math.max(vol, 1)) * 6);
  score += Math.min(12, txns / 15);
  if (change > 8) score += Math.min(10, change / 8);
  if (buyRatio >= 0.55) score += 8;
  // Fresher pairs get a small boost (first ~12h)
  if (ageMinutes <= 60) score += 10;
  else if (ageMinutes <= 360) score += 6;
  else if (ageMinutes <= 1440) score += 3;

  // Dump-heavy / sell-dominated: soft penalty
  if (change <= -25 || (txns >= 20 && buyRatio < 0.35)) score -= 12;

  const reasonParts: string[] = [];
  if (headlineTags.length) reasonParts.push(`News narrative: ${headlineTags.slice(0, 3).join(", ")}`);
  else if (themeTags.length) reasonParts.push(`Theme: ${themeTags.slice(0, 3).join(", ")}`);
  if (vol >= EARLY_CATCH_MIN_VOLUME_USD) {
    reasonParts.push(`Early volume $${Math.round(vol).toLocaleString()}`);
  }
  if (absChange > 10) reasonParts.push(`Momentum ${change > 0 ? "+" : ""}${change.toFixed(0)}%`);
  if (ageMinutes <= 360) reasonParts.push("Very fresh");
  if (!reasonParts.length) reasonParts.push("Early micro-cap with flow");

  return { score: Math.round(Math.max(0, Math.min(100, score))), tags, reason: reasonParts.join(" · ") };
}

export async function runEarlyCatchScan(opts: {
  maxMarketCapUsd?: number;
  minLiquidityUsd?: number;
  maxAgeMinutes?: number;
  minNarrativeScore?: number;
  minHeatOnlyScore?: number;
  minVolumeUsd?: number;
  minTxns?: number;
  limit?: number;
}): Promise<EarlyCatchResult> {
  const maxMarketCapUsd = opts.maxMarketCapUsd ?? 20_000;
  const minLiquidityUsd = opts.minLiquidityUsd ?? 2_000;
  const maxAgeMinutes = opts.maxAgeMinutes ?? EARLY_CATCH_MAX_AGE_MINUTES;
  const minNarrativeScore = opts.minNarrativeScore ?? EARLY_CATCH_MIN_NARRATIVE_SCORE;
  const minHeatOnlyScore = opts.minHeatOnlyScore ?? EARLY_CATCH_MIN_HEAT_ONLY_SCORE;
  const minVolumeUsd = opts.minVolumeUsd ?? EARLY_CATCH_MIN_VOLUME_USD;
  const minTxns = opts.minTxns ?? EARLY_CATCH_MIN_TXNS;
  const limit = opts.limit ?? 30;

  const [wsPairs, searchPairs, headlines] = await Promise.all([
    getNewSolanaPairsFromWebSocket(10_000).catch(() => [] as DexPair[]),
    fetchSolanaPairsViaSearch(SEARCH_QUERIES).catch(() => [] as DexPair[]),
    fetchGoogleNewsHeadlines("crypto OR meme OR solana OR bitcoin OR trump OR elon", 12).catch(
      () => [] as { title: string }[]
    ),
  ]);

  const headlineTokens = new Set<string>();
  for (const h of headlines) {
    for (const t of tokenize(h.title ?? "")) {
      if (t.length >= 3) headlineTokens.add(t);
    }
  }

  const themeTokens = new Set<string>(NARRATIVE_THEMES.map((t) => t.trim()));

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

    const vol = recentVolume(p);
    const { total: txns } = recentTxns(p);
    // Need real early activity — no idle leftovers
    if (vol < minVolumeUsd && txns < minTxns) continue;

    const { score, tags, reason } = scorePair(p, headlineTokens, themeTokens, ageMinutes);
    const floor = tags.length > 0 ? minNarrativeScore : minHeatOnlyScore;
    if (score < floor) continue;

    coins.push({
      name: p.baseToken.name,
      symbol: p.baseToken.symbol,
      address: p.baseToken.address,
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
