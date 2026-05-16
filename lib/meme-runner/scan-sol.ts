import { extractSocials, getNewSolanaPairs, type DexPair } from "@/lib/api-clients/dexscreener";
import { getPumpFunNewTokens } from "@/lib/api-clients/moralis";
import type { MemeRunnerLane, MemeRunnerSolConfig, MemeRunnerToken } from "@/lib/meme-runner/types";

const PUMP_DEX = new Set(["pump.fun", "pumpswap"]);
const MIGRATED_DEX = new Set(["raydium", "orca", "meteora"]);

function toMs(createdAt: number): number {
  return createdAt < 1e12 ? createdAt * 1000 : createdAt;
}

function marketCapUsd(pair: DexPair): number | null {
  if (pair.fdv != null && Number.isFinite(pair.fdv) && pair.fdv > 0) return pair.fdv;
  const liq = pair.liquidity?.usd ?? 0;
  if (liq > 0) return liq * 2;
  return null;
}

function estimateFeesSol(volumeUsd: number, solPrice: number): number {
  if (!Number.isFinite(volumeUsd) || volumeUsd <= 0 || solPrice <= 0) return 0;
  return (volumeUsd / solPrice) * 0.0125;
}

function classifyLane(pair: DexPair, mcap: number | null, config: MemeRunnerSolConfig): MemeRunnerLane {
  const dex = (pair.dexId || "").toLowerCase();
  if (MIGRATED_DEX.has(dex)) return "migrated";
  if (!PUMP_DEX.has(dex)) return "soon";
  const mc = mcap ?? 0;
  if (mc < config.minMarketCapUsd * 0.8) return "new";
  return "soon";
}

function socialFlags(socials: { twitter: string | null; telegram: string | null; website: string | null }) {
  const hasAny = !!(socials.twitter || socials.telegram || socials.website);
  const hasOriginal = !!(socials.twitter || socials.telegram);
  return { hasSocials: hasAny, hasOriginalSocials: hasOriginal };
}

function scoreToken(
  config: MemeRunnerSolConfig,
  mcap: number | null,
  ageMin: number,
  feesSol: number,
  vol: number,
  hasSocials: boolean,
  hasOriginalSocials: boolean
): { score: number; notes: string[] } {
  const notes: string[] = [];
  let score = 0;
  const mc = mcap ?? 0;
  if (mc >= config.minMarketCapUsd && mc <= config.maxMarketCapUsd) {
    const dist = Math.abs(mc - config.targetMarketCapUsd);
    const band = config.maxMarketCapUsd - config.minMarketCapUsd;
    const proximity = Math.max(0, 1 - dist / Math.max(band, 1));
    score += Math.round(25 * proximity);
    if (proximity > 0.7) notes.push("MC in target band");
  }
  if (ageMin >= config.minTokenAgeMinutes && ageMin <= config.maxTokenAgeMinutes) {
    score += ageMin <= 180 ? 20 : 12;
    notes.push("Age in window");
  }
  if (feesSol >= config.minEstimatedFeesSol) {
    score += 20;
    notes.push("Fees ≥ min SOL");
  }
  if (vol >= config.minVolume24hUsd) {
    score += 10;
    notes.push("Volume OK");
  }
  if (hasSocials) {
    score += 10;
    notes.push("Has socials");
  }
  if (hasOriginalSocials) {
    score += 10;
    notes.push("Twitter/Telegram");
  }
  return { score: Math.min(100, score), notes };
}

function applyFilters(
  config: MemeRunnerSolConfig,
  ageMin: number,
  mcap: number | null,
  liq: number,
  vol: number,
  feesSol: number,
  hasSocials: boolean,
  hasOriginalSocials: boolean
): { passes: boolean; notes: string[] } {
  const notes: string[] = [];
  if (ageMin < config.minTokenAgeMinutes) notes.push(`Age ${Math.round(ageMin)}m < ${config.minTokenAgeMinutes}m`);
  if (ageMin > config.maxTokenAgeMinutes) notes.push(`Age ${Math.round(ageMin)}m > max`);
  const mc = mcap ?? 0;
  if (mc < config.minMarketCapUsd) notes.push(`MC $${Math.round(mc)} < min`);
  if (mc > config.maxMarketCapUsd) notes.push(`MC $${Math.round(mc)} > max`);
  if (liq < config.minLiquidityUsd) notes.push(`Liquidity $${Math.round(liq)} low`);
  if (vol < config.minVolume24hUsd) notes.push(`Volume $${Math.round(vol)} low`);
  if (feesSol < config.minEstimatedFeesSol) notes.push(`Est. fees ${feesSol.toFixed(2)} SOL < ${config.minEstimatedFeesSol}`);
  if (config.requireAtLeastOneSocial && !hasSocials) notes.push("No socials");
  if (config.requireOriginalSocials && !hasOriginalSocials) notes.push("No Twitter/Telegram");
  return { passes: notes.length === 0, notes };
}

function pairToRunnerToken(pair: DexPair, config: MemeRunnerSolConfig): MemeRunnerToken {
  const socials = extractSocials(pair);
  const { hasSocials, hasOriginalSocials } = socialFlags(socials);
  const launchedMs = toMs(pair.pairCreatedAt ?? Date.now());
  const ageMin = (Date.now() - launchedMs) / 60_000;
  const mcap = marketCapUsd(pair);
  const liq = pair.liquidity?.usd ?? 0;
  const vol = pair.volume?.h24 ?? 0;
  const feesSol = estimateFeesSol(vol, config.solPriceUsd);
  const lane = classifyLane(pair, mcap, config);
  const bondingProgressPct = PUMP_DEX.has((pair.dexId || "").toLowerCase())
    ? mcap != null
      ? Math.min(100, (mcap / config.pumpGraduationMcapUsd) * 100)
      : null
    : null;
  const { score, notes: scoreNotes } = scoreToken(config, mcap, ageMin, feesSol, vol, hasSocials, hasOriginalSocials);
  const { passes: filterPasses, notes: filterNotes } = applyFilters(
    config,
    ageMin,
    mcap,
    liq,
    vol,
    feesSol,
    hasSocials,
    hasOriginalSocials
  );
  const addr = pair.baseToken.address;
  const slug = pair.pairAddress ?? addr;
  return {
    id: slug,
    symbol: pair.baseToken.symbol,
    name: pair.baseToken.name,
    contractAddress: addr,
    pairAddress: pair.pairAddress || null,
    lane,
    marketCapUsd: mcap,
    liquidityUsd: liq > 0 ? liq : null,
    volume24hUsd: vol > 0 ? vol : null,
    priceUsd: pair.priceUsd ? parseFloat(pair.priceUsd) : null,
    tokenAgeMinutes: Math.round(ageMin),
    estimatedFeesSol: Number(feesSol.toFixed(3)),
    bondingProgressPct: bondingProgressPct != null ? Number(bondingProgressPct.toFixed(1)) : null,
    runnerScore: score,
    twitter: socials.twitter,
    telegram: socials.telegram,
    website: socials.website,
    hasSocials,
    hasOriginalSocials,
    dexId: pair.dexId || "",
    dexUrl: slug ? `https://dexscreener.com/solana/${slug}` : null,
    launchedAt: new Date(launchedMs).toISOString(),
    filterPasses,
    filterNotes,
    scoreNotes,
  };
}

export async function scanMemeRunnerSol(
  config: MemeRunnerSolConfig,
  lane: MemeRunnerLane | "all" = "all",
  moralisEnabled = true
): Promise<MemeRunnerToken[]> {
  const maxAge = Math.max(config.maxTokenAgeMinutes, 120);
  const [pairs, moralis] = await Promise.all([
    getNewSolanaPairs(config.minLiquidityUsd, maxAge),
    moralisEnabled ? getPumpFunNewTokens(40).catch(() => []) : Promise.resolve([]),
  ]);

  const byKey = new Map<string, DexPair>();
  const add = (p: DexPair) => {
    const key = p.pairAddress || p.baseToken?.address;
    if (!key) return;
    const dex = (p.dexId || "").toLowerCase();
    if (!PUMP_DEX.has(dex) && !MIGRATED_DEX.has(dex)) return;
    if (!byKey.has(key)) byKey.set(key, p);
  };
  pairs.forEach(add);

  for (const m of moralis) {
    const addr = m.tokenAddress;
    if (!addr || byKey.has(addr)) continue;
    const liq = m.liquidity != null ? parseFloat(String(m.liquidity)) : 0;
    const created = m.createdAt ? new Date(m.createdAt).getTime() : Date.now();
    byKey.set(`moralis:${addr}`, {
      chainId: "solana",
      dexId: "pump.fun",
      pairAddress: "",
      baseToken: { address: addr, name: m.name ?? "—", symbol: m.symbol ?? "—" },
      priceUsd: m.priceUsd != null ? String(m.priceUsd) : "0",
      liquidity: { usd: liq },
      volume: { h24: 0 },
      fdv: m.fullyDilutedValuation ? parseFloat(String(m.fullyDilutedValuation)) : undefined,
      pairCreatedAt: created,
    });
  }

  let tokens = Array.from(byKey.values())
    .map((p) => pairToRunnerToken(p, config))
    .filter((t) => t.filterPasses && t.runnerScore >= config.minRunnerScore);

  if (lane !== "all") tokens = tokens.filter((t) => t.lane === lane);
  tokens.sort((a, b) => b.runnerScore - a.runnerScore || (b.volume24hUsd ?? 0) - (a.volume24hUsd ?? 0));

  return tokens.slice(0, 80);
}
