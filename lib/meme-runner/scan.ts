import {
  extractSocials,
  fetchChainPairsViaSearch,
  getMemeRunnerChainPairs,
  type DexPair,
  type MemeRunnerChainDexKey,
} from "@/lib/api-clients/dexscreener";
import { getPumpFunNewTokens } from "@/lib/api-clients/moralis";
import { getChainMeta } from "@/lib/meme-runner/chain-meta";
import { passesContinuationFilters, scoreContinuation } from "@/lib/meme-runner/continuation";
import {
  laneFiltersFor,
  SOON_GRADUATING_CURVE_MIN_PCT,
  SOON_GRADUATING_MC_MAX_USD,
  SOON_GRADUATING_MC_MIN_USD,
} from "@/lib/meme-runner/defaults";
import {
  buildLaunchpadScanPlan,
  dexScreenerPairUrl,
  isMigratedPoolDex,
  launchpadExternalUrl,
  matchLaunchpadsForPair,
  normalizeDexId,
  primaryLaunchpadForPair,
  type LaunchpadScanPlan,
  type MemeRunnerLaunchpadDef,
} from "@/lib/meme-runner/launchpads";
import type {
  MemeRunnerChain,
  MemeRunnerLane,
  MemeRunnerLaneFilters,
  MemeRunnerSolConfig,
  MemeRunnerToken,
} from "@/lib/meme-runner/types";

type TaggedPair = { pair: DexPair; taggedLaunchpadId: string | null };

function dexKey(chain: MemeRunnerChain): MemeRunnerChainDexKey {
  if (chain === "bsc") return "bsc";
  if (chain === "eth") return "ethereum";
  return "solana";
}

function toMs(createdAt: number): number {
  return createdAt < 1e12 ? createdAt * 1000 : createdAt;
}

function marketCapUsd(pair: DexPair): number | null {
  if (pair.fdv != null && Number.isFinite(pair.fdv) && pair.fdv > 0) return pair.fdv;
  const liq = pair.liquidity?.usd ?? 0;
  if (liq > 0) return liq * 2;
  return null;
}

/** Use recent windows when 24h vol is still near zero (fresh launches). */
function effectiveVolume24h(pair: DexPair): number {
  const h24 = pair.volume?.h24 ?? 0;
  const h6 = pair.volume?.h6 ?? 0;
  const h1 = pair.volume?.h1 ?? 0;
  return Math.max(h24, h6 * 4, h1 * 12);
}

function estimateFeesNative(volumeUsd: number, nativePriceUsd: number): number {
  if (!Number.isFinite(volumeUsd) || volumeUsd <= 0 || nativePriceUsd <= 0) return 0;
  return (volumeUsd / nativePriceUsd) * 0.0125;
}

function isBondingDex(dexId: string, plan: LaunchpadScanPlan): boolean {
  return plan.allowedBondingDexIds.has(normalizeDexId(dexId));
}

function pairAllowed(pair: DexPair, taggedLaunchpadId: string | null, plan: LaunchpadScanPlan): boolean {
  const dex = pair.dexId || "";
  if (plan.includeMigratedPools && isMigratedPoolDex(plan.chain, dex)) return true;
  if (isBondingDex(dex, plan)) return true;
  if (taggedLaunchpadId && plan.enabled.some((p) => p.id === taggedLaunchpadId)) return true;
  return matchLaunchpadsForPair(dex, plan.enabled).length > 0;
}

function bondingCurvePct(mcap: number | null, config: MemeRunnerSolConfig): number | null {
  if (mcap == null || mcap <= 0) return null;
  return Math.min(100, (mcap / config.pumpGraduationMcapUsd) * 100);
}

function isGraduatingPumpswap(dex: string, mc: number, curvePct: number | null): boolean {
  if (!dex.includes("pumpswap")) return false;
  if (curvePct == null || curvePct < SOON_GRADUATING_CURVE_MIN_PCT) return false;
  return mc >= SOON_GRADUATING_MC_MIN_USD && mc <= SOON_GRADUATING_MC_MAX_USD;
}

/** Soon = pump.fun $50k→$100k + graduating pumpswap $85k→$120k. Migrated = AMM / past grad band. */
function classifyLane(
  pair: DexPair,
  mcap: number | null,
  config: MemeRunnerSolConfig,
  plan: LaunchpadScanPlan,
  launchpad: MemeRunnerLaunchpadDef | null
): MemeRunnerLane {
  const dex = normalizeDexId(pair.dexId || "");
  const mc = mcap ?? 0;
  if (config.includeMigratedPools && isMigratedPoolDex(plan.chain, pair.dexId || "")) return "migrated";

  const onBonding = launchpad?.kind === "bonding" || isBondingDex(pair.dexId || "", plan);
  const curvePct = onBonding ? bondingCurvePct(mcap, config) : null;
  const onPumpfun = dex === "pumpfun" || dex.includes("pumpfun");

  if (onBonding && isGraduatingPumpswap(dex, mc, curvePct)) return "soon";

  if (onBonding && !onPumpfun) {
    const pastGradBand =
      (curvePct != null && curvePct >= SOON_GRADUATING_CURVE_MIN_PCT && mc > SOON_GRADUATING_MC_MAX_USD) ||
      mc >= config.pumpGraduationMcapUsd * 1.15;
    if (pastGradBand) return "migrated";
  }

  if (onPumpfun || (onBonding && curvePct != null && curvePct < 88)) {
    if (mc <= 0 || mc < config.laneNewMaxMcapUsd) return "new";
    if (mc >= config.laneSoonMinMcapUsd && mc <= config.laneSoonMaxMcapUsd) return "soon";
    if (mc < config.laneSoonMinMcapUsd) return "new";
    return "migrated";
  }

  if (mc >= config.laneSoonMinMcapUsd && mc <= config.laneSoonMaxMcapUsd) return "soon";
  return "migrated";
}

function isActiveBondingPair(
  chain: MemeRunnerChain,
  pair: DexPair,
  config: MemeRunnerSolConfig,
  plan: LaunchpadScanPlan
): boolean {
  const dex = normalizeDexId(pair.dexId || "");
  if (isMigratedPoolDex(chain, pair.dexId || "")) return false;
  const mc = marketCapUsd(pair) ?? 0;
  if (dex === "pumpfun" || dex.includes("pumpfun")) return true;
  const curve = bondingCurvePct(marketCapUsd(pair), config);
  if (isGraduatingPumpswap(dex, mc, curve)) return true;
  if (dex.includes("pumpswap") && mc < config.pumpGraduationMcapUsd * 0.88) return true;
  if (!isBondingDex(pair.dexId || "", plan)) return false;
  return mc <= config.laneSoonMaxMcapUsd * 1.05;
}

function socialFlags(socials: { twitter: string | null; telegram: string | null; website: string | null }) {
  const hasAny = !!(socials.twitter || socials.telegram || socials.website);
  const hasOriginal = !!(socials.twitter || socials.telegram);
  return { hasSocials: hasAny, hasOriginalSocials: hasOriginal };
}

function scoreTargetMc(config: MemeRunnerSolConfig, lane: MemeRunnerLane, filters: MemeRunnerLaneFilters): number {
  if (lane === "soon") return config.targetMarketCapUsd;
  return (filters.minMarketCapUsd + filters.maxMarketCapUsd) / 2;
}

function scoreToken(
  config: MemeRunnerSolConfig,
  lane: MemeRunnerLane,
  filters: MemeRunnerLaneFilters,
  mcap: number | null,
  ageMin: number,
  feesNative: number,
  vol: number,
  hasSocials: boolean,
  hasOriginalSocials: boolean
): { score: number; notes: string[] } {
  const notes: string[] = [];
  let score = 0;
  const mc = mcap ?? 0;
  const targetMc = scoreTargetMc(config, lane, filters);
  if (mc >= filters.minMarketCapUsd && mc <= filters.maxMarketCapUsd) {
    const dist = Math.abs(mc - targetMc);
    const band = filters.maxMarketCapUsd - filters.minMarketCapUsd;
    const proximity = Math.max(0, 1 - dist / Math.max(band, 1));
    score += Math.round(25 * proximity);
    if (proximity > 0.7) notes.push("MC in target band");
  }
  if (ageMin >= filters.minTokenAgeMinutes && ageMin <= filters.maxTokenAgeMinutes) {
    score += ageMin <= 180 ? 20 : 12;
    notes.push("Age in window");
  }
  if (feesNative >= filters.minEstimatedFeesSol) {
    score += 20;
    notes.push("Fees ≥ min");
  }
  if (vol >= filters.minVolume24hUsd) {
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
  if (lane === "new") {
    if (ageMin <= 120) score += 12;
    if (vol <= 0 && ageMin <= 90) score += 8;
  }
  if (lane === "soon" && mc >= 50_000 && mc <= 100_000) {
    score += 14;
    notes.push("50k–100k run zone");
  }
  if (lane === "migrated") {
    score += 18;
    notes.push("Graduated pool");
    if (vol >= filters.minVolume24hUsd) score += 12;
    if (mc >= 40_000) score += 10;
  }
  return { score: Math.min(100, score), notes };
}

function applyFilters(
  filters: MemeRunnerLaneFilters,
  ageMin: number,
  mcap: number | null,
  liq: number,
  vol: number,
  feesNative: number,
  hasSocials: boolean,
  hasOriginalSocials: boolean,
  nativeSymbol: string,
  minFeesNative = filters.minEstimatedFeesSol
): { passes: boolean; notes: string[] } {
  const notes: string[] = [];
  if (ageMin < filters.minTokenAgeMinutes) notes.push(`Age ${Math.round(ageMin)}m < ${filters.minTokenAgeMinutes}m`);
  if (ageMin > filters.maxTokenAgeMinutes) notes.push(`Age ${Math.round(ageMin)}m > max`);
  const mc = mcap ?? 0;
  if (mc < filters.minMarketCapUsd) notes.push(`MC $${Math.round(mc)} < min`);
  if (mc > filters.maxMarketCapUsd) notes.push(`MC $${Math.round(mc)} > max`);
  if (liq < filters.minLiquidityUsd) notes.push(`Liquidity $${Math.round(liq)} low`);
  if (filters.minVolume24hUsd > 0 && vol < filters.minVolume24hUsd)
    notes.push(`Volume $${Math.round(vol)} low`);
  if (feesNative < minFeesNative)
    notes.push(`Est. fees ${feesNative.toFixed(3)} ${nativeSymbol} < ${minFeesNative}`);
  if (filters.requireAtLeastOneSocial && !hasSocials) notes.push("No socials");
  if (filters.requireOriginalSocials && !hasOriginalSocials) notes.push("No Twitter/Telegram");
  return { passes: notes.length === 0, notes };
}

function pairToRunnerToken(
  chain: MemeRunnerChain,
  pair: DexPair,
  config: MemeRunnerSolConfig,
  plan: LaunchpadScanPlan,
  taggedLaunchpadId: string | null
): MemeRunnerToken {
  const meta = getChainMeta(chain);
  const socials = extractSocials(pair);
  const { hasSocials, hasOriginalSocials } = socialFlags(socials);
  const launchedMs = toMs(pair.pairCreatedAt ?? Date.now());
  const ageMin = (Date.now() - launchedMs) / 60_000;
  const mcap = marketCapUsd(pair);
  const liq = pair.liquidity?.usd ?? 0;
  const vol = effectiveVolume24h(pair);
  const feesNative = estimateFeesNative(vol, config.solPriceUsd);
  const launchpad = primaryLaunchpadForPair(chain, pair.dexId || "", plan.enabled, taggedLaunchpadId);
  const lane = classifyLane(pair, mcap, config, plan, launchpad);
  const dexNorm = normalizeDexId(pair.dexId || "");
  const mcVal = mcap ?? 0;
  const filters = laneFiltersFor(config, lane);
  const onBondingCurve =
    launchpad?.kind === "bonding" || plan.allowedBondingDexIds.has(normalizeDexId(pair.dexId || ""));
  const bondingProgressPct = onBondingCurve ? bondingCurvePct(mcap, config) : null;
  const soonGraduating =
    lane === "soon" && isGraduatingPumpswap(dexNorm, mcVal, bondingProgressPct);
  const { score, notes: scoreNotes } = scoreToken(
    config,
    lane,
    filters,
    mcap,
    ageMin,
    feesNative,
    vol,
    hasSocials,
    hasOriginalSocials
  );
  const feeFloor =
    lane === "new" && vol <= 0 && ageMin <= 120 ? Math.min(filters.minEstimatedFeesSol, 0.001) : filters.minEstimatedFeesSol;
  const { passes: basePasses, notes: filterNotes } = applyFilters(
    filters,
    ageMin,
    mcap,
    liq,
    vol,
    feesNative,
    hasSocials,
    hasOriginalSocials,
    meta.nativeSymbol,
    feeFloor
  );
  const { score: continuationScore, notes: contNotes } =
    lane === "soon"
      ? scoreContinuation({ pair, mcap, bondingProgressPct, config })
      : { score: 0, notes: [] as string[] };
  const contGate =
    lane === "soon"
      ? passesContinuationFilters(continuationScore, bondingProgressPct, config)
      : { passes: true, notes: [] as string[] };
  const filterPasses = basePasses && contGate.passes;
  const allFilterNotes = [...filterNotes, ...contGate.notes];
  const allScoreNotes = [...scoreNotes, ...contNotes];
  const addr = pair.baseToken.address;
  const slug = pair.pairAddress ?? addr;
  return {
    chain,
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
    estimatedFeesSol: Number(feesNative.toFixed(3)),
    bondingProgressPct: bondingProgressPct != null ? Number(bondingProgressPct.toFixed(1)) : null,
    runnerScore: score,
    continuationScore,
    twitter: socials.twitter,
    telegram: socials.telegram,
    website: socials.website,
    hasSocials,
    hasOriginalSocials,
    dexId: pair.dexId || "",
    launchpadId: launchpad?.id ?? null,
    launchpadLabel: launchpad?.label ?? null,
    dexUrl: slug ? dexScreenerPairUrl(chain, slug) : null,
    launchedAt: new Date(launchedMs).toISOString(),
    filterPasses,
    filterNotes: allFilterNotes,
    scoreNotes: allScoreNotes,
    soonGraduating,
  };
}

function fetchWindow(config: MemeRunnerSolConfig): { maxAgeMinutes: number; minLiquidityUsd: number } {
  const lanes: MemeRunnerLane[] = ["new", "soon", "migrated"];
  return {
    maxAgeMinutes: Math.max(...lanes.map((l) => laneFiltersFor(config, l).maxTokenAgeMinutes)),
    minLiquidityUsd: Math.min(...lanes.map((l) => laneFiltersFor(config, l).minLiquidityUsd)),
  };
}

async function fetchTaggedPairs(
  chain: MemeRunnerChain,
  config: MemeRunnerSolConfig,
  plan: LaunchpadScanPlan,
  minLiquidityUsd: number,
  maxAgeMinutes: number
): Promise<TaggedPair[]> {
  const byKey = new Map<string, TaggedPair>();
  const add = (pair: DexPair, taggedLaunchpadId: string | null) => {
    const key = pair.pairAddress || pair.baseToken?.address;
    if (!key || !pairAllowed(pair, taggedLaunchpadId, plan)) return;
    if (!byKey.has(key)) byKey.set(key, { pair, taggedLaunchpadId });
  };

  const ingest = (pairs: DexPair[]) => {
    for (const p of pairs) {
      const matches = matchLaunchpadsForPair(p.dexId || "", plan.enabled);
      add(p, matches[0]?.id ?? null);
    }
  };

  const newFilters = laneFiltersFor(config, "new");
  const pumpfunOnly = await getMemeRunnerChainPairs({
    chain: dexKey(chain),
    minLiquidity: Math.min(newFilters.minLiquidityUsd, 120),
    maxAgeMinutes: Math.max(newFilters.maxTokenAgeMinutes, 360),
    allowedDexIds: ["pumpfun"],
    searchQueries: ["pump.fun", "pumpfun", "new pump", "fresh pump"],
    maxResults: 120,
  });
  for (const p of pumpfunOnly) {
    const mc = marketCapUsd(p) ?? 0;
    if (mc > config.laneNewMaxMcapUsd * 1.15) continue;
    add(p, "pump");
  }

  const bondingDex = [...plan.allowedBondingDexIds];
  if (bondingDex.length > 0) {
    const soonQueries = [
      ...plan.searchQueries,
      "pump.fun",
      "pumpfun",
      "letsbonk",
      "bags.fm",
    ];
    const bondingPairs = await getMemeRunnerChainPairs({
      chain: dexKey(chain),
      minLiquidity: Math.min(minLiquidityUsd, 400),
      maxAgeMinutes,
      allowedDexIds: bondingDex,
      searchQueries: [...new Set(soonQueries)],
      maxResults: 200,
    });
    for (const p of bondingPairs) {
      if (!isActiveBondingPair(chain, p, config, plan)) continue;
      const matches = matchLaunchpadsForPair(p.dexId || "", plan.enabled);
      add(p, matches[0]?.id ?? null);
    }
  }

  if (plan.includeMigratedPools) {
    const migratedPairs = await getMemeRunnerChainPairs({
      chain: dexKey(chain),
      minLiquidity: minLiquidityUsd,
      maxAgeMinutes,
      allowedDexIds: plan.migratedDexIds.map((d) => normalizeDexId(d)),
      searchQueries: ["raydium", "orca", "meteora", "graduated"],
      maxResults: 100,
    });
    for (const p of migratedPairs) add(p, null);
  }

  const searchOnlyPads = plan.enabled.filter((p) => p.dexIds.length === 0 && p.searchQueries.length > 0);
  if (searchOnlyPads.length > 0) {
    const now = Date.now();
    for (const pad of searchOnlyPads) {
      const extra = await fetchChainPairsViaSearch(dexKey(chain), pad.searchQueries);
      for (const p of extra) {
        const ageMin = (now - toMs(p.pairCreatedAt ?? now)) / 60_000;
        if (ageMin > maxAgeMinutes * 2) continue;
        if ((p.liquidity?.usd ?? 0) < minLiquidityUsd) continue;
        add(p, pad.id);
      }
    }
  }

  return [...byKey.values()];
}

export type MemeRunnerScanDiagnostics = {
  classified: { new: number; soon: number; migrated: number };
  passed: { new: number; soon: number; migrated: number };
  /** Top filter/continuation notes for Soon tokens that did not pass (max 3). */
  soonRejectSamples?: string[];
  migratedRejectSamples?: string[];
  newRejectSamples?: string[];
};

export async function scanMemeRunner(
  chain: MemeRunnerChain,
  config: MemeRunnerSolConfig,
  lane: MemeRunnerLane | "all" = "all",
  moralisEnabled = true
): Promise<{ tokens: MemeRunnerToken[]; diagnostics: MemeRunnerScanDiagnostics }> {
  const plan = buildLaunchpadScanPlan(chain, config.enabledLaunchpads, config.includeMigratedPools);
  const emptyDiag: MemeRunnerScanDiagnostics = {
    classified: { new: 0, soon: 0, migrated: 0 },
    passed: { new: 0, soon: 0, migrated: 0 },
  };
  if (plan.enabled.length === 0 && !plan.includeMigratedPools) return { tokens: [], diagnostics: emptyDiag };

  const { maxAgeMinutes, minLiquidityUsd } = fetchWindow(config);
  const meta = getChainMeta(chain);
  const pumpEnabled = chain === "sol" && config.enabledLaunchpads.includes("pump");

  const [tagged, moralis] = await Promise.all([
    fetchTaggedPairs(chain, config, plan, minLiquidityUsd, maxAgeMinutes),
    moralisEnabled && meta.moralisPumpNew && pumpEnabled
      ? getPumpFunNewTokens(80).catch(() => [])
      : Promise.resolve([]),
  ]);

  const byKey = new Map<string, TaggedPair>();
  for (const t of tagged) {
    const key = t.pair.pairAddress || t.pair.baseToken?.address;
    if (key) byKey.set(key, t);
  }

  for (const m of moralis) {
    const addr = m.tokenAddress;
    if (!addr || byKey.has(addr)) continue;
    const liq = m.liquidity != null ? parseFloat(String(m.liquidity)) : 0;
    const created = m.createdAt ? new Date(m.createdAt).getTime() : Date.now();
    const pair: DexPair = {
      chainId: "solana",
      dexId: "pumpfun",
      pairAddress: "",
      baseToken: { address: addr, name: m.name ?? "—", symbol: m.symbol ?? "—" },
      priceUsd: m.priceUsd != null ? String(m.priceUsd) : "0",
      liquidity: { usd: liq },
      volume: { h24: 0 },
      fdv: m.fullyDilutedValuation ? parseFloat(String(m.fullyDilutedValuation)) : undefined,
      pairCreatedAt: created,
    };
    if (pairAllowed(pair, "pump", plan)) {
      byKey.set(`moralis:${addr}`, { pair, taggedLaunchpadId: "pump" });
    }
  }

  const allMapped = [...byKey.values()].map(({ pair, taggedLaunchpadId }) =>
    pairToRunnerToken(chain, pair, config, plan, taggedLaunchpadId)
  );
  const diagnostics: MemeRunnerScanDiagnostics = {
    classified: { new: 0, soon: 0, migrated: 0 },
    passed: { new: 0, soon: 0, migrated: 0 },
  };
  const soonRejectCounts = new Map<string, number>();
  const migratedRejectCounts = new Map<string, number>();
  const newRejectCounts = new Map<string, number>();
  const bumpReject = (map: Map<string, number>, t: MemeRunnerToken, lane: MemeRunnerLane) => {
    const f = laneFiltersFor(config, lane);
    if (t.filterPasses && t.runnerScore >= f.minRunnerScore) return;
    if (!t.filterPasses) {
      for (const note of t.filterNotes) map.set(note, (map.get(note) ?? 0) + 1);
    } else {
      const key = `Runner score ${t.runnerScore} < ${f.minRunnerScore}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
  };
  for (const t of allMapped) {
    if (t.lane === "new" || t.lane === "soon" || t.lane === "migrated") diagnostics.classified[t.lane] += 1;
    if (t.lane === "soon") bumpReject(soonRejectCounts, t, "soon");
    if (t.lane === "migrated") bumpReject(migratedRejectCounts, t, "migrated");
    if (t.lane === "new") bumpReject(newRejectCounts, t, "new");
  }
  const topReject = (map: Map<string, number>) =>
    [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([note, n]) => `${note} (${n})`);
  if (soonRejectCounts.size > 0) diagnostics.soonRejectSamples = topReject(soonRejectCounts);
  if (migratedRejectCounts.size > 0) diagnostics.migratedRejectSamples = topReject(migratedRejectCounts);
  if (newRejectCounts.size > 0) diagnostics.newRejectSamples = topReject(newRejectCounts);
  let tokens = allMapped.filter((t) => {
    const f = laneFiltersFor(config, t.lane);
    const pass = t.filterPasses && t.runnerScore >= f.minRunnerScore;
    if (pass && (t.lane === "new" || t.lane === "soon" || t.lane === "migrated")) diagnostics.passed[t.lane] += 1;
    return pass;
  });

  if (lane !== "all") tokens = tokens.filter((t) => t.lane === lane);
  tokens.sort((a, b) => {
    if (a.lane === "soon" && b.lane === "soon") {
      const gradRank = (t: MemeRunnerToken) => (t.soonGraduating ? 1 : 0);
      return (
        gradRank(b) - gradRank(a) ||
        b.continuationScore - a.continuationScore ||
        b.runnerScore - a.runnerScore ||
        (b.volume24hUsd ?? 0) - (a.volume24hUsd ?? 0)
      );
    }
    if (a.lane === "migrated" && b.lane === "migrated") {
      const mcA = a.marketCapUsd ?? Number.MAX_SAFE_INTEGER;
      const mcB = b.marketCapUsd ?? Number.MAX_SAFE_INTEGER;
      return mcA - mcB || b.runnerScore - a.runnerScore || (b.volume24hUsd ?? 0) - (a.volume24hUsd ?? 0);
    }
    return b.runnerScore - a.runnerScore || (b.volume24hUsd ?? 0) - (a.volume24hUsd ?? 0);
  });

  return { tokens: tokens.slice(0, 80), diagnostics };
}

export async function scanMemeRunnerSol(
  config: MemeRunnerSolConfig,
  lane: MemeRunnerLane | "all" = "all",
  moralisEnabled = true
): Promise<MemeRunnerToken[]> {
  const { tokens } = await scanMemeRunner("sol", config, lane, moralisEnabled);
  return tokens;
}

export { launchpadExternalUrl };
