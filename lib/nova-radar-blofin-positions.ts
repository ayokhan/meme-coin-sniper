import { getPendingTPSLOrders, getPositions, type PositionRow } from "@/lib/blofin";
import { instIdToMapSymbol } from "@/lib/futures-blofin-session";
import type { BlofinConfig } from "@/lib/blofin";

function parseNum(v: string | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const normInst = (s: string) => (s || "").replace(/-/g, "").toUpperCase();

export type NovaRadarBlofinOpenPosition = {
  id: string;
  instId: string;
  symbol: string;
  side: "long" | "short";
  entryPrice: number | null;
  markPrice: number | null;
  leverage: number | null;
  liquidationPrice: number | null;
  marginUsdt: number | null;
  unrealizedPnl: number | null;
  marginMode: string | null;
  hasExchangeStopLoss: boolean;
  exchangeStopLossPrice: number | null;
  exchangeTakeProfitPrice: number | null;
  missingStopAlert: boolean;
  label: string;
};

function slForPositionSide(
  side: "long" | "short",
  slTrigger: number | null
): number | null {
  if (slTrigger == null) return null;
  return slTrigger;
}

export async function loadNovaRadarBlofinOpenPositions(config: BlofinConfig): Promise<NovaRadarBlofinOpenPosition[]> {
  const demo = config.demo;
  const [positions, tpslOrders] = await Promise.all([
    getPositions(undefined, { demo, config }),
    getPendingTPSLOrders({ demo, config, limit: 200 }).catch(() => [] as Awaited<ReturnType<typeof getPendingTPSLOrders>>),
  ]);

  const tpslByInst = new Map<string, { sl: number | null; tp: number | null }>();
  for (const t of tpslOrders) {
    if (t.state !== "live" && t.state !== "effective") continue;
    const key = normInst(t.instId);
    const prev = tpslByInst.get(key) ?? { sl: null, tp: null };
    if (t.slTriggerPrice != null) prev.sl = t.slTriggerPrice;
    if (t.tpTriggerPrice != null) prev.tp = t.tpTriggerPrice;
    tpslByInst.set(key, prev);
  }

  return positions.map((p) => formatOpenPosition(p, tpslByInst.get(normInst(p.instId)))).filter(Boolean) as NovaRadarBlofinOpenPosition[];
}

function formatOpenPosition(
  p: PositionRow,
  tpsl?: { sl: number | null; tp: number | null }
): NovaRadarBlofinOpenPosition | null {
  const symbol = instIdToMapSymbol(p.instId);
  const side: "long" | "short" = p.posSide === "short" ? "short" : "long";
  const entryPrice = parseNum(p.avgPx);
  const markPrice = parseNum(p.markPx ?? undefined);
  const leverage = parseNum(p.leverage ?? undefined);
  const liquidationPrice = parseNum(p.liqPx ?? undefined);
  const marginUsdt = parseNum(p.margin ?? p.imr ?? undefined);
  const exchangeStopLossPrice = slForPositionSide(side, tpsl?.sl ?? null);
  const exchangeTakeProfitPrice = tpsl?.tp ?? null;
  const hasExchangeStopLoss = exchangeStopLossPrice != null;
  const levLabel = leverage != null && leverage > 0 ? `${Math.round(leverage)}×` : "—";
  const entryLabel = entryPrice != null ? entryPrice.toLocaleString(undefined, { maximumFractionDigits: 4 }) : "—";
  const slLabel = hasExchangeStopLoss ? " · SL set" : " · ⚠ no SL";
  const label = `${symbol} ${side} ${levLabel} @ ${entryLabel}${slLabel}`;

  return {
    id: `${p.instId}:${side}`,
    instId: p.instId,
    symbol,
    side,
    entryPrice,
    markPrice,
    leverage,
    liquidationPrice,
    marginUsdt,
    unrealizedPnl: parseNum(p.upl ?? undefined),
    marginMode: p.marginMode ?? null,
    hasExchangeStopLoss,
    exchangeStopLossPrice,
    exchangeTakeProfitPrice,
    missingStopAlert: !hasExchangeStopLoss,
    label,
  };
}
