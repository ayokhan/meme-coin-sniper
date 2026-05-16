import { getChainMeta } from "@/lib/meme-runner/chain-meta";
import { defaultEnabledLaunchpadIds, parseEnabledLaunchpads } from "@/lib/meme-runner/launchpads";
import type { MemeRunnerChain, MemeRunnerLaneFilters, MemeRunnerSolConfig } from "@/lib/meme-runner/types";

const SOON_FILTERS: MemeRunnerLaneFilters = {
  minTokenAgeMinutes: 45,
  maxTokenAgeMinutes: 480,
  minMarketCapUsd: 25_000,
  maxMarketCapUsd: 120_000,
  minVolume24hUsd: 8_000,
  minEstimatedFeesSol: 2,
  minLiquidityUsd: 3_000,
  requireAtLeastOneSocial: true,
  requireOriginalSocials: true,
  minRunnerScore: 55,
};

const NEW_FILTERS: MemeRunnerLaneFilters = {
  minTokenAgeMinutes: 8,
  maxTokenAgeMinutes: 120,
  minMarketCapUsd: 2_000,
  maxMarketCapUsd: 22_000,
  minVolume24hUsd: 800,
  minEstimatedFeesSol: 0.25,
  minLiquidityUsd: 400,
  requireAtLeastOneSocial: true,
  requireOriginalSocials: false,
  minRunnerScore: 35,
};

const MIGRATED_FILTERS: MemeRunnerLaneFilters = {
  minTokenAgeMinutes: 20,
  maxTokenAgeMinutes: 1_440,
  minMarketCapUsd: 35_000,
  maxMarketCapUsd: 800_000,
  minVolume24hUsd: 12_000,
  minEstimatedFeesSol: 2.5,
  minLiquidityUsd: 8_000,
  requireAtLeastOneSocial: true,
  requireOriginalSocials: true,
  minRunnerScore: 50,
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
    targetMarketCapUsd: 50_000,
    solPriceUsd: meta.defaultNativePriceUsd,
    pumpGraduationMcapUsd: chain === "sol" ? 69_000 : 80_000,
    laneNewMaxMcapUsd: 20_000,
    laneSoonMinMcapUsd: 25_000,
    laneSoonMaxMcapUsd: 120_000,
    new: newF,
    soon,
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
    requireAtLeastOneSocial: o.requireAtLeastOneSocial !== false,
    requireOriginalSocials: o.requireOriginalSocials === true,
    minRunnerScore: num("minRunnerScore", 0, 100),
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

export function parseMemeRunnerConfig(chain: MemeRunnerChain, raw: unknown): MemeRunnerSolConfig {
  const d = defaultMemeRunnerConfig(chain);
  if (!raw || typeof raw !== "object") return { ...d };
  const o = raw as Record<string, unknown>;
  if (!o.new && o.minTokenAgeMinutes != null) return fromLegacyFlat(chain, o);
  const numShared = (k: keyof MemeRunnerSolConfig, min: number, max: number) => {
    const v = Number(o[k]);
    return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : (d[k] as number);
  };
  return {
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
}

/** @deprecated use parseMemeRunnerConfig('sol', raw) */
export function parseMemeRunnerSolConfig(raw: unknown): MemeRunnerSolConfig {
  return parseMemeRunnerConfig("sol", raw);
}

export function laneFiltersFor(config: MemeRunnerSolConfig, lane: "new" | "soon" | "migrated"): MemeRunnerLaneFilters {
  return config[lane];
}
