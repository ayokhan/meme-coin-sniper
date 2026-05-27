/** Parse Blofin fills / order history into closed round-trips for PNL share cards. */

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

/** Closed trades from fills-history (fillPnl on closing fills). */
export function closedTradesFromFills(
  fills: BlofinFillRow[],
  defaultLeverage: number,
  leverageByInst?: Map<string, number>
): ClosedTrade[] {
  const sorted = [...fills].sort((a, b) => Number(a.ts ?? 0) - Number(b.ts ?? 0));
  const closed: ClosedTrade[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const f = sorted[i];
    const pnl = num(f.fillPnl);
    if (pnl == null || Math.abs(pnl) < 1e-10) continue;

    const closePrice = num(f.fillPrice);
    if (closePrice == null || closePrice <= 0) continue;

    const direction = inferDirectionFromCloseSide(f.side, f.positionSide);
    let openPrice: number | null = null;
    for (let j = i - 1; j >= 0; j--) {
      const prev = sorted[j];
      if (prev.instId !== f.instId) continue;
      const prevPnl = num(prev.fillPnl) ?? 0;
      if (Math.abs(prevPnl) < 1e-10) {
        openPrice = num(prev.fillPrice);
        break;
      }
    }
    if (openPrice == null || openPrice <= 0) continue;

    const lev = leverageByInst?.get(f.instId) ?? defaultLeverage;

    closed.push({
      id: f.tradeId ?? f.orderId ?? `fill-${i}`,
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

export function mergeClosedTrades(fillsTrades: ClosedTrade[], orderTrades: ClosedTrade[]): ClosedTrade[] {
  const byId = new Map<string, ClosedTrade>();
  for (const t of [...orderTrades, ...fillsTrades]) {
    const key = `${t.instId}-${t.closedAt}-${t.realizedPnlUsdt.toFixed(4)}`;
    if (!byId.has(key)) byId.set(key, t);
  }
  return [...byId.values()].sort((a, b) => Number(b.closedAt ?? 0) - Number(a.closedAt ?? 0));
}
