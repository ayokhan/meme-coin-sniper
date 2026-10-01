import {
  getNewSolanaPairs,
  getNewSolanaPairsFromWebSocket,
  getMemeRunnerChainPairs,
  getSurgeChainPairs,
  getSurgeSolanaPairs,
  getTrendingBscPairs,
  getTrendingChainPairs,
  getTrendingRobinhoodPairs,
  getTrendingSolanaPairs,
  type DexPair,
  type SurgeWindow,
} from "@/lib/api-clients/dexscreener";
import { getNewListings } from "@/lib/api-clients/birdeye";
import { getPumpFunNewTokens, type MoralisNewToken } from "@/lib/api-clients/moralis";
import { getFeatureFlag, FEATURE_FLAG_KEYS } from "@/lib/feature-flags";
import {
  filterPairsForGoHuntingView,
  GO_HUNTING_DEX_ALLOWLIST,
  type GoHuntingChain,
  type GoHuntingView,
} from "@/lib/go-hunting-views";
import { normalizeDexId } from "@/lib/meme-runner/launchpads";
import axios from "axios";
import { pairToMemeToken, pairToSurgeToken, type MemeTokenOut } from "@/lib/meme-token-out";

export type GoHuntingTabView = GoHuntingView | "trending" | "surge";
export type GoHuntingChainFilter = GoHuntingChain | "all";
export type GoHuntingRow = MemeTokenOut & { chain: GoHuntingChain; launchpad: string | null };

export const GO_HUNTING_CHAINS: GoHuntingChain[] = ["solana", "bsc", "robinhood", "hyperevm"];
export const GO_HUNTING_TAB_VIEWS: GoHuntingTabView[] = ["new_pairs", "final_stretch", "migrated", "trending", "surge"];

/** Final Stretch only means something where a bonding-curve launchpad exists. */
const FINAL_STRETCH_ALL_CHAINS: GoHuntingChain[] = ["solana", "bsc"];

export function isGoHuntingChain(v: string | null | undefined): v is GoHuntingChain {
  return !!v && (GO_HUNTING_CHAINS as string[]).includes(v);
}

export function isGoHuntingTabView(v: string | null | undefined): v is GoHuntingTabView {
  return !!v && (GO_HUNTING_TAB_VIEWS as string[]).includes(v);
}

export function parseSurgeWindow(raw: string | null | undefined): SurgeWindow {
  const w = (raw || "h24").toLowerCase();
  if (w === "m5" || w === "5m") return "m5";
  if (w === "m15" || w === "15m") return "m15";
  if (w === "m30" || w === "30m") return "m30";
  if (w === "h1" || w === "1h") return "h1";
  if (w === "h6" || w === "6h") return "h6";
  return "h24";
}

function defaultSurgeMinVolume(window: SurgeWindow): number {
  switch (window) {
    case "m5": return 2000;
    case "m15": return 5000;
    case "m30": return 10000;
    case "h1": return 15000;
    default: return 20000;
  }
}

/** Smaller chains trade far less than Solana; scale Surge minimums so they are not always empty. */
const SURGE_MIN_VOLUME_SCALE: Record<GoHuntingChain, number> = {
  solana: 1,
  bsc: 0.5,
  robinhood: 0.15,
  hyperevm: 0.15,
};

const DEX_LABELS: Record<string, string> = {
  pumpfun: "Pump.fun",
  pumpswap: "PumpSwap",
  launchlab: "Bonk",
  bags: "Bags",
  meteoradbc: "Meteora DBC",
  meteora: "Meteora",
  raydium: "Raydium",
  orca: "Orca",
  moonit: "Moonit",
  heaven: "Heaven",
  printr: "Printr",
  fourmeme: "Four.meme",
  pancakeswap: "PancakeSwap",
  biswap: "Biswap",
  apeswap: "ApeSwap",
  thena: "Thena",
  uniswap: "Uniswap",
  hyperswap: "HyperSwap",
  kinetiq: "Kinetiq",
  liquidswap: "LiquidSwap",
  hybra: "Hybra",
  ramses: "Ramses",
};

function prettyDex(dexId: string): string | null {
  const n = normalizeDexId(dexId).replace(/_?v\d$/, "");
  if (!n) return null;
  if (DEX_LABELS[n]) return DEX_LABELS[n];
  for (const [key, label] of Object.entries(DEX_LABELS)) {
    if (n.includes(key)) return label;
  }
  return n.charAt(0).toUpperCase() + n.slice(1);
}

/** Origin launchpad when identifiable (vanity mint suffixes), else the DEX the pair trades on. */
export function launchpadLabelForPair(chain: GoHuntingChain, pair: Pick<DexPair, "dexId" | "baseToken">): string | null {
  const addr = pair.baseToken?.address || "";
  const dex = normalizeDexId(pair.dexId || "");
  if (chain === "solana") {
    if (addr.endsWith("pump") || dex.includes("pumpfun")) return "Pump.fun";
    if (addr.endsWith("bonk") || dex === "launchlab") return "Bonk";
    if (addr.endsWith("BAGS") || dex === "bags") return "Bags";
  }
  if (chain === "bsc" && (addr.toLowerCase().endsWith("4444") || dex.includes("fourmeme"))) return "Four.meme";
  return prettyDex(pair.dexId || "");
}

function withChain(chain: GoHuntingChain, token: MemeTokenOut, pair?: DexPair): GoHuntingRow {
  return {
    ...token,
    id: `${chain}:${token.id}`,
    chain,
    launchpad: pair ? launchpadLabelForPair(chain, pair) : token.launchpad ?? null,
  };
}

function byLaunchDesc(a: { launchedAt: string }, b: { launchedAt: string }): number {
  return new Date(b.launchedAt).getTime() - new Date(a.launchedAt).getTime();
}

function mergePairs(...lists: DexPair[][]): DexPair[] {
  const byKey = new Map<string, DexPair>();
  for (const list of lists) {
    for (const p of list) {
      const key = p.pairAddress || p.baseToken?.address;
      if (key && !byKey.has(key)) byKey.set(key, p);
    }
  }
  return Array.from(byKey.values());
}

function listingToken(input: {
  addr: string;
  idPrefix: string;
  symbol?: string;
  name?: string;
  liquidity: number;
  volume24h?: number | null;
  priceUSD?: number | null;
  launchedAt?: string;
  dexId: string | null;
  launchpad: string | null;
}): MemeTokenOut {
  let score = 0;
  if (input.liquidity >= 50_000) score += 15;
  else if (input.liquidity >= 20_000) score += 10;
  else if (input.liquidity >= 5_000) score += 5;
  if ((input.volume24h ?? 0) >= 20_000) score += 10;
  else if ((input.volume24h ?? 0) >= 5_000) score += 5;
  return {
    id: `${input.idPrefix}${input.addr}`,
    symbol: input.symbol ?? "—",
    name: input.name ?? "—",
    contractAddress: input.addr,
    viralScore: Math.min(50, score),
    liquidity: input.liquidity > 0 ? input.liquidity : null,
    priceUSD: input.priceUSD ?? null,
    pairAddress: null,
    twitter: null,
    telegram: null,
    website: null,
    launchedAt: input.launchedAt ?? new Date().toISOString(),
    volume24h: input.volume24h ?? null,
    txnsBuys24h: null,
    txnsSells24h: null,
    pct5m: null,
    pct1h: null,
    pct6h: null,
    pct24h: null,
    dexId: input.dexId,
    launchpad: input.launchpad,
  };
}

function moralisListingToken(m: MoralisNewToken): MemeTokenOut {
  const liq = m.liquidity != null ? parseFloat(String(m.liquidity)) : 0;
  return listingToken({
    addr: m.tokenAddress,
    idPrefix: "moralis:",
    symbol: m.symbol ?? undefined,
    name: m.name ?? undefined,
    liquidity: liq,
    priceUSD: m.priceUsd != null ? parseFloat(String(m.priceUsd)) : null,
    launchedAt: m.createdAt ? new Date(m.createdAt).toISOString() : undefined,
    dexId: "pumpfun",
    launchpad: "Pump.fun",
  });
}

/** Solana Go Hunting list (WebSocket + search + Birdeye + optional Moralis), newest first. */
export async function fetchSolanaGoHuntingTokens(view: GoHuntingView, maxAgeMinutes: number): Promise<MemeTokenOut[]> {
  const minLiquidity = view === "new_pairs" ? 50 : 300;
  const effectiveMaxAge = view === "new_pairs" ? Math.min(maxAgeMinutes, 240) : Math.min(maxAgeMinutes, 360);
  const moralisGoHunting = view === "new_pairs" && (await getFeatureFlag(FEATURE_FLAG_KEYS.MORALIS_GO_HUNTING));
  const [wsPairs, runnerPairs, legacyPairs, birdeyeListings, moralisListings] = await Promise.all([
    view === "new_pairs" ? getNewSolanaPairsFromWebSocket(10000) : Promise.resolve([]),
    getMemeRunnerChainPairs({
      chain: "solana",
      minLiquidity,
      maxAgeMinutes: effectiveMaxAge,
      allowedDexIds: GO_HUNTING_DEX_ALLOWLIST.solana[view],
      searchQueries: view === "final_stretch" ? ["pump.fun", "pumpfun", "pumpswap"] : ["pump", "raydium", "meme"],
      maxResults: 350,
    }),
    getNewSolanaPairs(minLiquidity, effectiveMaxAge),
    view === "new_pairs" ? getNewListings(30).catch(() => []) : Promise.resolve([]),
    moralisGoHunting ? getPumpFunNewTokens(50).catch(() => []) : Promise.resolve([]),
  ]);

  const pairs = filterPairsForGoHuntingView(mergePairs(wsPairs, runnerPairs, legacyPairs), view, "solana");
  const byKey = new Map<string, MemeTokenOut>();
  for (const pair of pairs) {
    const t = { ...pairToMemeToken(pair), launchpad: launchpadLabelForPair("solana", pair) };
    byKey.set(pair.pairAddress ?? t.contractAddress, t);
  }

  if (view === "new_pairs") {
    const haveContract = new Set(Array.from(byKey.values(), (t) => t.contractAddress));
    for (const b of birdeyeListings) {
      const addr = b.address;
      if (!addr || haveContract.has(addr)) continue;
      haveContract.add(addr);
      byKey.set(
        `birdeye:${addr}`,
        listingToken({
          addr,
          idPrefix: "",
          symbol: b.symbol,
          name: b.name,
          liquidity: b.liquidity ?? 0,
          volume24h: b.v24hUSD ?? null,
          dexId: null,
          launchpad: launchpadLabelForPair("solana", { dexId: "", baseToken: { address: addr, name: "", symbol: "" } }),
        })
      );
    }
    for (const m of moralisListings) {
      const addr = m.tokenAddress;
      if (!addr || haveContract.has(addr)) continue;
      haveContract.add(addr);
      byKey.set(`moralis:${addr}`, moralisListingToken(m));
    }
  }

  return Array.from(byKey.values()).sort(byLaunchDesc);
}

const EVM_SEARCH_QUERIES: Record<Exclude<GoHuntingChain, "solana">, (view: GoHuntingView) => string[]> = {
  bsc: (view) => (view === "final_stretch" ? ["four.meme", "fourmeme", "bsc meme"] : ["pancakeswap", "bsc meme", "new token"]),
  robinhood: () => ["robinhood", "HOOD", "meme", "new token"],
  hyperevm: () => ["hyperevm", "HYPE", "meme", "new token", "hyperswap"],
};

async function fetchEvmGoHuntingPairs(
  chain: Exclude<GoHuntingChain, "solana">,
  view: GoHuntingView,
  maxAgeMinutes: number
): Promise<DexPair[]> {
  const effectiveMaxAge = view === "new_pairs" ? Math.min(maxAgeMinutes, 180) : Math.min(maxAgeMinutes, 360);
  const pairs = await getMemeRunnerChainPairs({
    chain,
    minLiquidity: view === "new_pairs" ? 100 : 300,
    maxAgeMinutes: effectiveMaxAge,
    allowedDexIds: GO_HUNTING_DEX_ALLOWLIST[chain][view],
    searchQueries: EVM_SEARCH_QUERIES[chain](view),
    maxResults: 350,
  });
  return filterPairsForGoHuntingView(pairs, view, chain).sort((a, b) => {
    const ta = a.pairCreatedAt < 1e12 ? a.pairCreatedAt * 1000 : a.pairCreatedAt;
    const tb = b.pairCreatedAt < 1e12 ? b.pairCreatedAt * 1000 : b.pairCreatedAt;
    return tb - ta;
  });
}

async function fetchTrendingPairs(chain: GoHuntingChain): Promise<DexPair[]> {
  if (chain === "solana") return getTrendingSolanaPairs(80);
  if (chain === "bsc") return getTrendingBscPairs(80);
  if (chain === "robinhood") return getTrendingRobinhoodPairs(80);
  return getTrendingChainPairs({
    chain,
    allowedDexIds: GO_HUNTING_DEX_ALLOWLIST.hyperevm.new_pairs,
    minLiquidity: 1000,
    minVolume24h: 2000,
    limit: 80,
  });
}

async function fetchSurgePairs(chain: GoHuntingChain, window: SurgeWindow): Promise<DexPair[]> {
  const minVolume = Math.round(defaultSurgeMinVolume(window) * SURGE_MIN_VOLUME_SCALE[chain]);
  if (chain === "solana") return getSurgeSolanaPairs(window, minVolume, 80);
  return getSurgeChainPairs({
    chain,
    window,
    minVolume,
    allowedDexIds: GO_HUNTING_DEX_ALLOWLIST[chain].new_pairs,
    minLiquidity: 1000,
    limit: 80,
  });
}

const SOLANA_MAX_AGE_MINUTES = 180;
const EVM_MAX_AGE_MINUTES = 120;
const ROW_CACHE_TTL_MS = 45_000;
const rowCache = new Map<string, { at: number; rows: Promise<GoHuntingRow[]> }>();

async function loadChainRows(chain: GoHuntingChain, view: GoHuntingTabView, window: SurgeWindow): Promise<GoHuntingRow[]> {
  if (view === "trending") {
    return (await fetchTrendingPairs(chain)).map((p) => withChain(chain, pairToMemeToken(p), p));
  }
  if (view === "surge") {
    return (await fetchSurgePairs(chain, window)).map((p) => withChain(chain, pairToSurgeToken(p), p));
  }
  if (chain === "solana") {
    return (await fetchSolanaGoHuntingTokens(view, SOLANA_MAX_AGE_MINUTES)).map((t) => withChain("solana", t));
  }
  return (await fetchEvmGoHuntingPairs(chain, view, EVM_MAX_AGE_MINUTES)).map((p) =>
    withChain(chain, pairToMemeToken(p), p)
  );
}

/** One chain's rows for a view; cached briefly per instance so chain/view switching and concurrent users share work. */
export function getChainRows(chain: GoHuntingChain, view: GoHuntingTabView, window: SurgeWindow): Promise<GoHuntingRow[]> {
  const key = `${chain}:${view}:${view === "surge" ? window : ""}`;
  const now = Date.now();
  const hit = rowCache.get(key);
  if (hit && now - hit.at < ROW_CACHE_TTL_MS) return hit.rows;
  const rows = loadChainRows(chain, view, window).catch(() => {
    rowCache.delete(key);
    return [] as GoHuntingRow[];
  });
  rowCache.set(key, { at: now, rows });
  return rows;
}

/** DexScreener /tokens/v1 accepts up to 30 addresses per call. */
async function fetchPairsForAddresses(chain: GoHuntingChain, addresses: string[]): Promise<DexPair[]> {
  const batches: string[][] = [];
  for (let i = 0; i < addresses.length; i += 30) batches.push(addresses.slice(i, i + 30));
  const results = await Promise.all(
    batches.map((batch) =>
      axios
        .get<DexPair[] | { pairs?: DexPair[] }>(`https://api.dexscreener.com/tokens/v1/${chain}/${batch.join(",")}`, {
          timeout: 15000,
        })
        .then((res) => (Array.isArray(res.data) ? res.data : res.data?.pairs ?? []))
        .catch(() => [] as DexPair[])
    )
  );
  return results.flat();
}

export type WatchlistRequestItem = { chain: GoHuntingChain; address: string; symbol?: string; name?: string };

/** Live rows for watched coins (most liquid pair per token); coins DexScreener no longer lists keep a bare row so they can be removed. */
export async function fetchWatchlistRows(items: WatchlistRequestItem[]): Promise<GoHuntingRow[]> {
  const byChain = new Map<GoHuntingChain, WatchlistRequestItem[]>();
  for (const it of items) byChain.set(it.chain, [...(byChain.get(it.chain) ?? []), it]);
  const perChain = await Promise.all(
    [...byChain.entries()].map(async ([chain, list]) => {
      const pairs = await fetchPairsForAddresses(chain, list.map((i) => i.address));
      const norm = (a: string) => (chain === "solana" ? a : a.toLowerCase());
      const best = new Map<string, DexPair>();
      for (const p of pairs) {
        const key = norm(p.baseToken?.address || "");
        const cur = best.get(key);
        if (!cur || (p.liquidity?.usd ?? 0) > (cur.liquidity?.usd ?? 0)) best.set(key, p);
      }
      return list.map((it): GoHuntingRow => {
        const pair = best.get(norm(it.address));
        if (pair) return withChain(chain, pairToMemeToken(pair), pair);
        return withChain(
          chain,
          listingToken({
            addr: it.address,
            idPrefix: "watch:",
            symbol: it.symbol,
            name: it.name,
            liquidity: 0,
            dexId: null,
            launchpad: null,
          })
        );
      });
    })
  );
  return perChain.flat();
}

export function chainsForView(view: GoHuntingTabView, filter: GoHuntingChainFilter): GoHuntingChain[] {
  if (filter !== "all") return [filter];
  return view === "final_stretch" ? FINAL_STRETCH_ALL_CHAINS : GO_HUNTING_CHAINS;
}

function interleave(lists: GoHuntingRow[][], limit: number): GoHuntingRow[] {
  const out: GoHuntingRow[] = [];
  const longest = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < longest && out.length < limit; i++) {
    for (const list of lists) {
      if (i < list.length) out.push(list[i]);
      if (out.length >= limit) break;
    }
  }
  return out;
}

/**
 * Merge per-chain lists so Solana's volume does not crowd out other chains:
 * listing views cap each chain at half the limit then sort newest first; ranked views (trending/surge) round-robin by rank.
 */
export function mergeChainRows(view: GoHuntingTabView, perChain: GoHuntingRow[][], limit: number): GoHuntingRow[] {
  if (perChain.length === 1) return perChain[0].slice(0, limit);
  if (view === "trending" || view === "surge") return interleave(perChain, limit);
  const perChainCap = Math.ceil(limit / 2);
  return perChain
    .flatMap((rows) => rows.slice(0, perChainCap))
    .sort(byLaunchDesc)
    .slice(0, limit);
}