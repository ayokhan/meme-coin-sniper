/**
 * Nova Forex Scalper: MT4/MT5 via MetaAPI — enter at entry price (cross), exit by closing
 * position at exit price (or optional stop). Repeats when flat up to maxRounds (0 = unlimited).
 * Mirrors lib/nova-scalper-run.ts (Blofin) but sized in lots and traded via MetaAPI.
 */

import { prisma } from "@/lib/db";
import { normalizeForexSymbol, getForexCandles } from "@/lib/forex-market";
import { getForexSpotMid, usesSpotCalibration } from "@/lib/forex-spot-feed";
import { resolveForexBrokerForSession } from "@/lib/forex-broker-session";
import { parseForexBrokerId } from "@/lib/forex-broker-user-config";
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

function toBrokerSymbol(symbol: string): string {
  return normalizeForexSymbol(symbol).replace(/[^A-Z0-9]/g, "");
}

type ForexScalperRow = {
  id: string;
  userId?: string | null;
  slot: number;
  enabled: boolean;
  ownerForceOff: boolean;
  mode: string; // demo | live
  broker: string;
  symbol: string;
  side: string; // long | short
  entryTrigger: string; // cross_down | cross_up
  entryPrice: number;
  exitPrice: number;
  stopLossPrice: number | null;
  lotSize: number;
  maxRounds: number;
  completedRounds: number;
  inPosition: boolean;
  lastRefPrice: number | null;
};

function shouldEnter(side: string, trigger: string, entry: number, lastRef: number, price: number): boolean {
  const t = trigger === "cross_up" ? "cross_up" : "cross_down";
  if (side === "long") {
    if (t === "cross_down") return lastRef >= entry && price <= entry;
    return lastRef <= entry && price >= entry;
  }
  if (t === "cross_up") return lastRef <= entry && price >= entry;
  return lastRef >= entry && price <= entry;
}

function shouldExit(side: string, exit: number, lastRef: number, price: number): boolean {
  if (side === "long") return lastRef < exit && price >= exit;
  return lastRef > exit && price <= exit;
}

function stopHit(side: string, stop: number, price: number): boolean {
  if (side === "long") return price <= stop;
  return price >= stop;
}

async function readPrice(symbol: string, accountId: string | null, brokerSymbol: string): Promise<number> {
  if (accountId) {
    const p = await getMetaApiSymbolPrice(accountId, brokerSymbol);
    if (p?.last) return p.last;
  }
  if (usesSpotCalibration(symbol)) {
    const mid = await getForexSpotMid(symbol);
    if (mid != null) return mid;
  }
  const candles = await getForexCandles(symbol, "1m", 2).catch(() => []);
  return candles[0] ? parseFloatSafe(candles[0][4]) : 0;
}

export async function runNovaForexScalperTick(
  userId: string,
  runOpts?: { configId?: string }
): Promise<{ ok: boolean; message?: string; error?: string }> {
  if (!userId) {
    return { ok: false, error: "Sign in required to run Nova Forex Scalper." };
  }

  let row: ForexScalperRow | null = null;
  try {
    if (runOpts?.configId) {
      row = await db.novaForexScalperConfig.findFirst({ where: { id: runOpts.configId, userId } });
    } else {
      row = await db.novaForexScalperConfig.findFirst({ where: { userId }, orderBy: { slot: "asc" } });
    }
  } catch {
    return { ok: false, error: "Nova Forex Scalper table missing. Run prisma db push." };
  }

  if (!row || !row.enabled || row.ownerForceOff) {
    return { ok: true, message: "Nova Forex Scalper is off, suspended by the owner, or save your config first." };
  }

  const updateRow = async (data: Record<string, unknown>) => {
    await db.novaForexScalperConfig.update({ where: { id: row!.id }, data });
  };

  if (!isMetaApiConfigured()) {
    await updateRow({ lastError: "METAAPI_TOKEN not configured", lastTickAt: new Date() });
    return { ok: false, error: "MetaAPI is not configured on the server (METAAPI_TOKEN)." };
  }

  const broker = parseForexBrokerId(row.broker) ?? "vantage";
  const connection = await resolveForexBrokerForSession(userId, false, broker);
  if (!connection?.metaApiAccountId) {
    await updateRow({
      lastError: "Broker not connected",
      lastTickAt: new Date(),
      lastAction: "Skipped: connect your MT4/MT5 broker account first.",
    });
    return { ok: false, error: "Connect your forex broker account (MT4/MT5) before running Nova Forex Scalper." };
  }
  const accountId = connection.metaApiAccountId;

  const symbol = normalizeForexSymbol(row.symbol);
  const brokerSymbol = toBrokerSymbol(symbol);
  const side = row.side === "short" ? "short" : "long";

  if (side === "long" && row.exitPrice <= row.entryPrice) {
    return { ok: false, error: "Long: exit price should be above entry price." };
  }
  if (side === "short" && row.exitPrice >= row.entryPrice) {
    return { ok: false, error: "Short: exit price should be below entry price." };
  }

  const price = await readPrice(symbol, accountId, brokerSymbol);
  if (!Number.isFinite(price) || price <= 0) {
    await updateRow({
      lastError: "No price",
      lastTickAt: new Date(),
      lastAction: "Tick failed: could not read a live price.",
    });
    return { ok: false, error: "Could not read last price." };
  }

  const positions = await getMetaApiPositions(accountId);
  const hasExchangePosition = positions.some((p) => p.symbol === brokerSymbol);

  if (row.inPosition && !hasExchangePosition) {
    await updateRow({
      inPosition: false,
      lastAction: "Sync: was marked in-position but broker shows no position; reset to flat.",
      lastRefPrice: price,
      lastTickAt: new Date(),
      lastError: null,
    });
    row.inPosition = false;
    row.lastRefPrice = price;
  }

  if (!row.inPosition && hasExchangePosition) {
    await updateRow({
      inPosition: true,
      lastAction:
        "Detected open position on broker (manual or prior run). Nova Forex Scalper will try to exit at your exit/stop only.",
      lastRefPrice: price,
      lastTickAt: new Date(),
      lastError: null,
    });
    row.inPosition = true;
    row.lastRefPrice = price;
  }

  let lastRef = row.lastRefPrice;
  if (lastRef == null || !Number.isFinite(lastRef)) {
    await updateRow({
      lastRefPrice: price,
      lastTickAt: new Date(),
      lastError: null,
      lastAction: "Primed reference price for cross detection.",
    });
    return { ok: true, message: "Primed price reference. Next tick evaluates entry/exit crosses." };
  }

  const trigger = row.entryTrigger === "cross_up" ? "cross_up" : "cross_down";

  if (row.inPosition || hasExchangePosition) {
    if (row.stopLossPrice != null && Number.isFinite(row.stopLossPrice) && stopHit(side, row.stopLossPrice, price)) {
      const cl = await closeMetaApiPositionsBySymbol({ accountId, symbol: brokerSymbol });
      if (!cl.ok) {
        const err = cl.error ?? "Stop close failed";
        await updateRow({
          lastError: err,
          lastTickAt: new Date(),
          lastAction: `Stop hit @ ~${price}, but close failed: ${err}`,
        });
        return { ok: false, error: err };
      }
      const rounds = (row.completedRounds ?? 0) + 1;
      const stopData: Record<string, unknown> = {
        inPosition: false,
        completedRounds: rounds,
        lastRefPrice: price,
        lastTickAt: new Date(),
        lastError: null,
        lastAction: `Stop loss hit @ ~${price}. Closed. Round ${rounds}.`,
      };
      if (row.maxRounds > 0 && rounds >= row.maxRounds) {
        stopData.enabled = false;
        stopData.lastAction = `Max rounds (${row.maxRounds}) reached after stop. Disabled.`;
      }
      await updateRow(stopData);
      return { ok: true, message: "Closed on stop loss." };
    }

    if (shouldExit(side, row.exitPrice, lastRef, price)) {
      const cl = await closeMetaApiPositionsBySymbol({ accountId, symbol: brokerSymbol });
      if (!cl.ok) {
        const err = cl.error ?? "Exit close failed";
        await updateRow({
          lastError: err,
          lastTickAt: new Date(),
          lastAction: `Exit target @ ~${price}, but close failed: ${err}`,
        });
        return { ok: false, error: err };
      }
      const rounds = (row.completedRounds ?? 0) + 1;
      const exitData: Record<string, unknown> = {
        inPosition: false,
        completedRounds: rounds,
        lastRefPrice: price,
        lastTickAt: new Date(),
        lastError: null,
        lastAction: `Exit target hit @ ~${price}. Position closed. Round ${rounds}.`,
      };
      if (row.maxRounds > 0 && rounds >= row.maxRounds) {
        exitData.enabled = false;
        exitData.lastAction = `Max rounds (${row.maxRounds}) reached. Disabled.`;
      }
      await updateRow(exitData);
      return { ok: true, message: "Closed at exit target." };
    }

    await updateRow({ lastRefPrice: price, lastTickAt: new Date(), lastError: null });
    return { ok: true, message: "In position; waiting for exit or stop." };
  }

  if (row.maxRounds > 0 && (row.completedRounds ?? 0) >= row.maxRounds) {
    await updateRow({ lastRefPrice: price, lastTickAt: new Date() });
    return { ok: true, message: "Max rounds reached; not opening again." };
  }

  if (!shouldEnter(side, trigger, row.entryPrice, lastRef, price)) {
    await updateRow({ lastRefPrice: price, lastTickAt: new Date(), lastError: null });
    return { ok: true, message: "Flat; waiting for entry cross." };
  }

  const lotSize = Math.max(0.01, row.lotSize || 0.01);
  const order = await placeMetaApiMarketOrder({
    accountId,
    symbol: brokerSymbol,
    side: side === "long" ? "buy" : "sell",
    volume: lotSize,
  });
  if (!order.ok) {
    const err = order.error ?? "Order failed";
    await updateRow({
      lastError: err,
      lastTickAt: new Date(),
      lastAction: `Entry cross @ ~${price} — market ${side === "long" ? "buy" : "sell"} failed: ${err}`,
    });
    return { ok: false, error: err };
  }

  await updateRow({
    inPosition: true,
    lastRefPrice: price,
    lastTickAt: new Date(),
    lastError: null,
    lastAction: `Opened ${side} ${lotSize} lots @ ~${price}. Will close at exit ${row.exitPrice} or stop.`,
  });

  return { ok: true, message: `Entered ${side}. Monitoring exit/stop.` };
}

export async function resetNovaForexScalperState(
  userId: string,
  options?: { configId?: string; clearRounds?: boolean; clearInPosition?: boolean }
): Promise<{ ok: boolean; error?: string }> {
  try {
    let row: { id: string } | null = null;
    if (options?.configId) {
      row = await db.novaForexScalperConfig.findFirst({ where: { id: options.configId, userId } });
    } else {
      row = await db.novaForexScalperConfig.findFirst({ where: { userId }, orderBy: { slot: "asc" } });
    }
    if (!row) return { ok: false, error: "No config. Open Nova Forex Scalper once to create it." };
    await db.novaForexScalperConfig.update({
      where: { id: row.id },
      data: {
        lastRefPrice: null,
        ...(options?.clearInPosition !== false ? { inPosition: false } : {}),
        ...(options?.clearRounds ? { completedRounds: 0 } : {}),
        lastAction: "State reset by user.",
        lastError: null,
      },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Reset failed" };
  }
}
