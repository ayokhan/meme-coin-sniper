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
  timestamp?: number;
  slug?: string;
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
  const res = await fetch(`${DATA_API}/trades?user=${encodeURIComponent(userAddress)}&limit=${limit}`, {
    cache: "no-store",
  });
  if (!res.ok) return [];
  const raw = (await res.json().catch(() => [])) as unknown;
  return Array.isArray(raw) ? (raw as PolymarketTradeRow[]).slice(0, limit) : [];
}

/** Best-effort summary for leaderboard rows (sequential per wallet to respect rate limits at caller). */
export async function fetchPolymarketTraderSummary(userAddress: string): Promise<{
  valueUsd: number | null;
  positionCount: number;
  lastTradeTimeMs: number | null;
}> {
  const [valueUsd, positions, trades] = await Promise.all([
    fetchPolymarketPortfolioValueUsd(userAddress),
    fetchPolymarketPositions(userAddress, 100),
    fetchPolymarketTrades(userAddress, 30),
  ]);
  const toMs = (ts: number) => (ts > 1e12 ? ts : ts * 1000);
  const lastTradeTimeMs =
    trades.length > 0
      ? Math.max(...trades.map((t) => (typeof t.timestamp === "number" ? toMs(t.timestamp) : 0)))
      : null;
  const normalizedLast =
    lastTradeTimeMs != null && Number.isFinite(lastTradeTimeMs) && lastTradeTimeMs > 0 ? lastTradeTimeMs : null;
  return {
    valueUsd,
    positionCount: positions.length,
    lastTradeTimeMs: normalizedLast,
  };
}
