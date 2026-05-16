/**
 * Solana meme launchpads — Padre Trenches–style catalog.
 * DexScreener `dexId` values vary; we also use search queries to surface pairs.
 */

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
  id: MemeRunnerLaunchpadId;
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

export const MIGRATED_POOL_DEX_IDS = ["raydium", "orca", "meteora"] as const;

export const MEME_RUNNER_LAUNCHPADS: MemeRunnerLaunchpadDef[] = [
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

const BY_ID = new Map(MEME_RUNNER_LAUNCHPADS.map((p) => [p.id, p]));

export function getLaunchpad(id: string): MemeRunnerLaunchpadDef | undefined {
  return BY_ID.get(id as MemeRunnerLaunchpadId);
}

export function defaultEnabledLaunchpadIds(): MemeRunnerLaunchpadId[] {
  return MEME_RUNNER_LAUNCHPADS.filter((p) => p.defaultEnabled).map((p) => p.id);
}

export function allLaunchpadIds(): MemeRunnerLaunchpadId[] {
  return MEME_RUNNER_LAUNCHPADS.map((p) => p.id);
}

export function parseEnabledLaunchpads(raw: unknown): MemeRunnerLaunchpadId[] {
  const valid = new Set(allLaunchpadIds());
  if (!Array.isArray(raw) || raw.length === 0) return defaultEnabledLaunchpadIds();
  const ids = raw.filter((x): x is MemeRunnerLaunchpadId => typeof x === "string" && valid.has(x as MemeRunnerLaunchpadId));
  return ids.length > 0 ? ids : defaultEnabledLaunchpadIds();
}

export type LaunchpadScanPlan = {
  enabled: MemeRunnerLaunchpadDef[];
  allowedBondingDexIds: Set<string>;
  searchQueries: string[];
  includeMigratedPools: boolean;
};

export function buildLaunchpadScanPlan(
  enabledIds: MemeRunnerLaunchpadId[],
  includeMigratedPools = true
): LaunchpadScanPlan {
  const enabled = enabledIds.map((id) => getLaunchpad(id)).filter((p): p is MemeRunnerLaunchpadDef => !!p);
  const allowedBondingDexIds = new Set<string>();
  const searchQueries: string[] = [];
  for (const p of enabled) {
    for (const d of p.dexIds) allowedBondingDexIds.add(normalizeDexId(d));
    searchQueries.push(...p.searchQueries);
  }
  return {
    enabled,
    allowedBondingDexIds,
    searchQueries: [...new Set(searchQueries)],
    includeMigratedPools,
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
  dexId: string,
  enabled: MemeRunnerLaunchpadDef[],
  taggedId?: string | null
): MemeRunnerLaunchpadDef | null {
  if (taggedId) {
    const t = getLaunchpad(taggedId);
    if (t && enabled.some((e) => e.id === t.id)) return t;
  }
  const matches = matchLaunchpadsForPair(dexId, enabled);
  if (matches.length > 0) return matches[0];
  if (MIGRATED_POOL_DEX_IDS.includes(normalizeDexId(dexId) as (typeof MIGRATED_POOL_DEX_IDS)[number])) {
    return null;
  }
  return null;
}

export function launchpadExternalUrl(launchpadId: string | null, contractAddress: string): string | null {
  switch (launchpadId) {
    case "pump":
      return `https://pump.fun/coin/${contractAddress}`;
    case "bags":
      return `https://bags.fm/${contractAddress}`;
    case "bonk":
      return `https://letsbonk.fun/token/${contractAddress}`;
    default:
      return null;
  }
}
