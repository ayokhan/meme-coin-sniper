/** Meme Runner lane — mirrors Padre Trenches columns. */
export type MemeRunnerLane = "new" | "soon" | "migrated";

export type MemeRunnerChain = "sol" | "bsc" | "eth";

/** Admin-tunable SOL filters (Padre Trenches–inspired defaults). */
export type MemeRunnerSolConfig = {
  /** Minimum minutes since pair creation — filters instant rugs / sniper chaos. Default 45. */
  minTokenAgeMinutes: number;
  /** Max age on bonding curve before we deprioritize. Default 480 (8h). */
  maxTokenAgeMinutes: number;
  /** Target market cap band center (~$50k pre-migration sweet spot). */
  targetMarketCapUsd: number;
  minMarketCapUsd: number;
  maxMarketCapUsd: number;
  minVolume24hUsd: number;
  /** Estimated cumulative protocol fees (SOL) from volume — proxy for real activity. Default 2. */
  minEstimatedFeesSol: number;
  minLiquidityUsd: number;
  requireAtLeastOneSocial: boolean;
  /** Twitter or Telegram present (not website-only). */
  requireOriginalSocials: boolean;
  /** Minimum runner score (0–100) to appear in results. */
  minRunnerScore: number;
  /** Used to estimate fees from USD volume. */
  solPriceUsd: number;
  /** Pump.fun bonding curve graduates near ~$69k MC. */
  pumpGraduationMcapUsd: number;
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
