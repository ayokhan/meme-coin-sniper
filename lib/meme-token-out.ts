import type { DexPair } from "@/lib/api-clients/dexscreener";
import { extractSocials } from "@/lib/api-clients/dexscreener";

export type MemeTokenOut = {
  id: string;
  symbol: string;
  name: string;
  contractAddress: string;
  viralScore: number;
  liquidity: number | null;
  priceUSD: number | null;
  pairAddress: string | null;
  twitter: string | null;
  telegram: string | null;
  website: string | null;
  launchedAt: string;
  volume24h: number | null;
  txnsBuys24h: number | null;
  txnsSells24h: number | null;
  pct5m: number | null;
  pct1h: number | null;
  pct6h: number | null;
  pct24h: number | null;
  dexId: string | null;
  /** Set by multi-chain Go Hunting. */
  chain?: string;
  launchpad?: string | null;
  volume5m?: number | null;
  volume15m?: number | null;
  volume30m?: number | null;
  volume1h?: number | null;
  volume6h?: number | null;
};

/** Adds per-window volumes for Surge (5m/15m/30m are estimated from 1h; DexScreener only reports h1/h6/h24). */
export function pairToSurgeToken(pair: DexPair): MemeTokenOut {
  const vol1 = pair.volume?.h1 ?? null;
  const vol6 = pair.volume?.h6 ?? null;
  const vol24 = pair.volume?.h24 ?? 0;
  const vol1hNum = vol1 ?? vol6 ?? vol24 ?? 0;
  return {
    ...pairToMemeToken(pair),
    volume5m: vol1hNum > 0 ? vol1hNum / 12 : null,
    volume15m: vol1hNum > 0 ? vol1hNum / 4 : null,
    volume30m: vol1hNum > 0 ? vol1hNum / 2 : null,
    volume1h: vol1 != null && vol1 > 0 ? vol1 : null,
    volume6h: vol6 != null && vol6 > 0 ? vol6 : null,
  };
}

export function extractPairPriceChanges(pair: DexPair): {
  pct5m: number | null;
  pct1h: number | null;
  pct6h: number | null;
  pct24h: number | null;
} {
  const pc = pair.priceChange;
  const h1 = pc?.h1 ?? null;
  const pct5m = pc?.m5 ?? (h1 != null ? h1 / 12 : null);
  const pct1h = h1;
  const pct6h = pc?.h6 ?? null;
  const pct24h = pc?.h24 ?? pc?.h6 ?? null;
  return { pct5m, pct1h, pct6h, pct24h };
}

export function pairToMemeToken(pair: DexPair, viralScoreCap = 50): MemeTokenOut {
  const socials = extractSocials(pair);
  const liq = pair.liquidity?.usd ?? 0;
  const vol = pair.volume?.h24 ?? 0;
  const { pct5m, pct1h, pct6h, pct24h } = extractPairPriceChanges(pair);
  const change = pct24h ?? 0;
  const txns = pair.txns?.h24 ?? pair.txns?.h6 ?? pair.txns?.h1;
  let score = 0;
  if (liq >= 50_000) score += 15;
  else if (liq >= 20_000) score += 10;
  else if (liq >= 5_000) score += 5;
  if (vol >= 20_000) score += 10;
  else if (vol >= 5_000) score += 5;
  if (change >= 50) score += 15;
  else if (change >= 20) score += 10;
  else if (change > 0) score += 5;
  score += (socials.website ? 2 : 0) + (socials.twitter ? 3 : 0) + (socials.telegram ? 2 : 0);

  const createdMs =
    pair.pairCreatedAt != null
      ? pair.pairCreatedAt < 1e12
        ? pair.pairCreatedAt * 1000
        : pair.pairCreatedAt
      : Date.now();

  return {
    id: pair.pairAddress ?? pair.baseToken.address,
    symbol: pair.baseToken.symbol,
    name: pair.baseToken.name,
    contractAddress: pair.baseToken.address,
    viralScore: Math.min(viralScoreCap, score),
    liquidity: liq > 0 ? liq : null,
    priceUSD: pair.priceUsd ? parseFloat(pair.priceUsd) : null,
    pairAddress: pair.pairAddress,
    twitter: socials.twitter,
    telegram: socials.telegram,
    website: socials.website,
    launchedAt: new Date(createdMs).toISOString(),
    volume24h: vol > 0 ? vol : null,
    txnsBuys24h: txns ? txns.buys : null,
    txnsSells24h: txns ? txns.sells : null,
    pct5m,
    pct1h,
    pct6h,
    pct24h,
    dexId: pair.dexId ?? null,
  };
}
