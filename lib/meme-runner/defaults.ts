import {
  defaultEnabledLaunchpadIds,
  parseEnabledLaunchpads,
} from "@/lib/meme-runner/launchpads";
import type { MemeRunnerLaneFilters, MemeRunnerSolConfig } from "@/lib/meme-runner/types";

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

/** Fresh pump.fun launches — looser age/fees/MC so the New column actually populates. */
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

/** Post-migration on Raydium / Orca / Meteora — higher activity bar. */
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

/**
 * Sources: pump.fun + pumpswap via DexScreener; Moralis pump.fun new feed.
 * Not Bonk / Bags / Moonshot etc. (Padre supports many launchpads; we start with pump.fun only).
 */
export const DEFAULT_MEME_RUNNER_SOL_CONFIG: MemeRunnerSolConfig = {
  enabledLaunchpads: defaultEnabledLaunchpadIds(),
  includeMigratedPools: true,
  targetMarketCapUsd: 50_000,
  solPriceUsd: 150,
  pumpGraduationMcapUsd: 69_000,
  laneNewMaxMcapUsd: 20_000,
  laneSoonMinMcapUsd: 25_000,
  laneSoonMaxMcapUsd: 120_000,
  new: { ...NEW_FILTERS },
  soon: { ...SOON_FILTERS },
  migrated: { ...MIGRATED_FILTERS },
};

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

/** Upgrade legacy flat config (pre per-lane) stored in DB. */
function fromLegacyFlat(o: Record<string, unknown>): MemeRunnerSolConfig {
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
    SOON_FILTERS
  );
  return {
    ...DEFAULT_MEME_RUNNER_SOL_CONFIG,
    targetMarketCapUsd: Number(o.targetMarketCapUsd) || DEFAULT_MEME_RUNNER_SOL_CONFIG.targetMarketCapUsd,
    solPriceUsd: Number(o.solPriceUsd) || DEFAULT_MEME_RUNNER_SOL_CONFIG.solPriceUsd,
    pumpGraduationMcapUsd: Number(o.pumpGraduationMcapUsd) || DEFAULT_MEME_RUNNER_SOL_CONFIG.pumpGraduationMcapUsd,
    laneNewMaxMcapUsd: Number(o.laneNewMaxMcapUsd) || DEFAULT_MEME_RUNNER_SOL_CONFIG.laneNewMaxMcapUsd,
    laneSoonMinMcapUsd: Number(o.laneSoonMinMcapUsd) || DEFAULT_MEME_RUNNER_SOL_CONFIG.laneSoonMinMcapUsd,
    laneSoonMaxMcapUsd: Number(o.laneSoonMaxMcapUsd) || DEFAULT_MEME_RUNNER_SOL_CONFIG.laneSoonMaxMcapUsd,
    soon,
    new: { ...NEW_FILTERS },
    migrated: { ...MIGRATED_FILTERS },
  };
}

export function parseMemeRunnerSolConfig(raw: unknown): MemeRunnerSolConfig {
  const d = DEFAULT_MEME_RUNNER_SOL_CONFIG;
  if (!raw || typeof raw !== "object") return { ...d };
  const o = raw as Record<string, unknown>;
  if (!o.new && o.minTokenAgeMinutes != null) return fromLegacyFlat(o);
  const numShared = (k: keyof MemeRunnerSolConfig, min: number, max: number) => {
    const v = Number(o[k]);
    return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : (d[k] as number);
  };
  return {
    enabledLaunchpads: parseEnabledLaunchpads(o.enabledLaunchpads),
    includeMigratedPools: o.includeMigratedPools !== false,
    targetMarketCapUsd: numShared("targetMarketCapUsd", 5_000, 500_000),
    solPriceUsd: numShared("solPriceUsd", 10, 10_000),
    pumpGraduationMcapUsd: numShared("pumpGraduationMcapUsd", 30_000, 200_000),
    laneNewMaxMcapUsd: numShared("laneNewMaxMcapUsd", 5_000, 100_000),
    laneSoonMinMcapUsd: numShared("laneSoonMinMcapUsd", 5_000, 500_000),
    laneSoonMaxMcapUsd: numShared("laneSoonMaxMcapUsd", 10_000, 2_000_000),
    new: parseLaneFilters(o.new, d.new),
    soon: parseLaneFilters(o.soon, d.soon),
    migrated: parseLaneFilters(o.migrated, d.migrated),
  };
}

export function laneFiltersFor(config: MemeRunnerSolConfig, lane: "new" | "soon" | "migrated"): MemeRunnerLaneFilters {
  return config[lane];
}
