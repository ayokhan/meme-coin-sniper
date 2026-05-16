import type { MemeRunnerSolConfig } from "@/lib/meme-runner/types";

/**
 * Research-backed defaults (Padre Trenches / pump.fun bonding curve):
 * - ~45m age: community + fee accumulation without ultra-early sniper noise.
 * - ~2 SOL fees: meaningful on-chain activity (volume × ~1.25% bonding fee).
 * - ~$50k MC: pre-migration band (curve completes near ~$69k on pump.fun).
 * @see https://docs.padre.gg/app-guide/trenches
 * @see https://pump.fun/docs/fees
 */
export const DEFAULT_MEME_RUNNER_SOL_CONFIG: MemeRunnerSolConfig = {
  minTokenAgeMinutes: 45,
  maxTokenAgeMinutes: 480,
  targetMarketCapUsd: 50_000,
  minMarketCapUsd: 25_000,
  maxMarketCapUsd: 120_000,
  minVolume24hUsd: 8_000,
  minEstimatedFeesSol: 2,
  minLiquidityUsd: 3_000,
  requireAtLeastOneSocial: true,
  requireOriginalSocials: true,
  minRunnerScore: 55,
  solPriceUsd: 150,
  pumpGraduationMcapUsd: 69_000,
};

export function parseMemeRunnerSolConfig(raw: unknown): MemeRunnerSolConfig {
  const d = DEFAULT_MEME_RUNNER_SOL_CONFIG;
  if (!raw || typeof raw !== "object") return { ...d };
  const o = raw as Record<string, unknown>;
  const num = (k: keyof MemeRunnerSolConfig, min: number, max: number) => {
    const v = Number(o[k]);
    return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d[k] as number;
  };
  return {
    minTokenAgeMinutes: num("minTokenAgeMinutes", 0, 1440),
    maxTokenAgeMinutes: num("maxTokenAgeMinutes", 5, 2880),
    targetMarketCapUsd: num("targetMarketCapUsd", 5_000, 500_000),
    minMarketCapUsd: num("minMarketCapUsd", 1_000, 500_000),
    maxMarketCapUsd: num("maxMarketCapUsd", 5_000, 2_000_000),
    minVolume24hUsd: num("minVolume24hUsd", 0, 10_000_000),
    minEstimatedFeesSol: num("minEstimatedFeesSol", 0, 500),
    minLiquidityUsd: num("minLiquidityUsd", 0, 1_000_000),
    requireAtLeastOneSocial: o.requireAtLeastOneSocial !== false,
    requireOriginalSocials: o.requireOriginalSocials !== false,
    minRunnerScore: num("minRunnerScore", 0, 100),
    solPriceUsd: num("solPriceUsd", 10, 10_000),
    pumpGraduationMcapUsd: num("pumpGraduationMcapUsd", 30_000, 200_000),
  };
}
