import { prisma } from "@/lib/db";
import type { DexPair } from "@/lib/api-clients/dexscreener";
import {
  fetchPairsForTokens,
  type StrongRunnerChain,
  type StrongRunnerResult,
  type StrongRunnerThresholds,
} from "@/lib/strong-runners-scanner";

const CONFIG_ID = "default";
/** Repeat scans of the same chain within this window reuse the cached result (no AI call, no quota). */
export const STRONG_RUNNER_CACHE_MS = 10 * 60 * 1000;
const DAY_MS = 86_400_000;

export type StrongRunnerConfig = StrongRunnerThresholds & {
  enabled: boolean;
  vipDailyLimit: number;
};

export const DEFAULT_STRONG_RUNNER_CONFIG: StrongRunnerConfig = {
  enabled: true,
  vipDailyLimit: 10,
  minMarketCapUsd: 3_000_000,
  maxMarketCapUsd: 150_000_000,
  minLiquidityUsd: 250_000,
  minLiquidityRatio: 0.04,
  minVolume24hUsd: 1_000_000,
  minAgeHours: 48,
  minConvictionScore: 55,
};

type PickRow = {
  id: string;
  chain: string;
  tokenAddress: string;
  symbol: string;
  mcapAtFlag: number;
  flaggedAt: Date;
  peakMcap: number | null;
  lastMcap: number | null;
  mcap1d: number | null;
  mcap7d: number | null;
  mcap30d: number | null;
};

type Delegate<Row> = {
  findUnique(args: { where: Record<string, unknown> }): Promise<Row | null>;
  findFirst(args: { where: Record<string, unknown>; orderBy?: Record<string, "asc" | "desc"> }): Promise<Row | null>;
  findMany(args: {
    where?: Record<string, unknown>;
    orderBy?: Record<string, unknown> | Record<string, unknown>[];
    take?: number;
  }): Promise<Row[]>;
  create(args: { data: Record<string, unknown> }): Promise<Row>;
  update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<Row>;
  upsert(args: { where: { id: string }; create: Record<string, unknown>; update: Record<string, unknown> }): Promise<Row>;
  deleteMany(args: { where: Record<string, unknown> }): Promise<{ count: number }>;
};

function db() {
  const p = prisma as unknown as {
    strongRunnerConfig: Delegate<StrongRunnerConfig & { id: string }>;
    strongRunnerScan: Delegate<{ id: string; chain: string; result: unknown; createdAt: Date }>;
    strongRunnerPick: Delegate<PickRow>;
  };
  return { config: p.strongRunnerConfig, scan: p.strongRunnerScan, pick: p.strongRunnerPick };
}

export async function getStrongRunnerConfig(): Promise<StrongRunnerConfig> {
  try {
    const row = await db().config.findUnique({ where: { id: CONFIG_ID } });
    if (!row) return DEFAULT_STRONG_RUNNER_CONFIG;
    const { id: _id, ...rest } = row as StrongRunnerConfig & { id: string; updatedAt?: Date };
    void _id;
    return { ...DEFAULT_STRONG_RUNNER_CONFIG, ...rest };
  } catch {
    return DEFAULT_STRONG_RUNNER_CONFIG;
  }
}

export async function updateStrongRunnerConfig(patch: Partial<StrongRunnerConfig>): Promise<StrongRunnerConfig> {
  const row = await db().config.upsert({
    where: { id: CONFIG_ID },
    create: { id: CONFIG_ID, ...patch },
    update: patch,
  });
  const { id: _id, ...rest } = row as StrongRunnerConfig & { id: string };
  void _id;
  return { ...DEFAULT_STRONG_RUNNER_CONFIG, ...rest };
}

export async function getCachedScan(chain: StrongRunnerChain, maxAgeMs: number): Promise<StrongRunnerResult | null> {
  const row = await db().scan.findFirst({
    where: { chain, createdAt: { gte: new Date(Date.now() - maxAgeMs) } },
    orderBy: { createdAt: "desc" },
  });
  return row ? (row.result as StrongRunnerResult) : null;
}

export async function saveScan(result: StrongRunnerResult): Promise<void> {
  await db().scan.create({ data: { chain: result.chain, result } });
  await db().scan.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 2 * DAY_MS) } } });
}

/** Logs flagged coins (once per chain + token per 24h) so performance can be tracked afterwards. */
export async function recordPicks(result: StrongRunnerResult): Promise<void> {
  const since = new Date(Date.now() - DAY_MS);
  for (const c of result.coins) {
    const existing = await db().pick.findFirst({
      where: { chain: c.chain, tokenAddress: c.address, flaggedAt: { gte: since } },
    });
    if (existing) continue;
    await db().pick.create({
      data: {
        chain: c.chain,
        tokenAddress: c.address,
        pairAddress: c.pairAddress,
        symbol: c.symbol.slice(0, 40),
        name: c.name.slice(0, 80),
        convictionScore: c.conviction,
        narrative: c.narrative,
        mcapAtFlag: c.marketCapUsd,
        priceAtFlag: c.priceUsd,
        liquidityAtFlag: c.liquidityUsd,
        peakMcap: c.marketCapUsd,
        lastMcap: c.marketCapUsd,
        lastCheckedAt: new Date(),
      },
    });
  }
}

const DEX_CHAIN: Record<string, string> = { solana: "solana", robinhood: "robinhood", bsc: "bsc" };

function bestMcapByToken(pairs: DexPair[]): Map<string, number> {
  const best = new Map<string, { liq: number; mcap: number }>();
  for (const p of pairs) {
    const addr = p.baseToken?.address;
    if (!addr) continue;
    const liq = p.liquidity?.usd ?? 0;
    const mcap = Number((p as DexPair & { marketCap?: number }).marketCap ?? p.fdv ?? 0) || 0;
    const cur = best.get(addr);
    if (!cur || liq > cur.liq) best.set(addr, { liq, mcap });
  }
  return new Map([...best].map(([k, v]) => [k, v.mcap]));
}

/** Refreshes market cap for recent picks and fills 1d / 7d / 30d checkpoints. */
export async function trackStrongRunnerPicks(maxPicks = 200): Promise<{ checked: number }> {
  const picks = await db().pick.findMany({
    where: { flaggedAt: { gte: new Date(Date.now() - 31 * DAY_MS) } },
    orderBy: [{ lastCheckedAt: "asc" }],
    take: maxPicks,
  });
  if (!picks.length) return { checked: 0 };

  const byChain = new Map<string, PickRow[]>();
  for (const p of picks) byChain.set(p.chain, [...(byChain.get(p.chain) ?? []), p]);

  let checked = 0;
  for (const [chain, rows] of byChain) {
    const dexChain = DEX_CHAIN[chain];
    if (!dexChain) continue;
    const mcaps = bestMcapByToken(await fetchPairsForTokens(dexChain, [...new Set(rows.map((r) => r.tokenAddress))]));
    const now = Date.now();
    for (const r of rows) {
      const mcap = mcaps.get(r.tokenAddress);
      const data: Record<string, unknown> = { lastCheckedAt: new Date() };
      if (mcap != null) {
        const age = now - r.flaggedAt.getTime();
        data.lastMcap = mcap;
        data.peakMcap = Math.max(r.peakMcap ?? 0, mcap);
        if (age >= DAY_MS && r.mcap1d == null) data.mcap1d = mcap;
        if (age >= 7 * DAY_MS && r.mcap7d == null) data.mcap7d = mcap;
        if (age >= 30 * DAY_MS && r.mcap30d == null) data.mcap30d = mcap;
      }
      await db().pick.update({ where: { id: r.id }, data });
      checked++;
    }
  }
  return { checked };
}

export type TrackRecordWindow = { picks: number; medianChangePct: number | null; winRatePct: number | null };

export type StrongRunnerTrackRecord = {
  windowDays: number;
  totalPicks: number;
  after1d: TrackRecordWindow;
  after7d: TrackRecordWindow;
  bestRunners: { symbol: string; chain: string; peakMultiple: number }[];
};

function summarize(changes: number[]): TrackRecordWindow {
  if (!changes.length) return { picks: 0, medianChangePct: null, winRatePct: null };
  const sorted = [...changes].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return {
    picks: changes.length,
    medianChangePct: Math.round(median),
    winRatePct: Math.round((changes.filter((c) => c > 0).length / changes.length) * 100),
  };
}

export async function getStrongRunnerTrackRecord(chain?: StrongRunnerChain): Promise<StrongRunnerTrackRecord> {
  const windowDays = 30;
  const picks = await db().pick.findMany({
    where: { flaggedAt: { gte: new Date(Date.now() - windowDays * DAY_MS) }, ...(chain ? { chain } : {}) },
    orderBy: { flaggedAt: "desc" },
    take: 1000,
  });
  const pct = (to: number | null, from: number) => (to != null && from > 0 ? ((to - from) / from) * 100 : null);
  const d1 = picks.map((p) => pct(p.mcap1d, p.mcapAtFlag)).filter((v): v is number => v != null);
  const d7 = picks.map((p) => pct(p.mcap7d, p.mcapAtFlag)).filter((v): v is number => v != null);
  const bestRunners = picks
    .filter((p) => p.peakMcap && p.mcapAtFlag > 0)
    .map((p) => ({ symbol: p.symbol, chain: p.chain, peakMultiple: Math.round(((p.peakMcap ?? 0) / p.mcapAtFlag) * 10) / 10 }))
    .filter((p) => p.peakMultiple >= 1.5)
    .sort((a, b) => b.peakMultiple - a.peakMultiple)
    .slice(0, 3);
  return { windowDays, totalPicks: picks.length, after1d: summarize(d1), after7d: summarize(d7), bestRunners };
}
