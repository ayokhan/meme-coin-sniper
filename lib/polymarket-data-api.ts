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

export async function fetchPolymarketTrades(userAddress: string, limit = 50): Promise<PolymarketTradeRow[]> {
  const capped = Math.min(2000, Math.max(1, limit));
  const res = await fetch(`${DATA_API}/trades?user=${encodeURIComponent(userAddress)}&limit=${capped}`, {
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
