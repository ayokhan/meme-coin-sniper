/**
 * Nova Forex Bot: per-user MT4/MT5 tick via MetaAPI. Simple EMA/MA crossover strategy —
 * opens/flips a position on crossover, sizes by lotSize, attaches TP/SL from pips.
 */

import { prisma } from "@/lib/db";
import { normalizeForexSymbol, getForexCandles } from "@/lib/forex-market";
import { getForexSpotMid, usesSpotCalibration } from "@/lib/forex-spot-feed";
import { ema, maCrossoverSignal } from "@/lib/trading-bot-ta";
import { resolveForexBrokerForSession } from "@/lib/forex-broker-session";
import {
  isMetaApiConfigured,
  getMetaApiPositions,
  getMetaApiSymbolPrice,
  placeMetaApiMarketOrder,
  closeMetaApiPositionsBySymbol,
} from "@/lib/metaapi";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

function parseFloatSafe(s: string): number {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/** Pip size by instrument family — JPY pairs 0.01, metals 0.1, indices 1.0, else 0.0001. */
export function pipSizeForForexSymbol(symbol: string): number {
  const s = normalizeForexSymbol(symbol);
  if (s.includes("JPY")) return 0.01;
  if (s === "XAUUSD" || s === "XAGUSD") return 0.1;
  if (/^(NAS100|US30|SPX500|US100|UK100|GER40|JPN225)/.test(s)) return 1.0;
  return 0.0001;
}

export function pipsToPrice(symbol: string, pips: number): number {
  return pips * pipSizeForForexSymbol(symbol);
}

/** MT4/MT5-style symbol (no slash) from our market-watch symbol. */
function toBrokerSymbol(symbol: string): string {
  return normalizeForexSymbol(symbol).replace(/[^A-Z0-9]/g, "");
}

type ForexBotRow = {
  id: string;
  userId: string;
  enabled: boolean;
  ownerForceOff: boolean;
  mode: string; // demo | live
  broker: string;
  symbol: string;
  timeframe: string;
  lotSize: number;
  fastMA: number;
  slowMA: number;
  stopLossPips: number | null;
  takeProfitPips: number | null;
  magic: number | null;
  inPosition: boolean;
  positionSide: string | null;
};

async function currentPrice(
  symbol: string,
  metaApiAccountId: string | null,
  brokerSymbol: string
): Promise<number> {
  if (metaApiAccountId) {
    const p = await getMetaApiSymbolPrice(metaApiAccountId, brokerSymbol);
    if (p?.last) return p.last;
  }
  if (usesSpotCalibration(symbol)) {
    const mid = await getForexSpotMid(symbol);
    if (mid != null) return mid;
  }
  const candles = await getForexCandles(symbol, "1m", 2).catch(() => []);
  return candles[0] ? parseFloatSafe(candles[0][4]) : 0;
}

export async function runNovaForexBotTick(
  userId: string
): Promise<{ ok: boolean; message?: string; error?: string; action?: string }> {
  if (!userId) return { ok: false, error: "Sign in required to run Nova Forex Bot." };

  let row: ForexBotRow | null = null;
  try {
    row = await db.novaForexBotConfig.findFirst({ where: { userId } });
  } catch {
    return { ok: false, error: "Nova Forex Bot table missing. Run prisma db push." };
  }

  if (!row || !row.enabled || row.ownerForceOff) {
    return { ok: true, message: "Nova Forex Bot is off, suspended by the owner, or save your config first." };
  }

  const updateRow = async (data: Record<string, unknown>) => {
    await db.novaForexBotConfig.update({ where: { id: row!.id }, data });
  };

  if (!isMetaApiConfigured()) {
    await updateRow({ lastError: "METAAPI_TOKEN not configured", lastRunAt: new Date() });
    return { ok: false, error: "MetaAPI is not configured on the server (METAAPI_TOKEN)." };
  }

  const broker = row.broker === "tiomarkets" ? "tiomarkets" : "vantage";
  const connection = await resolveForexBrokerForSession(userId, false, broker as "vantage" | "tiomarkets");
  if (!connection?.metaApiAccountId) {
    await updateRow({
      lastError: "Broker not connected",
      lastRunAt: new Date(),
      lastDecision: "Skipped: connect your MT4/MT5 broker account first.",
    });
    return { ok: false, error: "Connect your forex broker account (MT4/MT5) before running Nova Forex Bot." };
  }
  const accountId = connection.metaApiAccountId;

  const symbol = normalizeForexSymbol(row.symbol);
  const brokerSymbol = toBrokerSymbol(symbol);

  const candles = await getForexCandles(symbol, row.timeframe || "15m", 300).catch(() => []);
  if (candles.length < (row.slowMA || 21) + 5) {
    await updateRow({ lastError: "Not enough candle data", lastRunAt: new Date() });
    return { ok: false, error: "Not enough candle data to evaluate strategy yet." };
  }
  const closes = candles.map((c) => parseFloatSafe(c[4])).filter((c) => c > 0);

  const price = await currentPrice(symbol, accountId, brokerSymbol);
  if (!Number.isFinite(price) || price <= 0) {
    await updateRow({ lastError: "No price", lastRunAt: new Date() });
    return { ok: false, error: "Could not read a live price for this symbol." };
  }

  const fastPeriod = row.fastMA || 9;
  const slowPeriod = row.slowMA || 21;
  const cross = maCrossoverSignal(closes, fastPeriod, slowPeriod);
  const trendVal = ema(closes, Math.min(slowPeriod, closes.length - 1));
  const signal: "long" | "short" | null = cross ?? (trendVal != null ? (price > trendVal ? "long" : "short") : null);

  const positions = await getMetaApiPositions(accountId);
  const openHere = positions.filter((p) => p.symbol === brokerSymbol);
  const hasExchangePosition = openHere.length > 0;
  const exchangeSide: "long" | "short" | null = hasExchangePosition
    ? openHere[0]!.type === "POSITION_TYPE_BUY"
      ? "long"
      : "short"
    : null;

  if (row.inPosition !== hasExchangePosition || row.positionSide !== exchangeSide) {
    await updateRow({ inPosition: hasExchangePosition, positionSide: exchangeSide });
    row.inPosition = hasExchangePosition;
    row.positionSide = exchangeSide;
  }

  if (!signal) {
    await updateRow({
      lastRunAt: new Date(),
      lastError: null,
      lastDecision: `Flat/hold: no MA(${fastPeriod}/${slowPeriod}) crossover on ${symbol}. Price ${price}.`,
    });
    return { ok: true, message: "No crossover signal; holding." };
  }

  if (row.inPosition && row.positionSide === signal) {
    await updateRow({
      lastRunAt: new Date(),
      lastError: null,
      lastDecision: `Already ${signal} on ${symbol} @ ~${price}; signal unchanged.`,
    });
    return { ok: true, message: `Already ${signal}; holding.`, action: "hold" };
  }

  if (row.inPosition && row.positionSide && row.positionSide !== signal) {
    const closeRes = await closeMetaApiPositionsBySymbol({ accountId, symbol: brokerSymbol });
    if (!closeRes.ok) {
      await updateRow({
        lastError: closeRes.error ?? "Close failed",
        lastRunAt: new Date(),
        lastDecision: `Signal flipped to ${signal}, but closing existing ${row.positionSide} failed.`,
      });
      return { ok: false, error: closeRes.error };
    }
    await updateRow({ inPosition: false, positionSide: null });
    row.inPosition = false;
    row.positionSide = null;
  }

  const lotSize = Math.max(0.01, row.lotSize || 0.01);
  const pipSize = pipSizeForForexSymbol(symbol);
  const stopLoss =
    row.stopLossPips && row.stopLossPips > 0
      ? signal === "long"
        ? price - row.stopLossPips * pipSize
        : price + row.stopLossPips * pipSize
      : undefined;
  const takeProfit =
    row.takeProfitPips && row.takeProfitPips > 0
      ? signal === "long"
        ? price + row.takeProfitPips * pipSize
        : price - row.takeProfitPips * pipSize
      : undefined;

  const order = await placeMetaApiMarketOrder({
    accountId,
    symbol: brokerSymbol,
    side: signal === "long" ? "buy" : "sell",
    volume: lotSize,
    stopLoss,
    takeProfit,
    clientId: row.magic ? `novafx-${row.magic}` : undefined,
  });

  if (!order.ok) {
    await updateRow({
      lastError: order.error ?? "Order failed",
      lastRunAt: new Date(),
      lastDecision: `Crossover → ${signal} on ${symbol} @ ~${price}, but order failed: ${order.error ?? ""}`,
    });
    return { ok: false, error: order.error };
  }

  await updateRow({
    inPosition: true,
    positionSide: signal,
    lastError: null,
    lastRunAt: new Date(),
    lastDecision: `Entered ${signal} ${lotSize} lots on ${symbol} @ ~${price}. TP/SL from pips applied where set.`,
  });

  return { ok: true, message: `Entered ${signal} on ${symbol}.`, action: signal };
}
