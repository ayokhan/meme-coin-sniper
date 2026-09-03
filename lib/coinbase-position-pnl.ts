import type { PositionRow } from "@/lib/coinbase";

function parseNum(s: string | null | undefined): number | null {
  if (s == null || s === "") return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

export type CoinbaseResolvedPnl = {
  unrealizedPnl: number;
  pnlPct: number | null;
  leverage: number | null;
  markPrice: number;
  source: "coinbase" | "computed";
};

/** PNL aligned with Coinbase: prefer API floating_profit_loss + ratio; fallback computed. */
export function resolveCoinbasePositionPnl(
  pos: PositionRow,
  opts: { markPrice: number; contractValue: number }
): CoinbaseResolvedPnl {
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
      source: "coinbase",
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
  }

  return { unrealizedPnl, pnlPct, leverage, markPrice, source: upl != null || ratioRaw != null ? "coinbase" : "computed" };
}

export function formatCoinbasePnlLine(unrealizedPnl: number, pnlPct: number | null): string {
  const usd = `${unrealizedPnl >= 0 ? "+" : ""}${unrealizedPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`;
  if (pnlPct == null || !Number.isFinite(pnlPct)) return usd;
  return `${usd} (${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}%)`;
}
