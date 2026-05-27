import type { PositionRow } from "@/lib/blofin";

function parseNum(s: string | null | undefined): number | null {
  if (s == null || s === "") return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

export type BlofinResolvedPnl = {
  unrealizedPnl: number;
  /** ROE % — matches Blofin UI (unrealizedPnlRatio × 100, or price move × leverage). */
  pnlPct: number | null;
  leverage: number | null;
  markPrice: number;
  source: "blofin" | "computed";
};

/**
 * PNL aligned with Blofin: prefer API unrealizedPnl + unrealizedPnlRatio;
 * fallback to price change × leverage (ROE), not notional %.
 */
export function resolveBlofinPositionPnl(
  pos: PositionRow,
  opts: { markPrice: number; contractValue: number }
): BlofinResolvedPnl {
  const size = Math.abs(parseNum(pos.pos) ?? 0);
  const entryPrice = parseNum(pos.avgPx) ?? 0;
  const markFromPos = parseNum(pos.markPx);
  const markPrice = markFromPos ?? opts.markPrice;
  const posSide = (pos.posSide ?? "").toLowerCase();
  const leverage = parseNum(pos.leverage);
  const upl = parseNum(pos.upl);
  const ratioRaw = parseNum(pos.unrealizedPnlRatio);

  if (upl != null && ratioRaw != null) {
    return {
      unrealizedPnl: upl,
      pnlPct: Math.round(ratioRaw * 10000) / 100,
      leverage,
      markPrice,
      source: "blofin",
    };
  }

  const contractValue = opts.contractValue;
  let unrealizedPnl = 0;
  if (contractValue > 0 && entryPrice > 0) {
    unrealizedPnl =
      posSide === "long"
        ? (markPrice - entryPrice) * size * contractValue
        : (entryPrice - markPrice) * size * contractValue;
  }
  if (upl != null) unrealizedPnl = upl;

  let pnlPct: number | null = null;
  if (ratioRaw != null) {
    pnlPct = Math.round(ratioRaw * 10000) / 100;
  } else if (entryPrice > 0 && leverage != null && leverage > 0) {
    const priceMove =
      posSide === "short" ? (entryPrice - markPrice) / entryPrice : (markPrice - entryPrice) / entryPrice;
    pnlPct = Math.round(priceMove * leverage * 10000) / 100;
  } else if (upl != null && leverage != null && leverage > 0 && entryPrice > 0) {
    const priceMove =
      posSide === "short" ? (entryPrice - markPrice) / entryPrice : (markPrice - entryPrice) / entryPrice;
    pnlPct = Math.round(priceMove * leverage * 10000) / 100;
  }

  return { unrealizedPnl, pnlPct, leverage, markPrice, source: upl != null || ratioRaw != null ? "blofin" : "computed" };
}

/** Blofin-style: `-267.86 USDT (-26.23%)` */
export function formatBlofinPnlLine(unrealizedPnl: number, pnlPct: number | null): string {
  const usdt = `${unrealizedPnl >= 0 ? "+" : ""}${unrealizedPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`;
  if (pnlPct == null || !Number.isFinite(pnlPct)) return usdt;
  return `${usdt} (${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}%)`;
}
