import { getChainMeta } from "@/lib/meme-runner/chain-meta";
import { defaultEnabledLaunchpadIds, parseEnabledLaunchpads } from "@/lib/meme-runner/launchpads";
import type { MemeRunnerChain, MemeRunnerLaneFilters, MemeRunnerSolConfig } from "@/lib/meme-runner/types";

const CONTINUATION_OFF: Pick<
  MemeRunnerLaneFilters,
  "minContinuationScore" | "maxBondingProgressPct" | "continuationSweetMinMcapUsd" | "continuationSweetMaxMcapUsd"
> = {
  minContinuationScore: 0,
  maxBondingProgressPct: null,
  continuationSweetMinMcapUsd: 0,
  continuationSweetMaxMcapUsd: 0,
};

/** Pumpswap “about to graduate” band — still Soon, not Migrated. */
export const SOON_GRADUATING_MC_MIN_USD = 85_000;
export const SOON_GRADUATING_MC_MAX_USD = 120_000;
export const SOON_GRADUATING_CURVE_MIN_PCT = 88;

/** Soon: $50k→$100k pump.fun + $85k→$120k graduating pumpswap; sorted by Run score. */
const SOON_FILTERS: MemeRunnerLaneFilters = {
  minTokenAgeMinutes: 12,
  maxTokenAgeMinutes: 720,
  minMarketCapUsd: 42_000,
  maxMarketCapUsd: 150_000,
  minVolume24hUsd: 1_500,
  minEstimatedFeesSol: 0.25,
  minLiquidityUsd: 1_800,
  requireAtLeastOneSocial: false,
  requireOriginalSocials: false,
  minRunnerScore: 24,
  minContinuationScore: 0,
  maxBondingProgressPct: null,
  continuationSweetMinMcapUsd: 50_000,
  continuationSweetMaxMcapUsd: 100_000,
};

const NEW_FILTERS: MemeRunnerLaneFilters = {
  ...CONTINUATION_OFF,
  minTokenAgeMinutes: 5,
  maxTokenAgeMinutes: 180,
  minMarketCapUsd: 1_500,
  maxMarketCapUsd: 28_000,
  minVolume24hUsd: 250,
  minEstimatedFeesSol: 0.05,
  minLiquidityUsd: 250,
  requireAtLeastOneSocial: false,
  requireOriginalSocials: false,
  minRunnerScore: 24,
};

/** Migrated: fresh Raydium grads (~$25k+) before they’re multi-million; tune max MC in admin. */
const MIGRATED_FILTERS: MemeRunnerLaneFilters = {
  ...CONTINUATION_OFF,
  minTokenAgeMinutes: 10,
  maxTokenAgeMinutes: 10_080,
  minMarketCapUsd: 25_000,
  maxMarketCapUsd: 1_200_000,
  minVolume24hUsd: 800,
  minEstimatedFeesSol: 0.15,
  minLiquidityUsd: 1_200,
  requireAtLeastOneSocial: false,
  requireOriginalSocials: false,
  minRunnerScore: 22,
};

function baseDefaults(chain: MemeRunnerChain): MemeRunnerSolConfig {
  const meta = getChainMeta(chain);
  const soon = { ...SOON_FILTERS };
  const migrated = { ...MIGRATED_FILTERS };
  const newF = { ...NEW_FILTERS };
  if (chain === "bsc") {
    soon.minEstimatedFeesSol = 0.35;
    migrated.minEstimatedFeesSol = 0.5;
    newF.minEstimatedFeesSol = 0.05;
  }
  if (chain === "eth") {
    soon.minEstimatedFeesSol = 0.15;
    migrated.minEstimatedFeesSol = 0.25;
    newF.minEstimatedFeesSol = 0.02;
  }
  return {
    enabledLaunchpads: defaultEnabledLaunchpadIds(chain),
    includeMigratedPools: true,
    targetMarketCapUsd: 72_000,
    solPriceUsd: meta.defaultNativePriceUsd,
    pumpGraduationMcapUsd: chain === "sol" ? 69_000 : 80_000,
    laneNewMaxMcapUsd: 40_000,
    laneSoonMinMcapUsd: 42_000,
    laneSoonMaxMcapUsd: chain === "sol" ? 150_000 : 180_000,
    new: newF,
    soon: {
      ...soon,
      minMarketCapUsd: 42_000,
      maxMarketCapUsd: chain === "sol" ? 150_000 : 180_000,
    },
    migrated,
  };
}

export const DEFAULT_MEME_RUNNER_SOL_CONFIG = baseDefaults("sol");
export const DEFAULT_MEME_RUNNER_BSC_CONFIG = baseDefaults("bsc");
export const DEFAULT_MEME_RUNNER_ETH_CONFIG = baseDefaults("eth");

export function defaultMemeRunnerConfig(chain: MemeRunnerChain): MemeRunnerSolConfig {
  if (chain === "bsc") return { ...DEFAULT_MEME_RUNNER_BSC_CONFIG };
  if (chain === "eth") return { ...DEFAULT_MEME_RUNNER_ETH_CONFIG };
  return { ...DEFAULT_MEME_RUNNER_SOL_CONFIG };
}

function parseLaneFilters(raw: unknown, fallback: MemeRunnerLaneFilters): MemeRunnerLaneFilters {
  if (!raw || typeof raw !== "object") return { ...fallback };
  const o = raw as Record<string, unknown>;
  const num = (k: keyof MemeRunnerLaneFilters, min: number, max: number): number => {
    const fb = fallback[k] as number;
    const v = Number(o[k]);
    return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fb;
  };
  return {
    minTokenAgeMinutes: num("minTokenAgeMinutes", 0, 1440),
    maxTokenAgeMinutes: num("maxTokenAgeMinutes", 5, 2880),
    minMarketCapUsd: num("minMarketCapUsd", 0, 2_000_000),
    maxMarketCapUsd: num("maxMarketCapUsd", 1_000, 5_000_000),
    minVolume24hUsd: num("minVolume24hUsd", 0, 10_000_000),
    minEstimatedFeesSol: num("minEstimatedFeesSol", 0, 500),
    minLiquidityUsd: num("minLiquidityUsd", 0, 1_000_000),
    requireAtLeastOneSocial:
      typeof o.requireAtLeastOneSocial === "boolean"
        ? o.requireAtLeastOneSocial
        : fallback.requireAtLeastOneSocial,
    requireOriginalSocials:
      typeof o.requireOriginalSocials === "boolean"
        ? o.requireOriginalSocials
        : fallback.requireOriginalSocials,
    minRunnerScore: num("minRunnerScore", 0, 100),
    minContinuationScore: num("minContinuationScore", 0, 100),
    maxBondingProgressPct:
      o.maxBondingProgressPct === undefined
        ? fallback.maxBondingProgressPct
        : o.maxBondingProgressPct === null || o.maxBondingProgressPct === ""
          ? null
          : num("maxBondingProgressPct", 50, 100),
    continuationSweetMinMcapUsd: num("continuationSweetMinMcapUsd", 1_000, 500_000),
    continuationSweetMaxMcapUsd: num("continuationSweetMaxMcapUsd", 5_000, 2_000_000),
  };
}

function fromLegacyFlat(chain: MemeRunnerChain, o: Record<string, unknown>): MemeRunnerSolConfig {
  const d = defaultMemeRunnerConfig(chain);
  const soon = parseLaneFilters(
    {
      minTokenAgeMinutes: o.minTokenAgeMinutes,
      maxTokenAgeMinutes: o.maxTokenAgeMinutes,
      minMarketCapUsd: o.minMarketCapUsd,
      maxMarketCapUsd: o.maxMarketCapUsd,
      minVolume24hUsd: o.minVolume24hUsd,
      minEstimatedFeesSol: o.minEstimatedFeesSol,
      minLiquidityUsd: o.minLiquidityUsd,
      requireAtLeastOneSocial: o.requireAtLeastOneSocial,
      requireOriginalSocials: o.requireOriginalSocials,
      minRunnerScore: o.minRunnerScore,
    },
    d.soon
  );
  return {
    ...d,
    enabledLaunchpads: parseEnabledLaunchpads(chain, o.enabledLaunchpads),
    includeMigratedPools: o.includeMigratedPools !== false,
    targetMarketCapUsd: Number(o.targetMarketCapUsd) || d.targetMarketCapUsd,
    solPriceUsd: Number(o.solPriceUsd) || d.solPriceUsd,
    pumpGraduationMcapUsd: Number(o.pumpGraduationMcapUsd) || d.pumpGraduationMcapUsd,
    laneNewMaxMcapUsd: Number(o.laneNewMaxMcapUsd) || d.laneNewMaxMcapUsd,
    laneSoonMinMcapUsd: Number(o.laneSoonMinMcapUsd) || d.laneSoonMinMcapUsd,
    laneSoonMaxMcapUsd: Number(o.laneSoonMaxMcapUsd) || d.laneSoonMaxMcapUsd,
    soon,
    new: { ...d.new },
    migrated: { ...d.migrated },
  };
}

/** Only fix legacy New lane that copied Soon age/fees; never overwrite admin Soon/Migrated saves. */
function repairLaneFilters(chain: MemeRunnerChain, config: MemeRunnerSolConfig): MemeRunnerSolConfig {
  const d = defaultMemeRunnerConfig(chain);
  let { new: n } = config;
  if (n.minTokenAgeMinutes >= 30 || n.minEstimatedFeesSol >= 1.5) {
    n = { ...d.new, ...n, ...NEW_FILTERS, minRunnerScore: Math.min(n.minRunnerScore, NEW_FILTERS.minRunnerScore) };
  }
  const laneNewMaxMcapUsd =
    config.laneNewMaxMcapUsd <= 20_000 ? d.laneNewMaxMcapUsd : config.laneNewMaxMcapUsd;
  return { ...config, new: n, laneNewMaxMcapUsd };
}

export type ParseMemeRunnerOptions = { repairLegacy?: boolean };

export function parseMemeRunnerConfig(
  chain: MemeRunnerChain,
  raw: unknown,
  options?: ParseMemeRunnerOptions
): MemeRunnerSolConfig {
  const d = defaultMemeRunnerConfig(chain);
  if (!raw || typeof raw !== "object") return { ...d };
  const o = raw as Record<string, unknown>;
  if (!o.new && o.minTokenAgeMinutes != null) {
    const legacy = fromLegacyFlat(chain, o);
    return options?.repairLegacy ? repairLaneFilters(chain, legacy) : legacy;
  }
  const numShared = (k: keyof MemeRunnerSolConfig, min: number, max: number) => {
    const v = Number(o[k]);
    return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : (d[k] as number);
  };
  const parsed: MemeRunnerSolConfig = {
    enabledLaunchpads: parseEnabledLaunchpads(chain, o.enabledLaunchpads),
    includeMigratedPools: o.includeMigratedPools !== false,
    targetMarketCapUsd: numShared("targetMarketCapUsd", 5_000, 500_000),
    solPriceUsd: numShared("solPriceUsd", 10, 50_000),
    pumpGraduationMcapUsd: numShared("pumpGraduationMcapUsd", 30_000, 200_000),
    laneNewMaxMcapUsd: numShared("laneNewMaxMcapUsd", 5_000, 100_000),
    laneSoonMinMcapUsd: numShared("laneSoonMinMcapUsd", 5_000, 500_000),
    laneSoonMaxMcapUsd: numShared("laneSoonMaxMcapUsd", 10_000, 2_000_000),
    new: parseLaneFilters(o.new, d.new),
    soon: parseLaneFilters(o.soon, d.soon),
    migrated: parseLaneFilters(o.migrated, d.migrated),
  };
  return options?.repairLegacy ? repairLaneFilters(chain, parsed) : parsed;
}

/** @deprecated use parseMemeRunnerConfig('sol', raw) */
export function parseMemeRunnerSolConfig(raw: unknown): MemeRunnerSolConfig {
  return parseMemeRunnerConfig("sol", raw);
}

export function laneFiltersFor(config: MemeRunnerSolConfig, lane: "new" | "soon" | "migrated"): MemeRunnerLaneFilters {
  return config[lane];
}
