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

/** Soon: favor $35k–$75k + mid-curve; gates kept passable so the lane isn’t empty at scan time. */
const SOON_FILTERS: MemeRunnerLaneFilters = {
  minTokenAgeMinutes: 15,
  maxTokenAgeMinutes: 360,
  minMarketCapUsd: 25_000,
  maxMarketCapUsd: 90_000,
  minVolume24hUsd: 2_500,
  minEstimatedFeesSol: 0.35,
  minLiquidityUsd: 2_500,
  requireAtLeastOneSocial: false,
  requireOriginalSocials: false,
  minRunnerScore: 35,
  minContinuationScore: 32,
  maxBondingProgressPct: null,
  continuationSweetMinMcapUsd: 35_000,
  continuationSweetMaxMcapUsd: 72_000,
};

const NEW_FILTERS: MemeRunnerLaneFilters = {
  ...CONTINUATION_OFF,
  minTokenAgeMinutes: 5,
  maxTokenAgeMinutes: 180,
  minMarketCapUsd: 1_500,
  maxMarketCapUsd: 24_000,
  minVolume24hUsd: 250,
  minEstimatedFeesSol: 0.05,
  minLiquidityUsd: 250,
  requireAtLeastOneSocial: false,
  requireOriginalSocials: false,
  minRunnerScore: 24,
};

/** Post-migration runners (Raydium etc.) — separate from Soon bonding rules. */
const MIGRATED_FILTERS: MemeRunnerLaneFilters = {
  ...CONTINUATION_OFF,
  minTokenAgeMinutes: 10,
  maxTokenAgeMinutes: 10_080,
  minMarketCapUsd: 12_000,
  maxMarketCapUsd: 5_000_000,
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
    targetMarketCapUsd: 50_000,
    solPriceUsd: meta.defaultNativePriceUsd,
    pumpGraduationMcapUsd: chain === "sol" ? 69_000 : 80_000,
    laneNewMaxMcapUsd: 28_000,
    laneSoonMinMcapUsd: 25_000,
    laneSoonMaxMcapUsd: chain === "sol" ? 95_000 : 120_000,
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

/** DB configs that copied Soon rules onto New by mistake (45m+ age gate). */
function repairLaneFilters(chain: MemeRunnerChain, config: MemeRunnerSolConfig): MemeRunnerSolConfig {
  const d = defaultMemeRunnerConfig(chain);
  let { new: n, soon: s, migrated: m } = config;
  if (n.minTokenAgeMinutes >= 30 || n.minEstimatedFeesSol >= 1.5) {
    n = { ...d.new, ...n, ...NEW_FILTERS, minRunnerScore: Math.min(n.minRunnerScore, NEW_FILTERS.minRunnerScore) };
  }
  if (s.minEstimatedFeesSol >= 1 || s.minContinuationScore >= 48 || s.maxBondingProgressPct != null) {
    s = {
      ...d.soon,
      ...s,
      ...SOON_FILTERS,
      minRunnerScore: Math.min(s.minRunnerScore, SOON_FILTERS.minRunnerScore),
      minContinuationScore: Math.min(s.minContinuationScore, SOON_FILTERS.minContinuationScore),
    };
  }
  if (m.maxTokenAgeMinutes <= 4_000 || m.minEstimatedFeesSol >= 0.5 || m.minRunnerScore >= 30) {
    m = {
      ...d.migrated,
      ...m,
      ...MIGRATED_FILTERS,
      minRunnerScore: Math.min(m.minRunnerScore, MIGRATED_FILTERS.minRunnerScore),
      maxTokenAgeMinutes: Math.max(m.maxTokenAgeMinutes, MIGRATED_FILTERS.maxTokenAgeMinutes),
    };
  }
  const laneNewMaxMcapUsd =
    config.laneNewMaxMcapUsd <= 20_000 ? d.laneNewMaxMcapUsd : config.laneNewMaxMcapUsd;
  return { ...config, new: n, soon: s, migrated: m, laneNewMaxMcapUsd };
}

export function parseMemeRunnerConfig(chain: MemeRunnerChain, raw: unknown): MemeRunnerSolConfig {
  const d = defaultMemeRunnerConfig(chain);
  if (!raw || typeof raw !== "object") return { ...d };
  const o = raw as Record<string, unknown>;
  if (!o.new && o.minTokenAgeMinutes != null) return repairLaneFilters(chain, fromLegacyFlat(chain, o));
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
  return repairLaneFilters(chain, parsed);
}

/** @deprecated use parseMemeRunnerConfig('sol', raw) */
export function parseMemeRunnerSolConfig(raw: unknown): MemeRunnerSolConfig {
  return parseMemeRunnerConfig("sol", raw);
}

export function laneFiltersFor(config: MemeRunnerSolConfig, lane: "new" | "soon" | "migrated"): MemeRunnerLaneFilters {
  return config[lane];
}
