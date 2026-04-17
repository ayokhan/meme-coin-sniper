/**
 * Public Polymarket data API (no auth). Used by Nova Polymarket Tracker.
 * Docs / behavior may change; callers should tolerate empty or partial responses.
 */

const DATA_API = "https://data-api.polymarket.com";

export type PolymarketTradeRow = {
  side?: string;
  title?: string;
  outcome?: string;
  size?: number;
  price?: number;
  /** Unix seconds from Polymarket data API */
  timestamp?: number;
  /** Market slug when API returns it (used for deep links). */
  slug?: string;
  transactionHash?: string;
};

export type PolymarketPositionRow = {
  title?: string;
  slug?: string;
  outcome?: string;
  size?: number;
  avgPrice?: number;
  currentValue?: number;
  initialValue?: number;
  cashPnl?: number;
  /** Market resolution target time when API returns it (ISO string). */
  endDate?: string;
  conditionId?: string;
};

/** Settled / closed markets (historical PnL) from Polymarket data API. */
export type PolymarketClosedPositionRow = {
  title?: string;
  slug?: string;
  outcome?: string;
  avgPrice?: number;
  totalBought?: number;
  realizedPnl?: number;
  curPrice?: number;
  timestamp?: number;
};

export async function fetchPolymarketPortfolioValueUsd(userAddress: string): Promise<number | null> {
  const res = await fetch(`${DATA_API}/value?user=${encodeURIComponent(userAddress)}`, { cache: "no-store" });
  if (!res.ok) return null;
  const j = (await res.json().catch(() => ({}))) as { value?: number; totalValue?: number };
  if (typeof j.value === "number") return j.value;
  if (typeof j.totalValue === "number") return j.totalValue;
  return null;
}

export async function fetchPolymarketPositions(userAddress: string, limit = 50): Promise<PolymarketPositionRow[]> {
  const res = await fetch(
    `${DATA_API}/positions?user=${encodeURIComponent(userAddress)}&sizeThreshold=1`,
    { cache: "no-store" }
  );
  if (!res.ok) return [];
  const raw = (await res.json().catch(() => [])) as unknown;
  return Array.isArray(raw) ? (raw as PolymarketPositionRow[]).slice(0, limit) : [];
}

/**
 * @param offset Polymarket data API supports offset 0–10000 (see OpenAPI).
 * @param takerOnly When false, includes maker fills (larger tape).
 */
export async function fetchPolymarketTrades(
  userAddress: string,
  limit = 50,
  offset = 0,
  takerOnly = true
): Promise<PolymarketTradeRow[]> {
  const capped = Math.min(1000, Math.max(1, limit));
  const off = Math.min(10000, Math.max(0, offset));
  const q = new URLSearchParams({
    user: userAddress,
    limit: String(capped),
    offset: String(off),
    takerOnly: String(takerOnly),
  });
  const res = await fetch(`${DATA_API}/trades?${q.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) return [];
  const raw = (await res.json().catch(() => [])) as unknown;
  return Array.isArray(raw) ? (raw as PolymarketTradeRow[]).slice(0, capped) : [];
}

export async function fetchPolymarketClosedPositions(
  userAddress: string,
  limit = 100
): Promise<PolymarketClosedPositionRow[]> {
  const capped = Math.min(500, Math.max(1, limit));
  const res = await fetch(
    `${DATA_API}/closed-positions?user=${encodeURIComponent(userAddress)}&limit=${capped}`,
    { cache: "no-store" }
  );
  if (!res.ok) return [];
  const raw = (await res.json().catch(() => [])) as unknown;
  return Array.isArray(raw) ? (raw as PolymarketClosedPositionRow[]).slice(0, capped) : [];
}

/** Polymarket `/closed-positions` supports sort (see Data API OpenAPI). Max limit 50 per spec. */
export async function fetchPolymarketClosedPositionsSorted(
  userAddress: string,
  opts?: {
    limit?: number;
    offset?: number;
    sortBy?: "REALIZEDPNL" | "TIMESTAMP" | "TITLE" | "PRICE" | "AVGPRICE";
    sortDirection?: "ASC" | "DESC";
  }
): Promise<PolymarketClosedPositionRow[]> {
  const limit = Math.min(50, Math.max(1, opts?.limit ?? 50));
  const offset = Math.min(100000, Math.max(0, opts?.offset ?? 0));
  const sortBy = opts?.sortBy ?? "REALIZEDPNL";
  const sortDirection = opts?.sortDirection ?? "DESC";
  const q = new URLSearchParams({
    user: userAddress,
    limit: String(limit),
    offset: String(offset),
    sortBy,
    sortDirection,
  });
  const res = await fetch(`${DATA_API}/closed-positions?${q.toString()}`, { cache: "no-store" });
  if (!res.ok) return [];
  const raw = (await res.json().catch(() => [])) as unknown;
  return Array.isArray(raw) ? (raw as PolymarketClosedPositionRow[]).slice(0, limit) : [];
}

export type PolymarketLeaderboardCategory =
  | "OVERALL"
  | "POLITICS"
  | "SPORTS"
  | "CRYPTO"
  | "CULTURE"
  | "MENTIONS"
  | "WEATHER"
  | "ECONOMICS"
  | "TECH"
  | "FINANCE";

export type PolymarketLeaderboardTimePeriod = "DAY" | "WEEK" | "MONTH" | "ALL";

export type PolymarketLeaderboardEntry = {
  rank?: string;
  proxyWallet?: string;
  userName?: string;
  vol?: number;
  pnl?: number;
  profileImage?: string;
  xUsername?: string;
  verifiedBadge?: boolean;
};

export async function fetchPolymarketTraderLeaderboard(params: {
  category?: PolymarketLeaderboardCategory | string;
  timePeriod?: PolymarketLeaderboardTimePeriod | string;
  orderBy?: "PNL" | "VOL";
  limit?: number;
  offset?: number;
  userName?: string;
}): Promise<PolymarketLeaderboardEntry[]> {
  const limit = Math.min(50, Math.max(1, params.limit ?? 25));
  const offset = Math.min(1000, Math.max(0, params.offset ?? 0));
  const q = new URLSearchParams({
    category: (params.category ?? "OVERALL").toUpperCase(),
    timePeriod: (params.timePeriod ?? "MONTH").toUpperCase(),
    orderBy: params.orderBy ?? "PNL",
    limit: String(limit),
    offset: String(offset),
  });
  const un = params.userName?.trim();
  if (un) q.set("userName", un);
  const res = await fetch(`${DATA_API}/v1/leaderboard?${q.toString()}`, { cache: "no-store" });
  if (!res.ok) return [];
  const raw = (await res.json().catch(() => [])) as unknown;
  return Array.isArray(raw) ? (raw as PolymarketLeaderboardEntry[]).slice(0, limit) : [];
}

/** Polymarket timestamps are Unix seconds; return epoch ms for JS Date (local timezone when formatted in browser). */
export function tradeTimestampToMs(ts: number | undefined): number | null {
  if (ts == null || !Number.isFinite(ts) || ts <= 0) return null;
  return ts > 1e12 ? ts : ts * 1000;
}

/** Per-fill notional (USDC-style) ≈ size × price for public data-api trades. */
export function tradeNotionalUsd(t: PolymarketTradeRow): number {
  const sz = Number(t.size);
  const px = Number(t.price);
  if (!Number.isFinite(sz) || !Number.isFinite(px)) return 0;
  return Math.abs(sz * px);
}

export function aggregateTradesStats(trades: PolymarketTradeRow[]): {
  tradeCount: number;
  volumeUsd: number;
  totalShares: number;
  netFlowUsd: number;
} {
  let volumeUsd = 0;
  let totalShares = 0;
  let netFlowUsd = 0;
  for (const t of trades) {
    const sz = Number(t.size);
    const px = Number(t.price);
    const n = Number.isFinite(sz) && Number.isFinite(px) ? sz * px : 0;
    volumeUsd += Math.abs(n);
    totalShares += Number.isFinite(sz) ? Math.abs(sz) : 0;
    const side = String(t.side ?? "").toUpperCase();
    if (side === "BUY") netFlowUsd += n;
    else if (side === "SELL") netFlowUsd -= n;
  }
  return { tradeCount: trades.length, volumeUsd, totalShares, netFlowUsd };
}

/** Best-effort summary for leaderboard rows (sequential per wallet to respect rate limits at caller). */
export async function fetchPolymarketTraderSummary(userAddress: string): Promise<{
  valueUsd: number | null;
  positionCount: number;
  lastTradeTimeMs: number | null;
  tradeCount: number;
  volumeUsd: number;
  totalShares: number;
  netFlowUsd: number;
  closedPositionCount: number;
}> {
  const tradeLimit = 250;
  const [valueUsd, positions, trades, closed] = await Promise.all([
    fetchPolymarketPortfolioValueUsd(userAddress),
    fetchPolymarketPositions(userAddress, 150),
    fetchPolymarketTrades(userAddress, tradeLimit),
    fetchPolymarketClosedPositions(userAddress, 120),
  ]);
  const stats = aggregateTradesStats(trades);
  const lastTradeTimeMs =
    trades.length > 0
      ? Math.max(...trades.map((t) => tradeTimestampToMs(t.timestamp) ?? 0))
      : null;
  const normalizedLast =
    lastTradeTimeMs != null && Number.isFinite(lastTradeTimeMs) && lastTradeTimeMs > 0 ? lastTradeTimeMs : null;
  return {
    valueUsd,
    positionCount: positions.length,
    lastTradeTimeMs: normalizedLast,
    tradeCount: stats.tradeCount,
    volumeUsd: stats.volumeUsd,
    totalShares: stats.totalShares,
    netFlowUsd: stats.netFlowUsd,
    closedPositionCount: closed.length,
  };
}
