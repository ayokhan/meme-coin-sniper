/**
 * Run one cycle of the trading bot: load config, fetch candles, signal, place order if needed.
 * Called by cron or POST /api/admin/trading-bot/run.
 */

import { prisma } from "@/lib/db";
import {
  getCandles,
  getTicker,
  getInstrument,
  getPositions,
  setLeverage,
  placeMarketOrder,
  toBlofinBar,
  isBlofinConfigured,
  type Candle,
} from "@/lib/blofin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

function parseFloatSafe(s: string): number {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/** Simple signal: last close vs previous close. Returns "long" | "short" | null (no trade). */
function simpleSignal(candles: Candle[]): "long" | "short" | null {
  if (candles.length < 2) return null;
  const last = parseFloatSafe(candles[0][4]);
  const prev = parseFloatSafe(candles[1][4]);
  if (last > prev) return "long";
  if (last < prev) return "short";
  return null;
}

/** Round size to minSize and lotSize (e.g. 0.1 step). */
function roundSize(size: number, minSize: number, lotSize: number): string {
  const step = Math.max(lotSize, minSize);
  const n = Math.max(minSize, Math.floor(size / step) * step);
  return n.toFixed(1);
}

export async function runTradingBotCycle(): Promise<{ ok: boolean; message?: string; error?: string }> {
  if (!isBlofinConfigured()) {
    return { ok: false, error: "Blofin API keys not set" };
  }

  let bot: { id: string; symbol: string; timeframe: string; leverage: number; tpPct: number; slPct: number; mode: string; marginCurrency: string; positionSizeUsdt: number } | null = null;
  try {
    bot = await db.tradingBot.findFirst({ where: { enabled: true }, orderBy: { updatedAt: "desc" } });
  } catch (e) {
    return { ok: false, error: "Failed to load config" };
  }

  if (!bot) {
    return { ok: true, message: "No enabled bot" };
  }

  const instId = `${bot.symbol}-${bot.marginCurrency}`;
  const bar = toBlofinBar(bot.timeframe);

  const updateError = async (err: string | null) => {
    try {
      await db.tradingBot.update({
        where: { id: bot!.id },
        data: { lastRunAt: new Date(), lastError: err },
      });
    } catch {
      // ignore
    }
  };

  try {
    const [candlesRes, tickerRes, instRes, positionsRes] = await Promise.all([
      getCandles(instId, bar, 50),
      getTicker(instId),
      getInstrument(instId),
      getPositions(instId),
    ]);

    if (candlesRes.length < 2) {
      await updateError("Not enough candle data");
      return { ok: false, error: "Not enough candle data" };
    }

    const lastPrice = tickerRes?.last ? parseFloatSafe(tickerRes.last) : parseFloatSafe(candlesRes[0][4]);
    if (lastPrice <= 0) {
      await updateError("Could not get price");
      return { ok: false, error: "Could not get price" };
    }

    const positions = positionsRes ?? [];
    const hasPosition = positions.length > 0;

    if (hasPosition) {
      await updateError(null);
      return { ok: true, message: "Already in position, skip" };
    }

    const signal = simpleSignal(candlesRes);
    if (!signal) {
      await updateError(null);
      return { ok: true, message: "No signal" };
    }

    if (!instRes) {
      await updateError("Could not get instrument");
      return { ok: false, error: "Could not get instrument" };
    }

    const contractValue = parseFloatSafe(instRes.contractValue);
    const minSize = parseFloatSafe(instRes.minSize);
    if (contractValue <= 0) {
      await updateError("Invalid contract value");
      return { ok: false, error: "Invalid contract value" };
    }

    // Linear contract: notional = size * contractValue * price; we want notional ≈ positionSizeUsdt
    const sizeContracts = bot.positionSizeUsdt / (lastPrice * contractValue);
    const lotSize = parseFloatSafe(instRes.minSize);
    const sizeStr = roundSize(sizeContracts, minSize, lotSize);
    if (parseFloat(sizeStr) < minSize) {
      await updateError(`Size ${sizeStr} below min ${minSize}`);
      return { ok: false, error: `Position size below minimum (min ${minSize} contracts)` };
    }

    const leverageOk = await setLeverage(instId, bot.leverage, "cross");
    if (!leverageOk.ok) {
      console.warn("Blofin setLeverage:", leverageOk.error);
      // continue anyway
    }

    const order = await placeMarketOrder(instId, signal, sizeStr, "cross");
    if (!order.ok) {
      await updateError(order.error ?? "Order failed");
      return { ok: false, error: order.error };
    }

    await updateError(null);
    return { ok: true, message: `Opened ${signal} ${sizeStr} @ ${lastPrice}` };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    await updateError(err);
    return { ok: false, error: err };
  }
}
