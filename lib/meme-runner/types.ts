/** Meme Runner lane — mirrors Padre Trenches columns. */
export type MemeRunnerLane = "new" | "soon" | "migrated";

export type MemeRunnerChain = "sol" | "bsc" | "eth";

/** Per-lane quality filters (New / Soon / Migrated use different rules). */
export type MemeRunnerLaneFilters = {
  minTokenAgeMinutes: number;
  maxTokenAgeMinutes: number;
  minMarketCapUsd: number;
  maxMarketCapUsd: number;
  minVolume24hUsd: number;
  minEstimatedFeesSol: number;
  minLiquidityUsd: number;
  requireAtLeastOneSocial: boolean;
  requireOriginalSocials: boolean;
  minRunnerScore: number;
};

import type { MemeRunnerLaunchpadId } from "@/lib/meme-runner/launchpads";

/** Admin-tunable SOL config. */
export type MemeRunnerSolConfig = {
  /** Which launchpads to scan (Padre-style protocol list). */
  enabledLaunchpads: MemeRunnerLaunchpadId[];
  /** Include Raydium / Orca / Meteora pools (Migrated lane). */
  includeMigratedPools: boolean;
  /** Used for Soon lane scoring proximity + fee estimate. */
  targetMarketCapUsd: number;
  solPriceUsd: number;
  pumpGraduationMcapUsd: number;
  /** Lane classification thresholds (MC + DEX), not the quality filters. */
  laneNewMaxMcapUsd: number;
  laneSoonMinMcapUsd: number;
  laneSoonMaxMcapUsd: number;
  /** Quality filters per lane */
  new: MemeRunnerLaneFilters;
  soon: MemeRunnerLaneFilters;
  migrated: MemeRunnerLaneFilters;
};

export type MemeRunnerToken = {
  id: string;
  symbol: string;
  name: string;
  contractAddress: string;
  pairAddress: string | null;
  lane: MemeRunnerLane;
  marketCapUsd: number | null;
  liquidityUsd: number | null;
  volume24hUsd: number | null;
  priceUsd: number | null;
  tokenAgeMinutes: number;
  estimatedFeesSol: number;
  bondingProgressPct: number | null;
  runnerScore: number;
  twitter: string | null;
  telegram: string | null;
  website: string | null;
  hasSocials: boolean;
  hasOriginalSocials: boolean;
  dexId: string;
  launchpadId: string | null;
  launchpadLabel: string | null;
  dexUrl: string | null;
  launchedAt: string;
  filterPasses: boolean;
  filterNotes: string[];
  scoreNotes: string[];
};

export type MemeRunnerScanResult = {
  chain: MemeRunnerChain;
  lane: MemeRunnerLane | "all";
  scannedAt: string;
  config: MemeRunnerSolConfig;
  tokens: MemeRunnerToken[];
  counts: { new: number; soon: number; migrated: number; passed: number };
};
