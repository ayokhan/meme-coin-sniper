/**
 * Narrative Scanner: clusters fresh DexScreener pairs + headlines
 * into actionable narrative themes via Claude.
 */

import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_SONNET_MODEL } from "@/lib/anthropic-models";
import axios from "axios";
import {
  type DexPair,
  getMemeRunnerChainPairs,
  getNewSolanaPairsFromWebSocket,
  getVolumeForWindow,
  type SurgeWindow,
} from "@/lib/api-clients/dexscreener";
import { GO_HUNTING_DEX_ALLOWLIST } from "@/lib/go-hunting-views";
import { fetchGoogleNewsHeadlines } from "@/lib/nova-crypto-narratives";

export type NarrativeTimeframe = "5m" | "15m" | "30m" | "1h" | "4h" | "daily" | "weekly";
export type NarrativeChain = "robinhood" | "hyperevm" | "solana" | "bsc" | "all";

export const NARRATIVE_CHAINS: { id: NarrativeChain; label: string }[] = [
  { id: "robinhood", label: "Robinhood" },
  { id: "hyperevm", label: "HyperEVM" },
  { id: "solana", label: "Solana" },
  { id: "bsc", label: "BSC" },
  { id: "all", label: "All chains" },
];

export type NarrativeItem = {
  name: string;
  heat: number; // 0-100
  direction: "rising" | "peaking" | "fading";
  coinCount: number;
  topCoins: { name: string; symbol: string; address: string; chain: string; volumeUsd: number; priceChange24h: number }[];
  keywords: string[];
  summary: string;
};

export type NarrativeScanResult = {
  timeframe: NarrativeTimeframe;
  chain: NarrativeChain;
  narratives: NarrativeItem[];
  scannedAt: string;
  pairsScanned: number;
  aiGenerated: boolean;
};

function minutesForTimeframe(tf: NarrativeTimeframe): number {
  if (tf === "5m") return 5;
  if (tf === "15m") return 15;
  if (tf === "30m") return 30;
  if (tf === "1h") return 60;
  if (tf === "4h") return 240;
  if (tf === "daily") return 1440;
  return 10080;
}

function surgeWindowFor(tf: NarrativeTimeframe): SurgeWindow {
  if (tf === "5m") return "m5";
  if (tf === "15m") return "m15";
  if (tf === "30m") return "m30";
  if (tf === "1h") return "h1";
  if (tf === "4h") return "h6";
  return "h24";
}

function isShortTf(tf: NarrativeTimeframe): boolean {
  return tf === "5m" || tf === "15m" || tf === "30m" || tf === "1h";
}

function pairCreatedMs(p: DexPair): number {
  const created = p.pairCreatedAt ?? 0;
  return created < 1e12 ? created * 1000 : created;
}

function windowVolume(p: DexPair, tf: NarrativeTimeframe): number {
  return getVolumeForWindow(p, surgeWindowFor(tf));
}

function windowChange(p: DexPair, tf: NarrativeTimeframe): number {
  if (tf === "5m") return p.priceChange?.m5 ?? p.priceChange?.h1 ?? 0;
  if (tf === "15m" || tf === "30m" || tf === "1h") return p.priceChange?.h1 ?? p.priceChange?.m5 ?? 0;
  if (tf === "4h") return p.priceChange?.h6 ?? p.priceChange?.h1 ?? p.priceChange?.h24 ?? 0;
  return p.priceChange?.h24 ?? 0;
}

function recentTxnCount(p: DexPair): number {
  const h1 = p.txns?.h1;
  const h6 = p.txns?.h6;
  const h24 = p.txns?.h24;
  if (h1) return (h1.buys ?? 0) + (h1.sells ?? 0);
  if (h6) return (h6.buys ?? 0) + (h6.sells ?? 0);
  if (h24) return (h24.buys ?? 0) + (h24.sells ?? 0);
  return 0;
}

/** Drop rugs / dead pools: need liquidity + recent flow. */
function isAlivePair(p: DexPair, tf: NarrativeTimeframe): boolean {
  const liq = p.liquidity?.usd ?? 0;
  const vol = windowVolume(p, tf);
  const txns = recentTxnCount(p);
  const change = windowChange(p, tf);

  const minLiq = isShortTf(tf) ? 1500 : 3000;
  const minVol =
    tf === "5m" ? 200 :
    tf === "15m" ? 500 :
    tf === "30m" ? 1000 :
    tf === "1h" ? 2000 :
    tf === "4h" ? 5000 :
    8000;

  if (liq < minLiq) return false;
  if (vol < minVol && txns < 8) return false;
  if (change <= -70 && txns < 20) return false;
  return true;
}

function filterPairsForTimeframe(pairs: DexPair[], tf: NarrativeTimeframe): DexPair[] {
  const maxAgeMin = minutesForTimeframe(tf);
  const ageSlack = isShortTf(tf) ? Math.max(maxAgeMin, Math.min(maxAgeMin * 2, 90)) : maxAgeMin;
  const cutoff = Date.now() - ageSlack * 60 * 1000;

  return pairs
    .filter((p) => {
      const created = pairCreatedMs(p);
      if (!created || created < cutoff) return false;
      return isAlivePair(p, tf);
    })
    .sort((a, b) => windowVolume(b, tf) - windowVolume(a, tf));
}

function buildPairSummaries(pairs: DexPair[], tf: NarrativeTimeframe, limit = 120): string {
  return pairs
    .slice(0, limit)
    .map((p) => {
      const vol = windowVolume(p, tf);
      const change = windowChange(p, tf);
      const ageMin = Math.max(0, Math.round((Date.now() - pairCreatedMs(p)) / 60000));
      const liq = Math.round(p.liquidity?.usd ?? 0);
      return `${p.baseToken.name} (${p.baseToken.symbol}) | chain:${p.chainId} | age:${ageMin}m | liq:$${liq} | vol:$${Math.round(vol).toLocaleString()} | chg:${change > 0 ? "+" : ""}${change.toFixed(1)}% | addr:${p.baseToken.address}`;
    })
    .join("\n");
}

const CHAIN_ALIASES: Record<string, string[]> = {
  solana: ["solana"],
  bsc: ["bsc", "bnb"],
  robinhood: ["robinhood"],
  hyperevm: ["hyperevm"],
};

function chainMatches(pairChain: string, target: NarrativeChain): boolean {
  const c = (pairChain || "").toLowerCase();
  if (target === "all") return true;
  const allowed = CHAIN_ALIASES[target] ?? [target];
  return allowed.some((a) => c === a || c.includes(a));
}

function filterPairsByChain(pairs: DexPair[], chain: NarrativeChain): DexPair[] {
  if (chain === "all") return pairs;
  return pairs.filter((p) => chainMatches(p.chainId || "", chain));
}

async function quickDexSearch(queries: string[], chains: NarrativeChain[]): Promise<DexPair[]> {
  const seen = new Set<string>();
  const all: DexPair[] = [];
  const allowedChains = chains.includes("all")
    ? ["solana", "bsc", "bnb", "robinhood", "hyperevm"]
    : chains.flatMap((c) => CHAIN_ALIASES[c] ?? [c]);

  const results = await Promise.allSettled(
    queries.map((q) =>
      axios.get<{ pairs?: DexPair[] }>("https://api.dexscreener.com/latest/dex/search", {
        params: { q },
        timeout: 8000,
      })
    )
  );
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    for (const p of r.value.data?.pairs ?? []) {
      const chain = (p.chainId || "").toLowerCase();
      if (!allowedChains.some((a) => chain === a || chain.includes(a))) continue;
      if (seen.has(p.pairAddress)) continue;
      seen.add(p.pairAddress);
      all.push(p);
    }
  }
  return all;
}

async function fetchLatestProfilePairs(chains: NarrativeChain[]): Promise<DexPair[]> {
  const allowedChains = chains.includes("all")
    ? ["solana", "bsc", "bnb", "robinhood", "hyperevm"]
    : chains.flatMap((c) => CHAIN_ALIASES[c] ?? [c]);

  try {
    const [profiles, boosts] = await Promise.all([
      axios.get<{ chainId?: string; tokenAddress?: string }[]>("https://api.dexscreener.com/token-profiles/latest/v1", { timeout: 7000 }).catch(() => ({ data: [] })),
      axios.get<{ chainId?: string; tokenAddress?: string }[]>("https://api.dexscreener.com/token-boosts/latest/v1", { timeout: 7000 }).catch(() => ({ data: [] })),
    ]);
    const addrs = new Map<string, string>();
    for (const row of [...(profiles.data ?? []), ...(boosts.data ?? [])]) {
      const chain = (row.chainId || "").toLowerCase();
      if (!allowedChains.some((a) => chain === a || chain.includes(a))) continue;
      if (!row.tokenAddress) continue;
      addrs.set(row.tokenAddress, chain);
    }
    const list = [...addrs.keys()].slice(0, 30);
    if (list.length === 0) return [];
    const res = await axios.get<{ pairs?: DexPair[] }>(
      `https://api.dexscreener.com/latest/dex/tokens/${list.join(",")}`,
      { timeout: 8000 }
    );
    return res.data?.pairs ?? [];
  } catch {
    return [];
  }
}

function ageSlackMinutes(tf: NarrativeTimeframe): number {
  const maxAgeMin = minutesForTimeframe(tf);
  return isShortTf(tf) ? Math.max(maxAgeMin, Math.min(maxAgeMin * 2, 90)) : maxAgeMin;
}

async function fetchMemeRunnerPairs(chain: "robinhood" | "hyperevm", tf: NarrativeTimeframe): Promise<DexPair[]> {
  const dexAllow = GO_HUNTING_DEX_ALLOWLIST[chain].new_pairs;
  return getMemeRunnerChainPairs({
    chain,
    minLiquidity: isShortTf(tf) ? 100 : 300,
    maxAgeMinutes: ageSlackMinutes(tf),
    allowedDexIds: dexAllow,
    searchQueries:
      chain === "robinhood"
        ? ["robinhood", "HOOD", "meme", "new token"]
        : ["hyperevm", "hyperliquid", "meme", "new token"],
    maxResults: 350,
  });
}

async function fetchFreshPairs(tf: NarrativeTimeframe, chain: NarrativeChain): Promise<DexPair[]> {
  const seen = new Set<string>();
  const all: DexPair[] = [];
  const push = (pairs: DexPair[]) => {
    for (const p of pairs) {
      if (!p?.pairAddress || seen.has(p.pairAddress)) continue;
      seen.add(p.pairAddress);
      all.push(p);
    }
  };

  const chainsToFetch: NarrativeChain[] =
    chain === "all" ? ["robinhood", "hyperevm", "solana", "bsc"] : [chain];

  const fetches: Promise<DexPair[]>[] = [];

  for (const c of chainsToFetch) {
    if (c === "robinhood" || c === "hyperevm") {
      fetches.push(fetchMemeRunnerPairs(c, tf).catch(() => [] as DexPair[]));
    }
  }

  const needsSolanaWs = chainsToFetch.includes("solana") || chain === "all";
  const needsProfiles = chainsToFetch.some((c) => c === "solana" || c === "bsc" || c === "all");
  const needsSearch = chainsToFetch.some((c) => c === "solana" || c === "bsc" || c === "all");

  if (needsSolanaWs) {
    const wsTimeout = isShortTf(tf) ? 7000 : 9000;
    fetches.push(getNewSolanaPairsFromWebSocket(wsTimeout).catch(() => [] as DexPair[]));
  }

  if (needsProfiles) {
    fetches.push(fetchLatestProfilePairs(chainsToFetch).catch(() => [] as DexPair[]));
  }

  if (needsSearch) {
    const searchQueries = isShortTf(tf)
      ? chain === "bsc"
        ? ["bsc", "fourmeme", "meme"]
        : chain === "solana"
          ? ["solana", "pump"]
          : ["solana", "pump", "bsc", "robinhood", "hyperevm"]
      : chain === "bsc"
        ? ["meme coin", "bsc", "PEPE"]
        : chain === "solana"
          ? ["meme coin", "pump", "solana"]
          : ["meme coin", "pump", "solana", "bsc", "robinhood", "hyperevm", "PEPE"];
    fetches.push(quickDexSearch(searchQueries, chainsToFetch).catch(() => [] as DexPair[]));
  }

  const results = await Promise.all(fetches);
  for (const batch of results) push(batch);

  return filterPairsByChain(all, chain);
}

export function parseNarrativeChain(value: unknown): NarrativeChain {
  const v = String(value ?? "").toLowerCase();
  if (v === "robinhood" || v === "hyperevm" || v === "solana" || v === "bsc" || v === "all") {
    return v;
  }
  return "robinhood";
}

export async function runNarrativeScan(
  timeframe: NarrativeTimeframe,
  chain: NarrativeChain = "robinhood"
): Promise<NarrativeScanResult> {
  const wantHeadlines = !isShortTf(timeframe);

  const [pairs, headlines] = await Promise.all([
    fetchFreshPairs(timeframe, chain),
    wantHeadlines
      ? fetchGoogleNewsHeadlines("crypto meme coin trending", 12).catch(() => [])
      : Promise.resolve([] as { title: string }[]),
  ]);

  const filtered = filterPairsForTimeframe(pairs, timeframe);
  const working = filtered.length > 0
    ? filtered
    : (!isShortTf(timeframe)
        ? pairs.filter((p) => isAlivePair(p, timeframe)).sort((a, b) => windowVolume(b, timeframe) - windowVolume(a, timeframe)).slice(0, 100)
        : []);

  const pairText = buildPairSummaries(working, timeframe, isShortTf(timeframe) ? 80 : 120);

  const headlinesText = headlines
    .slice(0, 10)
    .map((h) => h.title)
    .join("\n");

  const tfLabels: Record<NarrativeTimeframe, string> = {
    "5m": "last 5 minutes",
    "15m": "last 15 minutes",
    "30m": "last 30 minutes",
    "1h": "last 1 hour",
    "4h": "last 4 hours",
    daily: "last 24 hours",
    weekly: "last 7 days",
  };
  const chainLabel =
    chain === "all"
      ? "all supported chains"
      : chain === "robinhood"
        ? "Robinhood Chain"
        : chain === "hyperevm"
          ? "HyperEVM"
          : chain.toUpperCase();
  const timeframeLabel = tfLabels[timeframe];

  if (working.length === 0) {
    return {
      timeframe,
      chain,
      narratives: [],
      scannedAt: new Date().toISOString(),
      pairsScanned: 0,
      aiGenerated: false,
    };
  }

  const prompt = `You are a meme coin narrative analyst. Identify LIVE narratives from FRESH launches only.

CHAIN: ${chainLabel}
TIMEFRAME: ${timeframeLabel}
IMPORTANT: Prefer coins that are young and still moving. Ignore dead/rugged names. Cluster by theme from token NAMES/SYMBOLS.

COINS (name | symbol | chain | age | liquidity | window vol | change | address):
${pairText}

${headlinesText ? `HEADLINES:\n${headlinesText}` : ""}

Return 4-8 narratives as ONLY a JSON array:
{
  "name": "string",
  "heat": number,
  "direction": "rising"|"peaking"|"fading",
  "coinCount": number,
  "topCoins": [{"name":"string","symbol":"string","address":"string","chain":"string","volumeUsd":number,"priceChange24h":number}],
  "keywords": ["string"],
  "summary": "string"
}
Sort by heat desc. No markdown.`;

  const client = new Anthropic();
  const msg = await client.messages.create({
    model: CLAUDE_SONNET_MODEL,
    max_tokens: isShortTf(timeframe) ? 2500 : 3500,
    messages: [{ role: "user", content: prompt }],
  });

  const text = msg.content[0]?.type === "text" ? msg.content[0].text : "";

  let narratives: NarrativeItem[] = [];
  try {
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      narratives = parsed.map((item: Record<string, unknown>) => ({
        name: String(item.name ?? "Unknown"),
        heat: Math.min(100, Math.max(0, Number(item.heat) || 0)),
        direction: (["rising", "peaking", "fading"].includes(item.direction as string)
          ? item.direction
          : "rising") as "rising" | "peaking" | "fading",
        coinCount: Number(item.coinCount) || 0,
        topCoins: Array.isArray(item.topCoins)
          ? (item.topCoins as Record<string, unknown>[]).slice(0, 5).map((c) => ({
              name: String(c.name ?? ""),
              symbol: String(c.symbol ?? ""),
              address: String(c.address ?? ""),
              chain: String(c.chain ?? "solana"),
              volumeUsd: Number(c.volumeUsd) || 0,
              priceChange24h: Number(c.priceChange24h) || 0,
            }))
          : [],
        keywords: Array.isArray(item.keywords) ? (item.keywords as string[]).slice(0, 4) : [],
        summary: String(item.summary ?? ""),
      }));
    }
  } catch {
    // AI returned non-JSON; return empty
  }

  narratives.sort((a, b) => b.heat - a.heat);

  return {
    timeframe,
    chain,
    narratives,
    scannedAt: new Date().toISOString(),
    pairsScanned: working.length,
    aiGenerated: narratives.length > 0,
  };
}
