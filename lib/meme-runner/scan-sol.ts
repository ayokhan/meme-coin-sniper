import {
  extractSocials,
  fetchSolanaPairsViaSearch,
  getMemeRunnerSolanaPairs,
  type DexPair,
} from "@/lib/api-clients/dexscreener";
import { getPumpFunNewTokens } from "@/lib/api-clients/moralis";
import { laneFiltersFor } from "@/lib/meme-runner/defaults";
import {
  buildLaunchpadScanPlan,
  launchpadExternalUrl,
  MIGRATED_POOL_DEX_IDS,
  matchLaunchpadsForPair,
  normalizeDexId,
  primaryLaunchpadForPair,
  type MemeRunnerLaunchpadDef,
} from "@/lib/meme-runner/launchpads";
import type {
  MemeRunnerLane,
  MemeRunnerLaneFilters,
  MemeRunnerSolConfig,
  MemeRunnerToken,
} from "@/lib/meme-runner/types";

type TaggedPair = { pair: DexPair; taggedLaunchpadId: string | null };

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

function isMigratedDex(dexId: string): boolean {
  const n = normalizeDexId(dexId);
  return MIGRATED_POOL_DEX_IDS.some((d) => normalizeDexId(d) === n);
}

function isBondingDex(dexId: string, plan: ReturnType<typeof buildLaunchpadScanPlan>): boolean {
  return plan.allowedBondingDexIds.has(normalizeDexId(dexId));
}

function pairAllowed(
  pair: DexPair,
  taggedLaunchpadId: string | null,
  plan: ReturnType<typeof buildLaunchpadScanPlan>
): boolean {
  const dex = pair.dexId || "";
  if (plan.includeMigratedPools && isMigratedDex(dex)) return true;
  if (isBondingDex(dex, plan)) return true;
  if (taggedLaunchpadId && plan.enabled.some((p) => p.id === taggedLaunchpadId)) return true;
  return matchLaunchpadsForPair(dex, plan.enabled).length > 0;
}

function classifyLane(
  pair: DexPair,
  mcap: number | null,
  config: MemeRunnerSolConfig,
  plan: ReturnType<typeof buildLaunchpadScanPlan>,
  launchpad: MemeRunnerLaunchpadDef | null
): MemeRunnerLane {
  const dex = pair.dexId || "";
  if (config.includeMigratedPools && isMigratedDex(dex)) return "migrated";
  const mc = mcap ?? 0;
  const onBonding = launchpad?.kind === "bonding" || isBondingDex(dex, plan);
  if (!onBonding) return "soon";
  if (mc < config.laneNewMaxMcapUsd) return "new";
  if (mc >= config.laneSoonMinMcapUsd && mc <= config.laneSoonMaxMcapUsd) return "soon";
  if (mc < config.laneSoonMinMcapUsd) return "new";
  return "soon";
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
  feesSol: number,
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
  if (feesSol >= filters.minEstimatedFeesSol) {
    score += 20;
    notes.push("Fees ≥ min SOL");
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
  return { score: Math.min(100, score), notes };
}

function applyFilters(
  filters: MemeRunnerLaneFilters,
  ageMin: number,
  mcap: number | null,
  liq: number,
  vol: number,
  feesSol: number,
  hasSocials: boolean,
  hasOriginalSocials: boolean
): { passes: boolean; notes: string[] } {
  const notes: string[] = [];
  if (ageMin < filters.minTokenAgeMinutes) notes.push(`Age ${Math.round(ageMin)}m < ${filters.minTokenAgeMinutes}m`);
  if (ageMin > filters.maxTokenAgeMinutes) notes.push(`Age ${Math.round(ageMin)}m > max`);
  const mc = mcap ?? 0;
  if (mc < filters.minMarketCapUsd) notes.push(`MC $${Math.round(mc)} < min`);
  if (mc > filters.maxMarketCapUsd) notes.push(`MC $${Math.round(mc)} > max`);
  if (liq < filters.minLiquidityUsd) notes.push(`Liquidity $${Math.round(liq)} low`);
  if (vol < filters.minVolume24hUsd) notes.push(`Volume $${Math.round(vol)} low`);
  if (feesSol < filters.minEstimatedFeesSol)
    notes.push(`Est. fees ${feesSol.toFixed(2)} SOL < ${filters.minEstimatedFeesSol}`);
  if (filters.requireAtLeastOneSocial && !hasSocials) notes.push("No socials");
  if (filters.requireOriginalSocials && !hasOriginalSocials) notes.push("No Twitter/Telegram");
  return { passes: notes.length === 0, notes };
}

function pairToRunnerToken(
  pair: DexPair,
  config: MemeRunnerSolConfig,
  plan: ReturnType<typeof buildLaunchpadScanPlan>,
  taggedLaunchpadId: string | null
): MemeRunnerToken {
  const socials = extractSocials(pair);
  const { hasSocials, hasOriginalSocials } = socialFlags(socials);
  const launchedMs = toMs(pair.pairCreatedAt ?? Date.now());
  const ageMin = (Date.now() - launchedMs) / 60_000;
  const mcap = marketCapUsd(pair);
  const liq = pair.liquidity?.usd ?? 0;
  const vol = pair.volume?.h24 ?? 0;
  const feesSol = estimateFeesSol(vol, config.solPriceUsd);
  const launchpad = primaryLaunchpadForPair(pair.dexId || "", plan.enabled, taggedLaunchpadId);
  const lane = classifyLane(pair, mcap, config, plan, launchpad);
  const filters = laneFiltersFor(config, lane);
  const onBondingCurve =
    launchpad?.kind === "bonding" ||
    plan.allowedBondingDexIds.has(normalizeDexId(pair.dexId || ""));
  const bondingProgressPct = onBondingCurve
    ? mcap != null
      ? Math.min(100, (mcap / config.pumpGraduationMcapUsd) * 100)
      : null
    : null;
  const { score, notes: scoreNotes } = scoreToken(
    config,
    lane,
    filters,
    mcap,
    ageMin,
    feesSol,
    vol,
    hasSocials,
    hasOriginalSocials
  );
  const { passes: filterPasses, notes: filterNotes } = applyFilters(
    filters,
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
    launchpadId: launchpad?.id ?? null,
    launchpadLabel: launchpad?.label ?? null,
    dexUrl: slug ? `https://dexscreener.com/solana/${slug}` : null,
    launchedAt: new Date(launchedMs).toISOString(),
    filterPasses,
    filterNotes,
    scoreNotes,
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
  config: MemeRunnerSolConfig,
  plan: ReturnType<typeof buildLaunchpadScanPlan>,
  minLiquidityUsd: number,
  maxAgeMinutes: number
): Promise<TaggedPair[]> {
  const migratedIds = plan.includeMigratedPools ? [...MIGRATED_POOL_DEX_IDS] : [];
  const allowedDexIds = [...plan.allowedBondingDexIds, ...migratedIds.map((d) => normalizeDexId(d))];

  const pairs = await getMemeRunnerSolanaPairs({
    minLiquidity: minLiquidityUsd,
    maxAgeMinutes,
    allowedDexIds,
    searchQueries: plan.searchQueries,
  });

  const byKey = new Map<string, TaggedPair>();
  const add = (pair: DexPair, taggedLaunchpadId: string | null) => {
    const key = pair.pairAddress || pair.baseToken?.address;
    if (!key || !pairAllowed(pair, taggedLaunchpadId, plan)) return;
    if (!byKey.has(key)) byKey.set(key, { pair, taggedLaunchpadId });
  };

  for (const p of pairs) {
    const matches = matchLaunchpadsForPair(p.dexId || "", plan.enabled);
    add(p, matches[0]?.id ?? null);
  }

  const searchOnlyPads = plan.enabled.filter((p) => p.dexIds.length === 0 && p.searchQueries.length > 0);
  if (searchOnlyPads.length > 0) {
    const now = Date.now();
    for (const pad of searchOnlyPads) {
      const extra = await fetchSolanaPairsViaSearch(pad.searchQueries);
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

export async function scanMemeRunnerSol(
  config: MemeRunnerSolConfig,
  lane: MemeRunnerLane | "all" = "all",
  moralisEnabled = true
): Promise<MemeRunnerToken[]> {
  const plan = buildLaunchpadScanPlan(config.enabledLaunchpads, config.includeMigratedPools);
  if (plan.enabled.length === 0 && !plan.includeMigratedPools) return [];

  const { maxAgeMinutes, minLiquidityUsd } = fetchWindow(config);
  const pumpEnabled = config.enabledLaunchpads.includes("pump");

  const [tagged, moralis] = await Promise.all([
    fetchTaggedPairs(config, plan, minLiquidityUsd, maxAgeMinutes),
    moralisEnabled && pumpEnabled ? getPumpFunNewTokens(40).catch(() => []) : Promise.resolve([]),
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

  let tokens = [...byKey.values()]
    .map(({ pair, taggedLaunchpadId }) => pairToRunnerToken(pair, config, plan, taggedLaunchpadId))
    .filter((t) => {
      const f = laneFiltersFor(config, t.lane);
      return t.filterPasses && t.runnerScore >= f.minRunnerScore;
    });

  if (lane !== "all") tokens = tokens.filter((t) => t.lane === lane);
  tokens.sort((a, b) => b.runnerScore - a.runnerScore || (b.volume24hUsd ?? 0) - (a.volume24hUsd ?? 0));

  return tokens.slice(0, 80);
}

export { launchpadExternalUrl };
