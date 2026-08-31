import type { DexPair } from "@/lib/api-clients/dexscreener";
import { isMigratedPoolDex, normalizeDexId } from "@/lib/meme-runner/launchpads";

import type { MemeRunnerChain } from "@/lib/meme-runner/types";

export type GoHuntingView = "new_pairs" | "final_stretch" | "migrated";
export type GoHuntingChain = "solana" | "bsc" | "robinhood" | "hyperevm";

function toMemeRunnerChain(chain: GoHuntingChain): MemeRunnerChain | null {
  if (chain === "solana") return "sol";
  if (chain === "bsc") return "bsc";
  return null;
}

/** Pump.fun graduation market cap (~$69k) — pumpswap above this is treated as migrated. */
const PUMP_GRADUATION_MC_USD = 69_000;
const MEME_GRADUATION_MC_USD = 69_000;

const SOL_BONDING_DEX = new Set(["pumpfun", "pumpswap"]);
const BSC_BONDING_DEX = new Set(["fourmeme"]);

export function pairMarketCapUsd(pair: DexPair): number | null {
  const fdv = pair.fdv;
  if (fdv != null && Number.isFinite(fdv) && fdv > 0) return fdv;
  const liq = pair.liquidity?.usd;
  if (liq != null && liq > 0) return liq * 2;
  return null;
}

function isSolanaBondingPair(pair: DexPair): boolean {
  const dex = normalizeDexId(pair.dexId || "");
  if (isMigratedPoolDex(toMemeRunnerChain("solana")!, pair.dexId || "")) return false;
  if (dex.includes("pumpfun")) return true;
  if (dex.includes("pumpswap")) {
    const mc = pairMarketCapUsd(pair) ?? 0;
    return mc < PUMP_GRADUATION_MC_USD * 0.95;
  }
  return SOL_BONDING_DEX.has(dex);
}

function isSolanaMigratedPair(pair: DexPair): boolean {
  if (isMigratedPoolDex(toMemeRunnerChain("solana")!, pair.dexId || "")) return true;
  const dex = normalizeDexId(pair.dexId || "");
  if (dex.includes("pumpswap")) {
    const mc = pairMarketCapUsd(pair) ?? 0;
    return mc >= PUMP_GRADUATION_MC_USD * 0.95;
  }
  return false;
}

function isBscBondingPair(pair: DexPair): boolean {
  const dex = normalizeDexId(pair.dexId || "");
  if (isMigratedPoolDex(toMemeRunnerChain("bsc")!, pair.dexId || "")) return false;
  return BSC_BONDING_DEX.has(dex) || dex.includes("fourmeme");
}

function isBscMigratedPair(pair: DexPair): boolean {
  return isMigratedPoolDex(toMemeRunnerChain("bsc")!, pair.dexId || "");
}

/** Robinhood / HyperEVM: no bonding launchpad — use mcap bands for final stretch vs migrated. */
function isMcapBondingPair(pair: DexPair): boolean {
  const mc = pairMarketCapUsd(pair) ?? 0;
  return mc > 0 && mc < MEME_GRADUATION_MC_USD * 0.95;
}

function isMcapMigratedPair(pair: DexPair): boolean {
  const mc = pairMarketCapUsd(pair) ?? 0;
  return mc >= MEME_GRADUATION_MC_USD * 0.95;
}

export function classifyGoHuntingPair(
  chain: GoHuntingChain,
  pair: DexPair
): "new_pairs" | "final_stretch" | "migrated" {
  if (chain === "solana") {
    if (isSolanaMigratedPair(pair)) return "migrated";
    if (isSolanaBondingPair(pair)) return "final_stretch";
    return "new_pairs";
  }
  if (chain === "bsc") {
    if (isBscMigratedPair(pair)) return "migrated";
    if (isBscBondingPair(pair)) return "final_stretch";
    return "new_pairs";
  }
  if (isMcapMigratedPair(pair)) return "migrated";
  if (isMcapBondingPair(pair)) return "final_stretch";
  return "new_pairs";
}

export function filterPairsForGoHuntingView(
  pairs: DexPair[],
  view: GoHuntingView,
  chain: GoHuntingChain
): DexPair[] {
  if (view === "new_pairs") return pairs;
  return pairs.filter((p) => classifyGoHuntingPair(chain, p) === view);
}

export const GO_HUNTING_DEX_ALLOWLIST: Record<GoHuntingChain, Record<GoHuntingView, string[]>> = {
  solana: {
    new_pairs: ["pumpfun", "pump.fun", "pumpswap", "raydium", "orca", "meteora"],
    final_stretch: ["pumpfun", "pump.fun", "pumpswap"],
    migrated: ["raydium", "orca", "meteora", "pumpswap"],
  },
  bsc: {
    new_pairs: ["fourmeme", "four.meme", "pancakeswap", "pancakeswap_v2", "pancakeswap_v3", "biswap", "apeswap", "thena"],
    final_stretch: ["fourmeme", "four.meme"],
    migrated: ["pancakeswap", "pancakeswap_v2", "pancakeswap_v3", "biswap", "apeswap", "thena"],
  },
  robinhood: {
    new_pairs: ["uniswap", "uniswap_v2", "uniswap_v3", "uniswap_v4"],
    final_stretch: ["uniswap", "uniswap_v2", "uniswap_v3", "uniswap_v4"],
    migrated: ["uniswap", "uniswap_v2", "uniswap_v3", "uniswap_v4"],
  },
  hyperevm: {
    new_pairs: ["hyperswap", "kinetiq", "liquidswap", "hybra", "ramses"],
    final_stretch: ["hyperswap", "kinetiq", "liquidswap", "hybra", "ramses"],
    migrated: ["hyperswap", "kinetiq", "liquidswap", "hybra", "ramses"],
  },
};
