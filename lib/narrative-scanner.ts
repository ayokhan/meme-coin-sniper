/**
 * Narrative Scanner: clusters fresh DexScreener pairs + headlines
 * into actionable narrative themes via Claude.
 */

import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_SONNET_MODEL } from "@/lib/anthropic-models";
import axios from "axios";
import {
  type DexPair,
  getNewSolanaPairsFromWebSocket,
  getVolumeForWindow,
  type SurgeWindow,
} from "@/lib/api-clients/dexscreener";
import { fetchGoogleNewsHeadlines } from "@/lib/nova-crypto-narratives";

export type NarrativeTimeframe = "5m" | "15m" | "30m" | "1h" | "4h" | "daily" | "weekly";

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
  // Hard dumps with no buy flow look dead
  if (change <= -70 && txns < 20) return false;
  return true;
}

function filterPairsForTimeframe(pairs: DexPair[], tf: NarrativeTimeframe): DexPair[] {
  const maxAgeMin = minutesForTimeframe(tf);
  // Short windows: allow a little slack so we still get a usable sample
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

async function quickDexSearch(queries: string[]): Promise<DexPair[]> {
  const seen = new Set<string>();
  const all: DexPair[] = [];
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
      if (chain !== "solana" && chain !== "bsc" && chain !== "bnb") continue;
      if (seen.has(p.pairAddress)) continue;
      seen.add(p.pairAddress);
      all.push(p);
    }
  }
  return all;
}

/** HTTP source of recently profiled/boosted tokens (works on serverless without WS). */
async function fetchLatestProfilePairs(): Promise<DexPair[]> {
  try {
    const [profiles, boosts] = await Promise.all([
      axios.get<{ chainId?: string; tokenAddress?: string }[]>("https://api.dexscreener.com/token-profiles/latest/v1", { timeout: 7000 }).catch(() => ({ data: [] })),
      axios.get<{ chainId?: string; tokenAddress?: string }[]>("https://api.dexscreener.com/token-boosts/latest/v1", { timeout: 7000 }).catch(() => ({ data: [] })),
    ]);
    const addrs = new Map<string, string>(); // address -> chain
    for (const row of [...(profiles.data ?? []), ...(boosts.data ?? [])]) {
      const chain = (row.chainId || "").toLowerCase();
      if (chain !== "solana" && chain !== "bsc" && chain !== "bnb") continue;
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

async function fetchFreshPairs(tf: NarrativeTimeframe): Promise<DexPair[]> {
  const seen = new Set<string>();
  const all: DexPair[] = [];
  const push = (pairs: DexPair[]) => {
    for (const p of pairs) {
      if (!p?.pairAddress || seen.has(p.pairAddress)) continue;
      seen.add(p.pairAddress);
      all.push(p);
    }
  };

  // Newest Solana pairs (WS) + latest profiles (HTTP) + light search
  const wsTimeout = isShortTf(tf) ? 7000 : 9000;
  const [wsPairs, profilePairs, searchPairs] = await Promise.all([
    getNewSolanaPairsFromWebSocket(wsTimeout).catch(() => [] as DexPair[]),
    fetchLatestProfilePairs().catch(() => [] as DexPair[]),
    quickDexSearch(
      isShortTf(tf)
        ? ["solana", "pump", "bsc"]
        : ["meme coin", "pump", "solana", "bsc", "PEPE"]
    ).catch(() => [] as DexPair[]),
  ]);

  push(wsPairs);
  push(profilePairs);
  push(searchPairs);
  return all;
}

export async function runNarrativeScan(timeframe: NarrativeTimeframe): Promise<NarrativeScanResult> {
  const wantHeadlines = !isShortTf(timeframe); // skip news on ultra-short windows (speed)

  const [pairs, headlines] = await Promise.all([
    fetchFreshPairs(timeframe),
    wantHeadlines
      ? fetchGoogleNewsHeadlines("crypto meme coin trending", 12).catch(() => [])
      : Promise.resolve([] as { title: string }[]),
  ]);

  const filtered = filterPairsForTimeframe(pairs, timeframe);
  // Never dump stale pairs into a short scan — better empty than dead coins
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
  const timeframeLabel = tfLabels[timeframe];

  if (working.length === 0) {
    return {
      timeframe,
      narratives: [],
      scannedAt: new Date().toISOString(),
      pairsScanned: 0,
      aiGenerated: false,
    };
  }

  const prompt = `You are a meme coin narrative analyst. Identify LIVE narratives from FRESH launches only.

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
    narratives,
    scannedAt: new Date().toISOString(),
    pairsScanned: working.length,
    aiGenerated: narratives.length > 0,
  };
}
