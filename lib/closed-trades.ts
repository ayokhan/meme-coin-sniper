/** Parse Blofin fills / order history into closed round-trips for PNL share cards. */

/** Time window for closed-trade list & totals. `all` = no time filter (up to API limit). */
export type ClosedTradesPeriod = "24h" | "3d" | "7d" | "14d" | "30d" | "60d" | "90d" | "all";

export const CLOSED_TRADES_PERIOD_OPTIONS: { value: ClosedTradesPeriod; label: string }[] = [
  { value: "24h", label: "Last 24 hours" },
  { value: "3d", label: "Last 3 days" },
  { value: "7d", label: "Last 7 days" },
  { value: "14d", label: "Last 14 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "60d", label: "Last 60 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "all", label: "Show all" },
];

export function closedTradesPeriodDays(period: ClosedTradesPeriod): number | null {
  switch (period) {
    case "24h":
      return 1;
    case "3d":
      return 3;
    case "7d":
      return 7;
    case "14d":
      return 14;
    case "30d":
      return 30;
    case "60d":
      return 60;
    case "90d":
      return 90;
    case "all":
      return null;
  }
}

export function closedTradesPeriodLabel(period: ClosedTradesPeriod): string {
  return CLOSED_TRADES_PERIOD_OPTIONS.find((o) => o.value === period)?.label ?? "Last 7 days";
}

export function closedTradesPeriodBeginMs(period: ClosedTradesPeriod, now = Date.now()): number | null {
  const days = closedTradesPeriodDays(period);
  if (days == null) return null;
  if (period === "24h") return now - 24 * 60 * 60 * 1000;
  return now - days * 24 * 60 * 60 * 1000;
}

export function filterClosedTradesByPeriod<T extends { closedAt: string | null }>(
  trades: T[],
  period: ClosedTradesPeriod,
  now = Date.now()
): T[] {
  const begin = closedTradesPeriodBeginMs(period, now);
  if (begin == null) return trades.filter((t) => t.closedAt != null && t.closedAt !== "");
  return trades.filter((t) => {
    if (t.closedAt == null || t.closedAt === "") return false;
    const ts = Number(t.closedAt);
    return Number.isFinite(ts) && ts >= begin;
  });
}

export type ClosedTradesAnalysis = {
  totalTrades: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRatePct: number;
  totalRealizedUsdt: number;
  avgWinUsdt: number | null;
  avgLossUsdt: number | null;
  bestTrade: { displaySymbol: string; realizedPnlUsdt: number; roiPct: number } | null;
  worstTrade: { displaySymbol: string; realizedPnlUsdt: number; roiPct: number } | null;
};

export function analyzeClosedTrades(
  trades: { displaySymbol: string; realizedPnlUsdt: number; roiPct: number }[]
): ClosedTradesAnalysis {
  const active = trades.filter((t) => Math.abs(t.realizedPnlUsdt) > 1e-8);
  const wins = active.filter((t) => t.realizedPnlUsdt > 0);
  const losses = active.filter((t) => t.realizedPnlUsdt < 0);
  const breakeven = active.length - wins.length - losses.length;
  const winRatePct = active.length > 0 ? Math.round((wins.length / active.length) * 10000) / 100 : 0;
  const totalRealizedUsdt = active.reduce((s, t) => s + t.realizedPnlUsdt, 0);
  const avgWinUsdt =
    wins.length > 0 ? wins.reduce((s, t) => s + t.realizedPnlUsdt, 0) / wins.length : null;
  const avgLossUsdt =
    losses.length > 0 ? losses.reduce((s, t) => s + t.realizedPnlUsdt, 0) / losses.length : null;
  const sorted = [...active].sort((a, b) => b.realizedPnlUsdt - a.realizedPnlUsdt);
  const best = sorted[0] ?? null;
  const worst = sorted.length ? sorted[sorted.length - 1] : null;
  return {
    totalTrades: active.length,
    wins: wins.length,
    losses: losses.length,
    breakeven,
    winRatePct,
    totalRealizedUsdt,
    avgWinUsdt,
    avgLossUsdt,
    bestTrade: best ? { displaySymbol: best.displaySymbol, realizedPnlUsdt: best.realizedPnlUsdt, roiPct: best.roiPct } : null,
    worstTrade: worst ? { displaySymbol: worst.displaySymbol, realizedPnlUsdt: worst.realizedPnlUsdt, roiPct: worst.roiPct } : null,
  };
}

export function sumClosedTradesRealized(trades: { realizedPnlUsdt: number }[]): number {
  return trades.reduce((s, t) => s + t.realizedPnlUsdt, 0);
}

export type BlofinFillRow = {
  instId: string;
  tradeId?: string;
  orderId?: string;
  fillPrice: string;
  fillSize?: string;
  fillPnl?: string;
  side: string;
  positionSide?: string;
  ts?: string;
};

export type BlofinOrderRow = {
  orderId: string;
  instId: string;
  side: string;
  orderType: string;
  size: string;
  price: string;
  state: string;
  fillPrice?: string;
  averagePrice?: string;
  leverage?: string;
  createdAt?: string;
  pnl?: string;
};

export type ClosedTrade = {
  id: string;
  instId: string;
  displaySymbol: string;
  direction: "long" | "short";
  openPrice: number;
  closePrice: number;
  realizedPnlUsdt: number;
  /** ROE % (price move × leverage), aligned with Blofin-style display. */
  roiPct: number;
  leverage: number;
  closedAt: string | null;
  source: "fills" | "orders";
};

export function formatInstDisplay(instId: string): string {
  return (instId || "").replace(/-/g, "").toUpperCase();
}

function num(s: string | undefined | null): number | null {
  if (s == null || s === "") return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function inferDirectionFromCloseSide(side: string, positionSide?: string): "long" | "short" {
  const ps = (positionSide ?? "").toLowerCase();
  if (ps === "long") return "long";
  if (ps === "short") return "short";
  return side.toLowerCase() === "sell" ? "long" : "short";
}

function roiFromPrices(
  direction: "long" | "short",
  openPrice: number,
  closePrice: number,
  leverage: number
): number {
  if (openPrice <= 0) return 0;
  const move =
    direction === "long" ? (closePrice - openPrice) / openPrice : (openPrice - closePrice) / openPrice;
  return Math.round(move * leverage * 10000) / 100;
}

/** Closing fills that belong to one reduce-only close (partials share orderId or timestamp). */
function shouldMergeClosingFills(a: BlofinFillRow, b: BlofinFillRow): boolean {
  if (a.instId !== b.instId) return false;
  if (a.orderId && b.orderId && a.orderId === b.orderId) return true;
  const ta = Number(a.ts ?? 0);
  const tb = Number(b.ts ?? 0);
  return Number.isFinite(ta) && Number.isFinite(tb) && Math.abs(ta - tb) <= 3000;
}

function groupClosingFills(sorted: BlofinFillRow[]): BlofinFillRow[][] {
  const groups: BlofinFillRow[][] = [];
  let current: BlofinFillRow[] | null = null;

  for (const f of sorted) {
    const pnl = num(f.fillPnl);
    if (pnl == null || Math.abs(pnl) < 1e-10) continue;
    if (!current) {
      current = [f];
      continue;
    }
    const last = current[current.length - 1];
    if (shouldMergeClosingFills(last, f)) current.push(f);
    else {
      groups.push(current);
      current = [f];
    }
  }
  if (current) groups.push(current);
  return groups;
}

/** One representative fill per close (largest |fillPnl| — avoids double-counting partials). */
function pickRepresentativeClosingFill(group: BlofinFillRow[]): BlofinFillRow {
  return group.reduce((best, f) => {
    const p = Math.abs(num(f.fillPnl) ?? 0);
    const bp = Math.abs(num(best.fillPnl) ?? 0);
    return p > bp ? f : best;
  });
}

function findOpenPriceBeforeFill(sorted: BlofinFillRow[], fillIndex: number): number | null {
  const f = sorted[fillIndex];
  for (let j = fillIndex - 1; j >= 0; j--) {
    const prev = sorted[j];
    if (prev.instId !== f.instId) continue;
    const prevPnl = num(prev.fillPnl) ?? 0;
    if (Math.abs(prevPnl) < 1e-10) return num(prev.fillPrice);
  }
  return null;
}

/** Closed trades from fills-history (fillPnl on closing fills). */
export function closedTradesFromFills(
  fills: BlofinFillRow[],
  defaultLeverage: number,
  leverageByInst?: Map<string, number>,
  leverageByOrderId?: Map<string, number>
): ClosedTrade[] {
  const sorted = [...fills].sort((a, b) => Number(a.ts ?? 0) - Number(b.ts ?? 0));
  const closed: ClosedTrade[] = [];
  const groups = groupClosingFills(sorted);

  for (const group of groups) {
    const f = pickRepresentativeClosingFill(group);
    const fillIndex = sorted.indexOf(f);
    const pnl = num(f.fillPnl);
    if (pnl == null || Math.abs(pnl) < 1e-10) continue;

    const closePrice = num(f.fillPrice);
    if (closePrice == null || closePrice <= 0) continue;

    const openPrice = findOpenPriceBeforeFill(sorted, fillIndex);
    if (openPrice == null || openPrice <= 0) continue;

    const direction = inferDirectionFromCloseSide(f.side, f.positionSide);
    const ordLev = f.orderId ? leverageByOrderId?.get(f.orderId) : undefined;
    const lev = ordLev ?? leverageByInst?.get(f.instId) ?? defaultLeverage;

    closed.push({
      id: f.tradeId ?? f.orderId ?? `fill-${fillIndex}`,
      instId: f.instId,
      displaySymbol: formatInstDisplay(f.instId),
      direction,
      openPrice,
      closePrice,
      realizedPnlUsdt: pnl,
      roiPct: roiFromPrices(direction, openPrice, closePrice, lev),
      leverage: lev,
      closedAt: f.ts ?? null,
      source: "fills",
    });
  }

  return closed.reverse();
}

/** Fallback: closing orders in orders-history with non-zero pnl. */
export function closedTradesFromOrders(orders: BlofinOrderRow[], defaultLeverage: number): ClosedTrade[] {
  const filled = orders
    .filter((o) => o.state === "filled" || o.state === "partially_filled")
    .sort((a, b) => Number(a.createdAt ?? 0) - Number(b.createdAt ?? 0));

  const closed: ClosedTrade[] = [];

  for (let i = 0; i < filled.length; i++) {
    const o = filled[i];
    const pnl = num(o.pnl);
    if (pnl == null || Math.abs(pnl) < 1e-10) continue;

    const closePrice = num(o.averagePrice) ?? num(o.fillPrice) ?? num(o.price);
    if (closePrice == null || closePrice <= 0) continue;

    const lev = num(o.leverage) ?? defaultLeverage;
    const direction = inferDirectionFromCloseSide(o.side);
    let openPrice: number | null = null;
    for (let j = i - 1; j >= 0; j--) {
      const prev = filled[j];
      if (prev.instId !== o.instId) continue;
      const prevPnl = num(prev.pnl) ?? 0;
      if (Math.abs(prevPnl) < 1e-10) {
        openPrice = num(prev.averagePrice) ?? num(prev.fillPrice) ?? num(prev.price);
        break;
      }
    }
    if (openPrice == null || openPrice <= 0) continue;

    closed.push({
      id: o.orderId || `order-${i}`,
      instId: o.instId,
      displaySymbol: formatInstDisplay(o.instId),
      direction,
      openPrice,
      closePrice,
      realizedPnlUsdt: pnl,
      roiPct: roiFromPrices(direction, openPrice, closePrice, lev),
      leverage: lev,
      closedAt: o.createdAt ?? null,
      source: "orders",
    });
  }

  return closed.reverse();
}

/**
 * Loose dedupe: same instrument + direction + entry + minute = one round-trip.
 * Ignores close price / USDT deltas from partial fills or fills vs orders mismatch.
 */
export function closedTradeLooseDedupeKey(t: ClosedTrade): string {
  const ts =
    t.closedAt != null && Number.isFinite(Number(t.closedAt))
      ? Math.floor(Number(t.closedAt) / 60_000)
      : 0;
  return [t.instId, t.direction, t.openPrice.toFixed(2), String(ts)].join("|");
}

function enrichFillWithOrderLeverage(fillsTrade: ClosedTrade, orderTrade: ClosedTrade): ClosedTrade {
  const lev = orderTrade.leverage > 0 ? orderTrade.leverage : fillsTrade.leverage;
  if (lev === fillsTrade.leverage) return fillsTrade;
  return {
    ...fillsTrade,
    leverage: lev,
    roiPct: roiFromPrices(fillsTrade.direction, fillsTrade.openPrice, fillsTrade.closePrice, lev),
  };
}

function preferClosedTrade(existing: ClosedTrade, candidate: ClosedTrade): ClosedTrade {
  if (existing.source === "fills" && candidate.source === "orders") {
    return enrichFillWithOrderLeverage(existing, candidate);
  }
  if (candidate.source === "fills" && existing.source === "orders") {
    return enrichFillWithOrderLeverage(candidate, existing);
  }
  return existing;
}

export function mergeClosedTrades(fillsTrades: ClosedTrade[], orderTrades: ClosedTrade[]): ClosedTrade[] {
  const byKey = new Map<string, ClosedTrade>();
  // Orders-history pnl per close is authoritative; fills are fallback only.
  for (const t of orderTrades) {
    const key = closedTradeLooseDedupeKey(t);
    const prev = byKey.get(key);
    if (!prev || Math.abs(t.realizedPnlUsdt) > Math.abs(prev.realizedPnlUsdt)) {
      byKey.set(key, t);
    }
  }
  for (const t of fillsTrades) {
    const key = closedTradeLooseDedupeKey(t);
    const prev = byKey.get(key);
    if (!prev) byKey.set(key, t);
    else if (prev.source === "orders") continue;
    else byKey.set(key, preferClosedTrade(prev, t));
  }
  return [...byKey.values()].sort((a, b) => Number(b.closedAt ?? 0) - Number(a.closedAt ?? 0));
}
