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
  getMetaApiSymbols,
  getMetaApiAccountInformation,
  placeMetaApiMarketOrder,
  modifyMetaApiPositionStops,
  closeMetaApiPosition,
} from "@/lib/metaapi";
import { forexBrokerSymbolAliases, matchForexSymbolOnBroker } from "@/lib/forex-broker-symbols";
import { estimateForexMarginFromLots, maxForexLotsForFreeMargin } from "@/lib/forex-lot-size";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

function parseFloatSafe(s: string): number {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function toBrokerSymbol(symbol: string): string {
  return normalizeForexSymbol(symbol).replace(/[^A-Z0-9]/g, "");
}

/** Broker-side SL/TP only when on the correct side of entry for this trade. */
function brokerStopsForSide(
  side: "long" | "short",
  entryPrice: number,
  exitPrice: number,
  stopLossPrice: number | null
): { stopLoss?: number; takeProfit?: number } {
  const out: { stopLoss?: number; takeProfit?: number } = {};
  const entry = Number(entryPrice);
  const exit = Number(exitPrice);
  const stop = stopLossPrice != null ? Number(stopLossPrice) : NaN;
  if (side === "long") {
    if (Number.isFinite(exit) && exit > entry) out.takeProfit = exit;
    if (Number.isFinite(stop) && stop > 0 && stop < entry) out.stopLoss = stop;
  } else {
    if (Number.isFinite(exit) && exit < entry) out.takeProfit = exit;
    if (Number.isFinite(stop) && stop > 0 && stop > entry) out.stopLoss = stop;
  }
  return out;
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
  entryTrigger: string; // cross_down | cross_up | immediate
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
  if (trigger === "immediate") return Number.isFinite(price) && price > 0;
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
    for (const sym of forexBrokerSymbolAliases(brokerSymbol)) {
      const p = await getMetaApiSymbolPrice(accountId, sym);
      if (p?.last) return p.last;
    }
  }
  if (usesSpotCalibration(symbol)) {
    const mid = await getForexSpotMid(symbol);
    if (mid != null) return mid;
  }
  const candles = await getForexCandles(symbol, "1m", 2).catch(() => []);
  return candles[0] ? parseFloatSafe(candles[0][4]) : 0;
}

/** Prefer a symbol MetaAPI can price/trade on this account. */
async function resolveTradeSymbol(accountId: string, brokerSymbol: string): Promise<string | null> {
  for (const sym of forexBrokerSymbolAliases(brokerSymbol)) {
    const p = await getMetaApiSymbolPrice(accountId, sym);
    if (p?.last) return sym;
  }
  const listed = await getMetaApiSymbols(accountId);
  if (listed.length > 0) {
    const matched = matchForexSymbolOnBroker(brokerSymbol, listed);
    if (matched) {
      const p = await getMetaApiSymbolPrice(accountId, matched);
      if (p?.last) return matched;
      // Listed but no price quote — still try trading with the matched name
      return matched;
    }
  }
  return null;
}

async function closePositionsForSymbol(
  accountId: string,
  brokerSymbol: string,
  tradeSymbol: string
): Promise<{ ok: boolean; error?: string }> {
  const aliases = new Set(
    [...forexBrokerSymbolAliases(brokerSymbol), tradeSymbol].map((s) => s.toUpperCase())
  );
  const positions = await getMetaApiPositions(accountId);
  const matches = positions.filter((p) => aliases.has(String(p.symbol ?? "").toUpperCase()));
  if (matches.length === 0) return { ok: true };
  let lastError: string | undefined;
  for (const pos of matches) {
    const res = await closeMetaApiPosition({ accountId, positionId: pos.id });
    if (!res.ok) lastError = res.error;
  }
  return lastError ? { ok: false, error: lastError } : { ok: true };
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
    await updateRow({ lastError: "Broker trading temporarily unavailable", lastTickAt: new Date() });
    return { ok: false, error: "Broker trading is temporarily unavailable. Please try again later." };
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
  const aliases = new Set(forexBrokerSymbolAliases(brokerSymbol).map((s) => s.toUpperCase()));
  const hasExchangePosition = positions.some((p) => aliases.has(String(p.symbol ?? "").toUpperCase()));
  const tradeSymbolResolved = await resolveTradeSymbol(accountId, brokerSymbol);
  const tradeSymbol = tradeSymbolResolved ?? brokerSymbol;

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

  const trigger =
    row.entryTrigger === "cross_up"
      ? "cross_up"
      : row.entryTrigger === "immediate"
        ? "immediate"
        : "cross_down";

  if (row.inPosition || hasExchangePosition) {
    // Attach broker SL/TP if the open was placed without them (software-only exits previously).
    const desiredStops = brokerStopsForSide(side, row.entryPrice, row.exitPrice, row.stopLossPrice);
    if (desiredStops.stopLoss != null || desiredStops.takeProfit != null) {
      const openHere = positions.filter((p) => aliases.has(String(p.symbol ?? "").toUpperCase()));
      for (const pos of openHere) {
        const missingSl =
          desiredStops.stopLoss != null &&
          (pos.stopLoss == null || !Number.isFinite(Number(pos.stopLoss)) || Number(pos.stopLoss) <= 0);
        const missingTp =
          desiredStops.takeProfit != null &&
          (pos.takeProfit == null || !Number.isFinite(Number(pos.takeProfit)) || Number(pos.takeProfit) <= 0);
        if (!missingSl && !missingTp) continue;
        const mod = await modifyMetaApiPositionStops({
          accountId,
          positionId: pos.id,
          stopLoss: missingSl ? desiredStops.stopLoss : pos.stopLoss,
          takeProfit: missingTp ? desiredStops.takeProfit : pos.takeProfit,
        });
        if (mod.ok) {
          await updateRow({
            lastTickAt: new Date(),
            lastAction: `Attached broker stops on #${pos.id}: SL ${desiredStops.stopLoss ?? "—"} / TP ${desiredStops.takeProfit ?? "—"}.`,
          });
        }
      }
    }

    if (row.stopLossPrice != null && Number.isFinite(row.stopLossPrice) && stopHit(side, row.stopLossPrice, price)) {
      const cl = await closePositionsForSymbol(accountId, brokerSymbol, tradeSymbol);
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
      const cl = await closePositionsForSymbol(accountId, brokerSymbol, tradeSymbol);
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
    const triggerLabel =
      trigger === "immediate" ? "immediate market" : trigger === "cross_up" ? "cross up" : "cross down";
    await updateRow({
      lastRefPrice: price,
      lastTickAt: new Date(),
      lastError: null,
      lastAction: `Waiting for ${side} ${triggerLabel} of entry ${row.entryPrice} (MT mid ~${price}; prev ref ~${lastRef}). Price must cross entry — already through it won’t enter until it comes back and crosses again.`,
    });
    return { ok: true, message: "Flat; waiting for entry cross." };
  }

  if (
    trigger === "immediate" &&
    row.stopLossPrice != null &&
    Number.isFinite(row.stopLossPrice) &&
    stopHit(side, row.stopLossPrice, price)
  ) {
    await updateRow({
      lastRefPrice: price,
      lastTickAt: new Date(),
      lastError: null,
      lastAction: `Immediate entry skipped — live ~${price} already through stop ${row.stopLossPrice}. Refresh the Scalp plan.`,
      enabled: false,
    });
    return { ok: true, message: "Skipped immediate entry; stop already hit." };
  }

  if (!tradeSymbolResolved) {
    const hint = `Cannot trade ${brokerSymbol}: not found on your MT Market Watch (tried common aliases). In MT5 → Market Watch, show All / add the symbol (e.g. NVDA.US), or use XAUUSD / EURUSD / NAS100 if those appear in your terminal.`;
    await updateRow({
      lastError: "Unknown symbol",
      lastTickAt: new Date(),
      lastRefPrice: price,
      lastAction: `Entry signal @ ~${price} — ${hint}`,
    });
    return { ok: false, error: hint };
  }

  const lotSizeConfigured = Math.max(0.01, row.lotSize || 0.01);
  let lotSize = lotSizeConfigured;
  let lotNote = "";
  const acct = await getMetaApiAccountInformation(accountId);
  if (acct && Number.isFinite(acct.freeMargin) && Number.isFinite(acct.leverage) && acct.leverage > 0) {
    const need = estimateForexMarginFromLots({
      symbol: brokerSymbol,
      entryPrice: price,
      lotSize,
      leverage: acct.leverage,
    });
    const free = Number(acct.freeMargin);
    if (need > free * 0.95) {
      const affordable = maxForexLotsForFreeMargin({
        symbol: brokerSymbol,
        entryPrice: price,
        freeMarginUsd: free,
        leverage: acct.leverage,
      });
      if (affordable < 0.01) {
        const msg = `Not enough free margin for ${lotSize} lots of ${brokerSymbol} (~$${need} needed, ~$${free.toFixed(2)} free @ 1:${acct.leverage}). Deposit funds, lower size, or raise MT leverage.`;
        await updateRow({
          lastError: "Not enough money",
          lastTickAt: new Date(),
          lastRefPrice: price,
          lastAction: `Entry signal @ ~${price} — ${msg}`,
        });
        return { ok: false, error: msg };
      }
      if (affordable < lotSize) {
        lotNote = ` (sized down ${lotSize}→${affordable} lots to fit ~$${free.toFixed(2)} free margin)`;
        lotSize = affordable;
        await updateRow({ lotSize });
      }
    }
  }

  const stops = brokerStopsForSide(side, row.entryPrice, row.exitPrice, row.stopLossPrice);
  const orderPayload = {
    accountId,
    symbol: tradeSymbolResolved,
    side: (side === "long" ? "buy" : "sell") as "buy" | "sell",
    volume: lotSize,
    stopLoss: stops.stopLoss,
    takeProfit: stops.takeProfit,
  };

  let order = await placeMetaApiMarketOrder(orderPayload);
  // Retry remaining aliases if broker rejected the first name
  if (!order.ok && /unknown symbol/i.test(order.error ?? "")) {
    for (const sym of forexBrokerSymbolAliases(brokerSymbol)) {
      if (sym === tradeSymbolResolved) continue;
      const retry = await placeMetaApiMarketOrder({ ...orderPayload, symbol: sym });
      if (retry.ok) {
        order = retry;
        break;
      }
    }
  }
  // If SL/TP rejected, retry bare market then attach stops
  if (!order.ok && /stop|invalid|invalid stops|invalid price/i.test(order.error ?? "") && (stops.stopLoss || stops.takeProfit)) {
    order = await placeMetaApiMarketOrder({
      accountId,
      symbol: tradeSymbolResolved,
      side: orderPayload.side,
      volume: lotSize,
    });
  }
  // If still no money, try 0.01 once
  if (!order.ok && /not enough|no money|insufficient/i.test(order.error ?? "") && lotSize > 0.01) {
    const retry = await placeMetaApiMarketOrder({ ...orderPayload, volume: 0.01 });
    if (retry.ok) {
      order = retry;
      lotSize = 0.01;
      lotNote = " (retried at 0.01 lots after margin reject)";
      await updateRow({ lotSize: 0.01 });
    }
  }
  if (!order.ok) {
    const err = order.error ?? "Order failed";
    await updateRow({
      lastError: err,
      lastTickAt: new Date(),
      lastAction: `Entry cross @ ~${price} — market ${side === "long" ? "buy" : "sell"} ${lotSize} lots failed: ${err}`,
    });
    return { ok: false, error: err };
  }

  // Ensure broker SL/TP exist (order may have opened without them)
  if (stops.stopLoss != null || stops.takeProfit != null) {
    let positionId = order.positionId;
    if (!positionId) {
      const after = await getMetaApiPositions(accountId);
      const match = after.find((p) => aliases.has(String(p.symbol ?? "").toUpperCase()));
      positionId = match?.id;
    }
    if (positionId) {
      const mod = await modifyMetaApiPositionStops({
        accountId,
        positionId,
        stopLoss: stops.stopLoss,
        takeProfit: stops.takeProfit,
      });
      if (mod.ok) {
        lotNote += ` · broker SL ${stops.stopLoss ?? "—"} / TP ${stops.takeProfit ?? "—"}`;
      } else if (mod.error) {
        lotNote += ` · broker stops pending (${mod.error})`;
      }
    }
  }

  await updateRow({
    inPosition: true,
    lastRefPrice: price,
    lastTickAt: new Date(),
    lastError: null,
    lastAction: `Opened ${side} ${lotSize} lots @ ~${price} (${tradeSymbolResolved})${lotNote}. Will close at exit ${row.exitPrice} or stop.`,
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
