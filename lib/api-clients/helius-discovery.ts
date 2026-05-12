/**
 * Smart-money wallet discovery using only free APIs.
 *
 * Pipeline:
 *   1. Pull trending Solana pairs from Dexscreener (no key).
 *   2. For each winning meme mint, call Helius RPC `getTokenLargestAccounts` (free)
 *      to get the top SPL token-account holders of that mint.
 *   3. Resolve token-account → owner wallet via `getMultipleAccounts` (jsonParsed).
 *   4. Aggregate across multiple winning mints: wallets that appear as top holders of
 *      2+ trending meme tokens are surfaced as smart-money candidates.
 *   5. Filter out the tracked wallets we already have, known program/burn addresses,
 *      and obvious bots / market-makers.
 */

import { getTrendingSolanaPairs, type DexPair } from "./dexscreener";

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const HELIUS_RPC = HELIUS_API_KEY
  ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
  : null;

// Known program / pool / well-known SOL addresses we never want as candidates.
const DENY_OWNERS = new Set<string>([
  // System program
  "11111111111111111111111111111111",
  // SPL Token program
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  // Raydium AMM authority
  "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1",
  // Pump.fun program
  "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",
  // Common burn account
  "1nc1nerator11111111111111111111111111111111",
]);

const STABLE_OR_WRAPPED_MINTS = new Set<string>([
  "So11111111111111111111111111111111111111112", // wSOL
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
]);

type LargestAccount = {
  address: string;
  uiAmount?: number;
  amount?: string;
  decimals?: number;
};

async function helRpc<T>(method: string, params: unknown[]): Promise<T | null> {
  if (!HELIUS_RPC) return null;
  try {
    const res = await fetch(HELIUS_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ jsonrpc: "2.0", id: method, method, params }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { result?: T; error?: { message?: string } };
    if (data.error) return null;
    return data.result ?? null;
  } catch {
    return null;
  }
}

async function getTopHoldersOfMint(mint: string, take = 20): Promise<LargestAccount[]> {
  const res = await helRpc<{ value?: Array<{ address: string; amount?: string; decimals?: number; uiAmount?: number; uiAmountString?: string }> }>(
    "getTokenLargestAccounts",
    [mint, { commitment: "confirmed" }],
  );
  const items = res?.value ?? [];
  return items.slice(0, take).map((it) => ({
    address: it.address,
    amount: it.amount,
    decimals: it.decimals,
    uiAmount: it.uiAmount,
  }));
}

/** Resolve a batch (≤100) of token-account addresses to their owner wallets. Returns map: tokenAccount → owner. */
async function resolveTokenAccountOwners(tokenAccounts: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (tokenAccounts.length === 0) return out;
  // getMultipleAccounts supports up to 100 keys per call.
  const chunks: string[][] = [];
  for (let i = 0; i < tokenAccounts.length; i += 100) chunks.push(tokenAccounts.slice(i, i + 100));
  for (const c of chunks) {
    const res = await helRpc<{ value?: Array<null | { data?: { parsed?: { info?: { owner?: string } } } }> }>(
      "getMultipleAccounts",
      [c, { encoding: "jsonParsed" }],
    );
    const value = res?.value ?? [];
    for (let i = 0; i < c.length; i += 1) {
      const owner = value[i]?.data?.parsed?.info?.owner;
      if (owner) out.set(c[i], owner);
    }
  }
  return out;
}

export type SmartMoneyCandidate = {
  walletAddress: string;
  appearances: number;
  mints: Array<{ mint: string; symbol?: string; name?: string }>;
  totalLiquidityScore: number;
};

export type DiscoveryResult = {
  candidates: SmartMoneyCandidate[];
  pairsScanned: number;
  ownersResolved: number;
  trendingSnapshot: Array<{ mint: string; symbol?: string; name?: string; liquidityUsd: number; volume24hUsd: number; priceChange24h: number | null }>;
};

export type DiscoverOptions = {
  maxPairs?: number;
  minLiquidityUsd?: number;
  minVolume24hUsd?: number;
  holdersPerMint?: number;
  excludeAddresses?: Set<string>;
};

/** Discover candidate smart-money wallets from trending Solana meme pairs. Free APIs only. */
export async function discoverSmartMoneyCandidates(opts: DiscoverOptions = {}): Promise<DiscoveryResult> {
  if (!HELIUS_RPC) {
    return { candidates: [], pairsScanned: 0, ownersResolved: 0, trendingSnapshot: [] };
  }

  const maxPairs = opts.maxPairs ?? 8;
  const minLiq = opts.minLiquidityUsd ?? 25_000;
  const minVol = opts.minVolume24hUsd ?? 50_000;
  const holdersPerMint = Math.min(Math.max(opts.holdersPerMint ?? 20, 5), 30);
  const excluded = opts.excludeAddresses ?? new Set<string>();

  const trending = await getTrendingSolanaPairs(60);
  const meme: DexPair[] = trending.filter((p) => {
    const mint = p.baseToken?.address;
    if (!mint || STABLE_OR_WRAPPED_MINTS.has(mint)) return false;
    if ((p.liquidity?.usd ?? 0) < minLiq) return false;
    if ((p.volume?.h24 ?? 0) < minVol) return false;
    return true;
  }).slice(0, maxPairs);

  const trendingSnapshot = meme.map((p) => ({
    mint: p.baseToken?.address ?? "",
    symbol: p.baseToken?.symbol,
    name: p.baseToken?.name,
    liquidityUsd: p.liquidity?.usd ?? 0,
    volume24hUsd: p.volume?.h24 ?? 0,
    priceChange24h: p.priceChange?.h24 ?? null,
  }));

  // For each meme: get top holder token accounts, then resolve to owner wallets.
  const tally = new Map<string, { appearances: number; mints: Map<string, { symbol?: string; name?: string }>; liquidityScore: number }>();
  let ownersResolved = 0;

  for (const p of meme) {
    const mint = p.baseToken?.address;
    if (!mint) continue;
    const liquidity = p.liquidity?.usd ?? 0;
    const holders = await getTopHoldersOfMint(mint, holdersPerMint);
    if (holders.length === 0) continue;
    const ownerMap = await resolveTokenAccountOwners(holders.map((h) => h.address));
    if (ownerMap.size === 0) continue;
    const seenOwnersForMint = new Set<string>();
    for (const ta of holders) {
      const owner = ownerMap.get(ta.address);
      if (!owner) continue;
      if (DENY_OWNERS.has(owner)) continue;
      if (excluded.has(owner)) continue;
      if (seenOwnersForMint.has(owner)) continue; // dedupe per-mint
      seenOwnersForMint.add(owner);
      ownersResolved += 1;
      const cur = tally.get(owner) ?? { appearances: 0, mints: new Map(), liquidityScore: 0 };
      cur.appearances += 1;
      cur.mints.set(mint, { symbol: p.baseToken?.symbol, name: p.baseToken?.name });
      cur.liquidityScore += liquidity;
      tally.set(owner, cur);
    }
  }

  const candidates: SmartMoneyCandidate[] = Array.from(tally.entries())
    .filter(([, v]) => v.appearances >= 2) // must appear as top holder of ≥2 trending memes
    .map(([walletAddress, v]) => ({
      walletAddress,
      appearances: v.appearances,
      mints: Array.from(v.mints.entries()).map(([mint, m]) => ({ mint, symbol: m.symbol, name: m.name })),
      totalLiquidityScore: v.liquidityScore,
    }))
    .sort((a, b) => b.appearances - a.appearances || b.totalLiquidityScore - a.totalLiquidityScore)
    .slice(0, 25);

  return {
    candidates,
    pairsScanned: meme.length,
    ownersResolved,
    trendingSnapshot,
  };
}
