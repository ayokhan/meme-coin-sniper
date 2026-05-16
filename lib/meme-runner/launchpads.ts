/**
 * Meme launchpad catalogs per chain (DexScreener dexId + search queries).
 */

import type { MemeRunnerChain } from "@/lib/meme-runner/types";

export type MemeRunnerLaunchpadId =
  | "pump"
  | "bonk"
  | "bags"
  | "liquid"
  | "moonshot"
  | "candle"
  | "jupiter_studio"
  | "launchlab"
  | "mayhem"
  | "bonkers"
  | "surge"
  | "heaven"
  | "sugar"
  | "moonit"
  | "dynamic_bc"
  | "printr"
  | "soar"
  | "daos"
  | "believe"
  | "boop";

export type MemeRunnerLaunchpadDef = {
  id: string;
  label: string;
  /** DexScreener dexId values (normalized lowercase, no dots). */
  dexIds: string[];
  /** Extra DexScreener search terms to pull pairs for this pad. */
  searchQueries: string[];
  /** Default on for new installs. */
  defaultEnabled: boolean;
  /** Bonding-curve style pads use New/Soon lanes; migrated pools are separate. */
  kind: "bonding" | "amm";
};

/** Normalize dexId for comparison (pump.fun → pumpfun). */
export function normalizeDexId(dexId: string): string {
  return (dexId || "").toLowerCase().replace(/\./g, "");
}

export const MIGRATED_POOL_DEX_IDS_SOL = ["raydium", "orca", "meteora"] as const;
export const MIGRATED_POOL_DEX_IDS_BSC = ["pancakeswap", "pancakeswapv2", "pancakeswapv3", "biswap", "apeswap", "thena"] as const;
export const MIGRATED_POOL_DEX_IDS_ETH = ["uniswap", "sushiswap", "balancer"] as const;

/** @deprecated use getMigratedDexIds(chain) */
export const MIGRATED_POOL_DEX_IDS = MIGRATED_POOL_DEX_IDS_SOL;

export function getMigratedDexIds(chain: MemeRunnerChain): readonly string[] {
  if (chain === "bsc") return MIGRATED_POOL_DEX_IDS_BSC;
  if (chain === "eth") return MIGRATED_POOL_DEX_IDS_ETH;
  return MIGRATED_POOL_DEX_IDS_SOL;
}

export function isMigratedPoolDex(chain: MemeRunnerChain, dexId: string): boolean {
  const n = normalizeDexId(dexId);
  return getMigratedDexIds(chain).some((d) => {
    const nd = normalizeDexId(d);
    return n === nd || n.includes(nd) || nd.includes(n);
  });
}

export const MEME_RUNNER_LAUNCHPADS_SOL: MemeRunnerLaunchpadDef[] = [
  {
    id: "pump",
    label: "Pump",
    dexIds: ["pumpfun", "pumpswap"],
    searchQueries: ["pump.fun", "pumpfun", "pumpswap"],
    defaultEnabled: true,
    kind: "bonding",
  },
  {
    id: "bonk",
    label: "Bonk",
    dexIds: ["launchlab"],
    searchQueries: ["letsbonk", "bonkfun", "bonk launch", "letsbonk.fun"],
    defaultEnabled: true,
    kind: "bonding",
  },
  {
    id: "bags",
    label: "Bags",
    dexIds: ["bags"],
    searchQueries: ["bags", "bags.fm"],
    defaultEnabled: true,
    kind: "bonding",
  },
  {
    id: "liquid",
    label: "Liquid",
    dexIds: [],
    searchQueries: ["liquid launchpad solana"],
    defaultEnabled: false,
    kind: "bonding",
  },
  {
    id: "moonshot",
    label: "Moonshot",
    dexIds: ["meteoradbc"],
    searchQueries: ["moonshot solana"],
    defaultEnabled: false,
    kind: "bonding",
  },
  {
    id: "candle",
    label: "Candle",
    dexIds: [],
    searchQueries: ["candle launchpad solana"],
    defaultEnabled: false,
    kind: "bonding",
  },
  {
    id: "jupiter_studio",
    label: "Jupiter Studio",
    dexIds: [],
    searchQueries: ["jupiter studio launch"],
    defaultEnabled: false,
    kind: "bonding",
  },
  {
    id: "launchlab",
    label: "LaunchLab",
    dexIds: ["launchlab"],
    searchQueries: ["launchlab raydium"],
    defaultEnabled: false,
    kind: "bonding",
  },
  {
    id: "mayhem",
    label: "Mayhem",
    dexIds: [],
    searchQueries: ["mayhem launchpad"],
    defaultEnabled: false,
    kind: "bonding",
  },
  {
    id: "bonkers",
    label: "Bonkers",
    dexIds: [],
    searchQueries: ["bonkers launchpad"],
    defaultEnabled: false,
    kind: "bonding",
  },
  {
    id: "surge",
    label: "Surge",
    dexIds: [],
    searchQueries: ["surge launchpad solana"],
    defaultEnabled: false,
    kind: "bonding",
  },
  {
    id: "heaven",
    label: "Heaven",
    dexIds: ["heaven"],
    searchQueries: ["heaven launchpad"],
    defaultEnabled: false,
    kind: "bonding",
  },
  {
    id: "sugar",
    label: "Sugar",
    dexIds: [],
    searchQueries: ["sugar launchpad solana"],
    defaultEnabled: false,
    kind: "bonding",
  },
  {
    id: "moonit",
    label: "Moonit",
    dexIds: ["moonit"],
    searchQueries: ["moonit"],
    defaultEnabled: false,
    kind: "bonding",
  },
  {
    id: "dynamic_bc",
    label: "Dynamic BC",
    dexIds: ["meteoradbc"],
    searchQueries: ["dynamic bc meteora"],
    defaultEnabled: false,
    kind: "bonding",
  },
  {
    id: "printr",
    label: "Printr",
    dexIds: ["printr"],
    searchQueries: ["printr"],
    defaultEnabled: false,
    kind: "bonding",
  },
  {
    id: "soar",
    label: "Soar",
    dexIds: [],
    searchQueries: ["soar launchpad solana"],
    defaultEnabled: false,
    kind: "bonding",
  },
  {
    id: "daos",
    label: "Daos.fun",
    dexIds: [],
    searchQueries: ["daos.fun"],
    defaultEnabled: false,
    kind: "bonding",
  },
  {
    id: "believe",
    label: "Believe",
    dexIds: [],
    searchQueries: ["believe launchpad"],
    defaultEnabled: false,
    kind: "bonding",
  },
  {
    id: "boop",
    label: "Boop",
    dexIds: [],
    searchQueries: ["boop launchpad"],
    defaultEnabled: false,
    kind: "bonding",
  },
];

export const MEME_RUNNER_LAUNCHPADS_BSC: MemeRunnerLaunchpadDef[] = [
  {
    id: "fourmeme",
    label: "Four.meme",
    dexIds: ["fourmeme"],
    searchQueries: ["four.meme", "fourmeme", "bsc meme"],
    defaultEnabled: true,
    kind: "bonding",
  },
  {
    id: "pancakeswap",
    label: "PancakeSwap",
    dexIds: ["pancakeswap"],
    searchQueries: ["pancakeswap bsc meme"],
    defaultEnabled: false,
    kind: "bonding",
  },
  {
    id: "gra",
    label: "Gra.fun",
    dexIds: [],
    searchQueries: ["gra.fun bsc"],
    defaultEnabled: false,
    kind: "bonding",
  },
  {
    id: "flap",
    label: "Flap",
    dexIds: [],
    searchQueries: ["flap bsc launch"],
    defaultEnabled: false,
    kind: "bonding",
  },
];

export const MEME_RUNNER_LAUNCHPADS_ETH: MemeRunnerLaunchpadDef[] = [
  {
    id: "uniswap",
    label: "Uniswap",
    dexIds: ["uniswap"],
    searchQueries: ["uniswap ethereum meme", "ethereum meme"],
    defaultEnabled: true,
    kind: "bonding",
  },
  {
    id: "zora",
    label: "Zora",
    dexIds: [],
    searchQueries: ["zora ethereum"],
    defaultEnabled: false,
    kind: "bonding",
  },
  {
    id: "clanker",
    label: "Clanker",
    dexIds: [],
    searchQueries: ["clanker base", "clanker ethereum"],
    defaultEnabled: false,
    kind: "bonding",
  },
];

/** @deprecated use getLaunchpadsForChain('sol') */
export const MEME_RUNNER_LAUNCHPADS = MEME_RUNNER_LAUNCHPADS_SOL;

export function getLaunchpadsForChain(chain: MemeRunnerChain): MemeRunnerLaunchpadDef[] {
  if (chain === "bsc") return MEME_RUNNER_LAUNCHPADS_BSC;
  if (chain === "eth") return MEME_RUNNER_LAUNCHPADS_ETH;
  return MEME_RUNNER_LAUNCHPADS_SOL;
}

export function getLaunchpad(chain: MemeRunnerChain, id: string): MemeRunnerLaunchpadDef | undefined {
  return getLaunchpadsForChain(chain).find((p) => p.id === id);
}

export function defaultEnabledLaunchpadIds(chain: MemeRunnerChain): string[] {
  return getLaunchpadsForChain(chain)
    .filter((p) => p.defaultEnabled)
    .map((p) => p.id);
}

export function allLaunchpadIds(chain: MemeRunnerChain): string[] {
  return getLaunchpadsForChain(chain).map((p) => p.id);
}

export function parseEnabledLaunchpads(chain: MemeRunnerChain, raw: unknown): string[] {
  const valid = new Set(allLaunchpadIds(chain));
  const defaults = defaultEnabledLaunchpadIds(chain);
  if (!Array.isArray(raw) || raw.length === 0) return defaults;
  const ids = raw.filter((x): x is string => typeof x === "string" && valid.has(x));
  return ids.length > 0 ? ids : defaults;
}

export type LaunchpadScanPlan = {
  chain: MemeRunnerChain;
  enabled: MemeRunnerLaunchpadDef[];
  allowedBondingDexIds: Set<string>;
  searchQueries: string[];
  includeMigratedPools: boolean;
  migratedDexIds: readonly string[];
};

export function buildLaunchpadScanPlan(
  chain: MemeRunnerChain,
  enabledIds: string[],
  includeMigratedPools = true
): LaunchpadScanPlan {
  const enabled = enabledIds
    .map((id) => getLaunchpad(chain, id))
    .filter((p): p is MemeRunnerLaunchpadDef => !!p);
  const allowedBondingDexIds = new Set<string>();
  const searchQueries: string[] = [];
  for (const p of enabled) {
    for (const d of p.dexIds) allowedBondingDexIds.add(normalizeDexId(d));
    searchQueries.push(...p.searchQueries);
  }
  return {
    chain,
    enabled,
    allowedBondingDexIds,
    searchQueries: [...new Set(searchQueries)],
    includeMigratedPools,
    migratedDexIds: getMigratedDexIds(chain),
  };
}

/** Which launchpad(s) a pair belongs to (by dexId). */
export function matchLaunchpadsForPair(
  dexId: string,
  enabled: MemeRunnerLaunchpadDef[]
): MemeRunnerLaunchpadDef[] {
  const norm = normalizeDexId(dexId);
  return enabled.filter((p) => p.dexIds.some((d) => normalizeDexId(d) === norm));
}

export function primaryLaunchpadForPair(
  chain: MemeRunnerChain,
  dexId: string,
  enabled: MemeRunnerLaunchpadDef[],
  taggedId?: string | null
): MemeRunnerLaunchpadDef | null {
  if (taggedId) {
    const t = getLaunchpad(chain, taggedId);
    if (t && enabled.some((e) => e.id === t.id)) return t;
  }
  const matches = matchLaunchpadsForPair(dexId, enabled);
  if (matches.length > 0) return matches[0];
  if (isMigratedPoolDex(chain, dexId)) return null;
  return null;
}

export function launchpadExternalUrl(
  chain: MemeRunnerChain,
  launchpadId: string | null,
  contractAddress: string
): string | null {
  const addr = contractAddress.trim();
  if (!addr) return null;
  if (chain === "sol") {
    switch (launchpadId) {
      case "pump":
        return `https://pump.fun/coin/${addr}`;
      case "bags":
        return `https://bags.fm/${addr}`;
      case "bonk":
        return `https://letsbonk.fun/token/${addr}`;
      default:
        return null;
    }
  }
  if (chain === "bsc" && launchpadId === "fourmeme") {
    return `https://four.meme/token/${addr}`;
  }
  if (chain === "eth") {
    return `https://dexscreener.com/ethereum/${addr}`;
  }
  return null;
}

export function dexScreenerPairUrl(chain: MemeRunnerChain, pairOrToken: string): string {
  const slug = chain === "bsc" ? "bsc" : chain === "eth" ? "ethereum" : "solana";
  return `https://dexscreener.com/${slug}/${pairOrToken}`;
}
