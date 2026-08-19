/**
 * Narrative Scanner: clusters DexScreener new-pair names + Google Trends
 * into actionable narrative themes via Claude.
 */

import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_SONNET_MODEL } from "@/lib/anthropic-models";
import axios from "axios";
import { type DexPair } from "@/lib/api-clients/dexscreener";
import { fetchGoogleNewsHeadlines } from "@/lib/nova-crypto-narratives";

export type NarrativeTimeframe = "4h" | "daily" | "weekly";

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

function hoursForTimeframe(tf: NarrativeTimeframe): number {
  if (tf === "4h") return 4;
  if (tf === "daily") return 24;
  return 168;
}

function filterPairsByAge(pairs: DexPair[], maxAgeHours: number): DexPair[] {
  const cutoff = Date.now() - maxAgeHours * 60 * 60 * 1000;
  return pairs.filter((p) => {
    const created = p.pairCreatedAt < 1e12 ? p.pairCreatedAt * 1000 : p.pairCreatedAt;
    return created >= cutoff;
  });
}

function buildPairSummaries(pairs: DexPair[], limit = 200): string {
  const sorted = [...pairs].sort((a, b) => (b.volume?.h24 ?? 0) - (a.volume?.h24 ?? 0));
  return sorted
    .slice(0, limit)
    .map((p) => {
      const vol = p.volume?.h24 ?? 0;
      const change = p.priceChange?.h24 ?? 0;
      return `${p.baseToken.name} (${p.baseToken.symbol}) | chain:${p.chainId} | vol24h:$${vol.toLocaleString()} | change:${change > 0 ? "+" : ""}${change.toFixed(1)}% | addr:${p.baseToken.address}`;
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
        timeout: 10000,
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

export async function runNarrativeScan(timeframe: NarrativeTimeframe): Promise<NarrativeScanResult> {
  const maxAge = hoursForTimeframe(timeframe);

  const searchQueries = ["meme coin", "pump", "new token", "PEPE", "DOGE", "solana", "bsc"];

  const [pairs, headlines] = await Promise.all([
    quickDexSearch(searchQueries).catch(() => [] as DexPair[]),
    fetchGoogleNewsHeadlines("crypto meme coin trending", 20).catch(() => []),
  ]);

  const recentPairs = filterPairsByAge(pairs, maxAge);
  const pairText = buildPairSummaries(recentPairs.length > 0 ? recentPairs : pairs.slice(0, 150));

  const headlinesText = headlines
    .slice(0, 15)
    .map((h) => h.title)
    .join("\n");

  const timeframeLabel = timeframe === "4h" ? "last 4 hours" : timeframe === "daily" ? "last 24 hours" : "last 7 days";

  const prompt = `You are a meme coin narrative analyst. Given a list of recently launched meme coins and trending crypto headlines, identify the TOP NARRATIVES that traders should watch.

TIMEFRAME: ${timeframeLabel}

RECENT MEME COIN LAUNCHES (name | symbol | chain | volume | price change | address):
${pairText || "(no pairs available)"}

TRENDING HEADLINES:
${headlinesText || "(no headlines available)"}

TASK: Identify 5-10 distinct narrative themes from the data above. For each narrative:
1. Give it a short, catchy name (e.g. "AI Agents", "Trump Politics", "Dog Coins", "Aliens")
2. Assign a heat score 0-100 (based on how many coins + volume + headline presence)
3. Direction: "rising" (gaining momentum), "peaking" (at peak), or "fading" (losing steam)
4. Count how many coins in the list match this narrative
5. List the top 3 coins (by volume) that match, with their name, symbol, address, chain, volume, and price change
6. List 2-4 keywords that define this narrative
7. One-sentence summary of why this narrative matters right now

Return ONLY valid JSON array. Each item:
{
  "name": "string",
  "heat": number,
  "direction": "rising"|"peaking"|"fading",
  "coinCount": number,
  "topCoins": [{"name":"string","symbol":"string","address":"string","chain":"string","volumeUsd":number,"priceChange24h":number}],
  "keywords": ["string"],
  "summary": "string"
}

Sort by heat descending. No markdown, no explanation, just the JSON array.`;

  const client = new Anthropic();
  const msg = await client.messages.create({
    model: CLAUDE_SONNET_MODEL,
    max_tokens: 4000,
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
          ? (item.topCoins as Record<string, unknown>[]).slice(0, 3).map((c) => ({
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
    pairsScanned: recentPairs.length || pairs.length,
    aiGenerated: true,
  };
}
