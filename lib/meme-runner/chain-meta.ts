import type { MemeRunnerChain } from "@/lib/meme-runner/types";

export type MemeRunnerChainMeta = {
  chain: MemeRunnerChain;
  /** DexScreener chainId filter values */
  dexChainIds: string[];
  /** URL segment for dexscreener.com/{segment}/... */
  dexScreenerSlug: string;
  nativeSymbol: string;
  /** Label for migrated lane empty state */
  migratedPoolsLabel: string;
  /** Default native USD price for fee estimates */
  defaultNativePriceUsd: number;
  /** Moralis pump.fun feed (SOL only) */
  moralisPumpNew?: boolean;
};

export const MEME_RUNNER_CHAIN_META: Record<MemeRunnerChain, MemeRunnerChainMeta> = {
  sol: {
    chain: "sol",
    dexChainIds: ["solana"],
    dexScreenerSlug: "solana",
    nativeSymbol: "SOL",
    migratedPoolsLabel: "Raydium, Orca, or Meteora",
    defaultNativePriceUsd: 150,
    moralisPumpNew: true,
  },
  bsc: {
    chain: "bsc",
    dexChainIds: ["bsc", "bnb"],
    dexScreenerSlug: "bsc",
    nativeSymbol: "BNB",
    migratedPoolsLabel: "PancakeSwap and other BSC AMMs",
    defaultNativePriceUsd: 600,
  },
  eth: {
    chain: "eth",
    dexChainIds: ["ethereum"],
    dexScreenerSlug: "ethereum",
    nativeSymbol: "ETH",
    migratedPoolsLabel: "Uniswap, SushiSwap, and other ETH AMMs",
    defaultNativePriceUsd: 3500,
  },
};

export function getChainMeta(chain: MemeRunnerChain): MemeRunnerChainMeta {
  return MEME_RUNNER_CHAIN_META[chain];
}

/** AI Agent handoff chain id */
export function memeRunnerAgentChain(chain: MemeRunnerChain): "solana" | "bsc" | "ethereum" {
  if (chain === "bsc") return "bsc";
  if (chain === "eth") return "ethereum";
  return "solana";
}
