import { NextResponse } from "next/server";
import {
  getNewSolanaPairs,
  getNewSolanaPairsFromWebSocket,
  getMemeRunnerChainPairs,
  type DexPair,
} from "@/lib/api-clients/dexscreener";
import { getNewListings } from "@/lib/api-clients/birdeye";
import { getPumpFunNewTokens, type MoralisNewToken } from "@/lib/api-clients/moralis";
import { getSessionAndSubscription } from "@/lib/auth-server";
import { getFeatureFlag, FEATURE_FLAG_KEYS } from "@/lib/feature-flags";
import {
  filterPairsForGoHuntingView,
  GO_HUNTING_DEX_ALLOWLIST,
  type GoHuntingView,
} from "@/lib/go-hunting-views";
import { pairToMemeToken, type MemeTokenOut } from "@/lib/meme-token-out";

const FREE_LIMIT = 50;
const PAID_LIMIT = 300;

function birdeyeToToken(addr: string, symbol?: string, name?: string, liquidity?: number, v24h?: number): MemeTokenOut {
  let score = 0;
  const liq = liquidity ?? 0;
  if (liq >= 50_000) score += 15;
  else if (liq >= 20_000) score += 10;
  else if (liq >= 5_000) score += 5;
  if ((v24h ?? 0) >= 20_000) score += 10;
  else if ((v24h ?? 0) >= 5_000) score += 5;
  return {
    id: addr,
    symbol: symbol ?? "—",
    name: name ?? "—",
    contractAddress: addr,
    viralScore: Math.min(50, score),
    liquidity: liq > 0 ? liq : null,
    priceUSD: null,
    pairAddress: null,
    twitter: null,
    telegram: null,
    website: null,
    launchedAt: new Date().toISOString(),
    volume24h: v24h ?? null,
    txnsBuys24h: null,
    txnsSells24h: null,
    pct5m: null,
    pct1h: null,
    pct6h: null,
    pct24h: null,
    dexId: null,
  };
}

function moralisToToken(m: MoralisNewToken): MemeTokenOut {
  const liq = m.liquidity != null ? parseFloat(String(m.liquidity)) : 0;
  let score = 0;
  if (liq >= 50_000) score += 15;
  else if (liq >= 20_000) score += 10;
  else if (liq >= 5_000) score += 5;
  const launchedAt = m.createdAt ? new Date(m.createdAt).toISOString() : new Date().toISOString();
  return {
    id: `moralis:${m.tokenAddress}`,
    symbol: m.symbol ?? "—",
    name: m.name ?? "—",
    contractAddress: m.tokenAddress,
    viralScore: Math.min(50, score),
    liquidity: liq > 0 ? liq : null,
    priceUSD: m.priceUsd != null ? parseFloat(String(m.priceUsd)) : null,
    pairAddress: null,
    twitter: null,
    telegram: null,
    website: null,
    launchedAt,
    volume24h: null,
    txnsBuys24h: null,
    txnsSells24h: null,
    pct5m: null,
    pct1h: null,
    pct6h: null,
    pct24h: null,
    dexId: "pumpfun",
  };
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

export async function GET(request: Request) {
  try {
    const { isPaid } = await getSessionAndSubscription();
    const { searchParams } = new URL(request.url);
    const maxAgeMinutes = Math.min(parseInt(searchParams.get("maxAgeMinutes") || "120", 10), 1440);
    const view = (searchParams.get("view") || "new_pairs") as GoHuntingView;
    const minLiquidity = view === "new_pairs" ? 100 : 300;
    const requestedLimit = parseInt(searchParams.get("limit") || "150", 10);
    const limit = isPaid ? Math.min(PAID_LIMIT, Math.max(100, requestedLimit)) : Math.min(FREE_LIMIT, requestedLimit);
    const effectiveMaxAge = view === "new_pairs" ? Math.min(maxAgeMinutes, 180) : Math.min(maxAgeMinutes, 360);
    const dexAllow = GO_HUNTING_DEX_ALLOWLIST.solana[view];

    const moralisGoHunting = await getFeatureFlag(FEATURE_FLAG_KEYS.MORALIS_GO_HUNTING);
    const [wsPairs, runnerPairs, legacyPairs, birdeyeListings, moralisListings] = await Promise.all([
      view === "new_pairs" ? getNewSolanaPairsFromWebSocket(10000) : Promise.resolve([]),
      getMemeRunnerChainPairs({
        chain: "solana",
        minLiquidity,
        maxAgeMinutes: effectiveMaxAge,
        allowedDexIds: dexAllow,
        searchQueries: view === "final_stretch" ? ["pump.fun", "pumpfun", "pumpswap"] : ["pump", "raydium", "meme"],
        maxResults: 350,
      }),
      getNewSolanaPairs(minLiquidity, effectiveMaxAge),
      view === "new_pairs" ? getNewListings(30).catch(() => []) : Promise.resolve([]),
      view === "new_pairs" && moralisGoHunting ? getPumpFunNewTokens(50).catch(() => []) : Promise.resolve([]),
    ]);

    let pairs = mergePairs(wsPairs, runnerPairs, legacyPairs);
    pairs = filterPairsForGoHuntingView(pairs, view, "solana");
    pairs.sort((a, b) => {
      const ta = a.pairCreatedAt < 1e12 ? a.pairCreatedAt * 1000 : a.pairCreatedAt;
      const tb = b.pairCreatedAt < 1e12 ? b.pairCreatedAt * 1000 : b.pairCreatedAt;
      return tb - ta;
    });

    const byPair = new Map<string, MemeTokenOut>();
    for (const pair of pairs) {
      const t = pairToMemeToken(pair);
      const key = pair.pairAddress ?? t.contractAddress;
      byPair.set(key, t);
    }

    if (view === "new_pairs") {
      const haveContract = new Set(Array.from(byPair.values(), (t) => t.contractAddress));
      for (const b of birdeyeListings) {
        const addr = b.address;
        if (!addr || haveContract.has(addr)) continue;
        haveContract.add(addr);
        byPair.set(`birdeye:${addr}`, birdeyeToToken(addr, b.symbol, b.name, b.liquidity, b.v24hUSD));
      }
      for (const m of moralisListings) {
        const addr = m.tokenAddress;
        if (!addr || haveContract.has(addr)) continue;
        haveContract.add(addr);
        byPair.set(`moralis:${addr}`, moralisToToken(m));
      }
    }

    const tokens = Array.from(byPair.values())
      .sort((a, b) => new Date(b.launchedAt).getTime() - new Date(a.launchedAt).getTime())
      .slice(0, limit);

    const viewLabel =
      view === "new_pairs" ? "New pairs" : view === "final_stretch" ? "Final Stretch" : "Migrated";
    return NextResponse.json({
      success: true,
      tokens,
      maxAgeMinutes: effectiveMaxAge,
      view,
      description: `Go Hunting · ${viewLabel}: last ${effectiveMaxAge}m (AI viral score on each).`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "New pairs failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
