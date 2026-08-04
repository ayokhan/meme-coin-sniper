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
  getMetaApiSymbolSpecification,
  getMetaApiAccountInformation,
  placeMetaApiMarketOrder,
  modifyMetaApiPositionStops,
  closeMetaApiPosition,
  type MetaApiSymbolSpecification,
} from "@/lib/metaapi";
import {
  forexBrokerSymbolAliases,
  forexSymbolKey,
  forexSymbolsMatch,
  matchForexSymbolOnBroker,
} from "@/lib/forex-broker-symbols";
import {
  estimateForexMarginFromLots,
  maxForexLotsForFreeMargin,
  quantizeForexLots,
  roundForexPriceToTick,
  type ForexVolumeRules,
} from "@/lib/forex-lot-size";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

function parseFloatSafe(s: string): number {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function toBrokerSymbol(symbol: string): string {
  return normalizeForexSymbol(symbol).replace(/[^A-Z0-9]/g, "");
}

function volumeRulesFromSpec(spec: MetaApiSymbolSpecification | null): ForexVolumeRules | undefined {
  if (!spec) return undefined;
  return {
    minVolume: spec.minVolume,
    maxVolume: spec.maxVolume,
    volumeStep: spec.volumeStep,
    contractSize: spec.contractSize,
  };
}

/**
 * Broker SL/TP must sit on the correct side of live bid/ask (MT rejects otherwise).
 * Prefer market quotes so levels still work when fill differs from plan entry.
 */
function brokerStopsForSide(
  side: "long" | "short",
  exitPrice: number,
  stopLossPrice: number | null,
  market: { bid: number; ask: number; last?: number },
  tick?: { tickSize?: number; digits?: number }
): { stopLoss?: number; takeProfit?: number } {
  const out: { stopLoss?: number; takeProfit?: number } = {};
  const bid = Number(market.bid);
  const ask = Number(market.ask);
  const mid =
    Number.isFinite(bid) && Number.isFinite(ask) && bid > 0 && ask > 0
      ? (bid + ask) / 2
      : Number(market.last) || 0;
  if (!Number.isFinite(mid) || mid <= 0) return out;

  const exit = roundForexPriceToTick(Number(exitPrice), tick?.tickSize, tick?.digits);
  const stop =
    stopLossPrice != null
      ? roundForexPriceToTick(Number(stopLossPrice), tick?.tickSize, tick?.digits)
      : NaN;

  // Long: TP above ask, SL below bid. Short: TP below bid, SL above ask.
  if (side === "long") {
    if (Number.isFinite(exit) && exit > ask) out.takeProfit = exit;
    if (Number.isFinite(stop) && stop > 0 && stop < bid) out.stopLoss = stop;
  } else {
    if (Number.isFinite(exit) && exit < bid) out.takeProfit = exit;
    if (Number.isFinite(stop) && stop > 0 && stop > ask) out.stopLoss = stop;
  }
  return out;
}

/** True only for stop-level rejections — must NOT match "Invalid volume". */
function isInvalidStopsError(msg: string | undefined | null): boolean {
  const m = String(msg ?? "").toLowerCase();
  if (!m) return false;
  if (m.includes("invalid volume") || m.includes("volume in the request")) return false;
  return (
    /invalid\s*stops?/.test(m) ||
    /invalid\s*s\/?l/.test(m) ||
    /invalid\s*t\/?p/.test(m) ||
    /stops?\s*(level|too\s*close)/.test(m) ||
    /trade_retcode_invalid_stops/.test(m) ||
    (m.includes("invalid price") && (m.includes("stop") || m.includes("profit")))
  );
}

function isInvalidVolumeError(msg: string | undefined | null): boolean {
  const m = String(msg ?? "").toLowerCase();
  return m.includes("invalid volume") || m.includes("volume in the request") || m.includes("invalid_volume");
}

function positionOnSymbol(
  positions: Array<{ id: string; symbol?: string; stopLoss?: number; takeProfit?: number }>,
  brokerSymbol: string,
  tradeSymbol: string
) {
  const aliasKeys = new Set(
    [...forexBrokerSymbolAliases(brokerSymbol), tradeSymbol, brokerSymbol].map((s) => forexSymbolKey(s))
  );
  return positions.filter((p) => {
    const key = forexSymbolKey(String(p.symbol ?? ""));
    if (aliasKeys.has(key)) return true;
    return (
      forexSymbolsMatch(String(p.symbol ?? ""), tradeSymbol) ||
      forexSymbolsMatch(String(p.symbol ?? ""), brokerSymbol)
    );
  });
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
  const positions = await getMetaApiPositions(accountId);
  const matches = positionOnSymbol(positions, brokerSymbol, tradeSymbol);
  if (matches.length === 0) return { ok: true };
  let lastError: string | undefined;
  for (const pos of matches) {
    const res = await closeMetaApiPosition({ accountId, positionId: pos.id });
    if (!res.ok) lastError = res.error;
  }
  return lastError ? { ok: false, error: lastError } : { ok: true };
}

async function attachBrokerStops(input: {
  accountId: string;
  positionId: string;
  stopLoss?: number;
  takeProfit?: number;
}): Promise<{ ok: boolean; error?: string }> {
  if (input.stopLoss == null && input.takeProfit == null) {
    return { ok: false, error: "No stop loss or take profit to set." };
  }
  // Try full pair first, then each side alone if broker rejects one level.
  let mod = await modifyMetaApiPositionStops({
    accountId: input.accountId,
    positionId: input.positionId,
    stopLoss: input.stopLoss,
    takeProfit: input.takeProfit,
  });
  if (mod.ok) return { ok: true };
  if (input.stopLoss != null && input.takeProfit != null && isInvalidStopsError(mod.error)) {
    const slOnly = await modifyMetaApiPositionStops({
      accountId: input.accountId,
      positionId: input.positionId,
      stopLoss: input.stopLoss,
    });
    const tpOnly = await modifyMetaApiPositionStops({
      accountId: input.accountId,
      positionId: input.positionId,
      takeProfit: input.takeProfit,
    });
    if (slOnly.ok || tpOnly.ok) {
      const parts: string[] = [];
      if (!slOnly.ok && mod.error) parts.push(`SL: ${slOnly.error ?? "failed"}`);
      if (!tpOnly.ok) parts.push(`TP: ${tpOnly.error ?? "failed"}`);
      return parts.length
        ? { ok: true, error: `Partial stops · ${parts.join("; ")}` }
        : { ok: true };
    }
  }
  return { ok: false, error: mod.error ?? "Modify stops failed" };
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
  const tradeSymbolResolved = await resolveTradeSymbol(accountId, brokerSymbol);
  const tradeSymbol = tradeSymbolResolved ?? brokerSymbol;
  const openHere = positionOnSymbol(positions, brokerSymbol, tradeSymbol);
  const hasExchangePosition = openHere.length > 0;

  const quote =
    (await getMetaApiSymbolPrice(accountId, tradeSymbol)) ??
    (await getMetaApiSymbolPrice(accountId, brokerSymbol));
  const market = {
    bid: quote?.bid ?? price,
    ask: quote?.ask ?? price,
    last: quote?.last ?? price,
  };
  const spec =
    (tradeSymbolResolved
      ? await getMetaApiSymbolSpecification(accountId, tradeSymbolResolved)
      : null) ?? (await getMetaApiSymbolSpecification(accountId, brokerSymbol));
  const volRules = volumeRulesFromSpec(spec);
  const tickOpts = { tickSize: spec?.tickSize, digits: spec?.digits };

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
    // Attach broker SL/TP if the open was placed without them (or prior attach failed).
    let stopAttachNote: string | null = null;
    let stopAttachError: string | null = null;
    const desiredStops = brokerStopsForSide(side, row.exitPrice, row.stopLossPrice, market, tickOpts);
    if (desiredStops.stopLoss != null || desiredStops.takeProfit != null) {
      for (const pos of openHere) {
        const missingSl =
          desiredStops.stopLoss != null &&
          (pos.stopLoss == null || !Number.isFinite(Number(pos.stopLoss)) || Number(pos.stopLoss) <= 0);
        const missingTp =
          desiredStops.takeProfit != null &&
          (pos.takeProfit == null || !Number.isFinite(Number(pos.takeProfit)) || Number(pos.takeProfit) <= 0);
        if (!missingSl && !missingTp) continue;
        const mod = await attachBrokerStops({
          accountId,
          positionId: String(pos.id),
          stopLoss: missingSl ? desiredStops.stopLoss : Number(pos.stopLoss) > 0 ? Number(pos.stopLoss) : undefined,
          takeProfit:
            missingTp ? desiredStops.takeProfit : Number(pos.takeProfit) > 0 ? Number(pos.takeProfit) : undefined,
        });
        if (mod.ok) {
          stopAttachNote = `Attached broker stops on #${pos.id}: SL ${desiredStops.stopLoss ?? "—"} / TP ${desiredStops.takeProfit ?? "—"}${mod.error ? ` (${mod.error})` : ""}.`;
          stopAttachError = mod.error ?? null;
        } else {
          stopAttachNote = `Tried to attach SL ${desiredStops.stopLoss ?? "—"} / TP ${desiredStops.takeProfit ?? "—"} on #${pos.id} — ${mod.error ?? "failed"}. Soft exit still watches levels.`;
          stopAttachError = mod.error ?? "Could not attach SL/TP";
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

    await updateRow({
      lastRefPrice: price,
      lastTickAt: new Date(),
      ...(stopAttachNote
        ? { lastAction: stopAttachNote, lastError: stopAttachError }
        : { lastError: null }),
    });
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
  let lotSize = quantizeForexLots(lotSizeConfigured, volRules) || quantizeForexLots(0.01, volRules) || 0.01;
  let lotNote = "";
  if (Math.abs(lotSize - lotSizeConfigured) > 1e-9) {
    lotNote = ` (volume adjusted ${lotSizeConfigured}→${lotSize} for broker min/step/max)`;
    await updateRow({ lotSize });
  }

  const acct = await getMetaApiAccountInformation(accountId);
  if (acct && Number.isFinite(acct.freeMargin) && Number.isFinite(acct.leverage) && acct.leverage > 0) {
    const need = estimateForexMarginFromLots({
      symbol: brokerSymbol,
      entryPrice: price,
      lotSize,
      leverage: acct.leverage,
      rules: volRules,
    });
    const free = Number(acct.freeMargin);
    if (need > free * 0.95) {
      const affordable = maxForexLotsForFreeMargin({
        symbol: brokerSymbol,
        entryPrice: price,
        freeMarginUsd: free,
        leverage: acct.leverage,
        rules: volRules,
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
        lotNote += ` (sized down ${lotSize}→${affordable} lots to fit ~$${free.toFixed(2)} free margin)`;
        lotSize = affordable;
        await updateRow({ lotSize });
      }
    }
  }

  const stops = brokerStopsForSide(side, row.exitPrice, row.stopLossPrice, market, tickOpts);
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
  // Only strip SL/TP on genuine stop-level rejections (never on "Invalid volume")
  if (!order.ok && isInvalidStopsError(order.error) && (stops.stopLoss || stops.takeProfit)) {
    order = await placeMetaApiMarketOrder({
      accountId,
      symbol: tradeSymbolResolved,
      side: orderPayload.side,
      volume: lotSize,
    });
  }
  // Invalid volume → snap to min step and retry once
  if (!order.ok && isInvalidVolumeError(order.error)) {
    const minLot = quantizeForexLots(volRules?.minVolume ?? 0.01, volRules) || 0.01;
    if (Math.abs(minLot - lotSize) > 1e-9) {
      const retry = await placeMetaApiMarketOrder({
        ...orderPayload,
        volume: minLot,
        // keep SL/TP so broker-side protection is on the second try
      });
      if (retry.ok) {
        order = retry;
        lotNote += ` (retried at ${minLot} lots after invalid volume)`;
        lotSize = minLot;
        await updateRow({ lotSize: minLot });
      }
    }
  }
  // If still no money, try min lot once
  if (!order.ok && /not enough|no money|insufficient/i.test(order.error ?? "") && lotSize > 0.01) {
    const minLot = quantizeForexLots(volRules?.minVolume ?? 0.01, volRules) || 0.01;
    const retry = await placeMetaApiMarketOrder({ ...orderPayload, volume: minLot });
    if (retry.ok) {
      order = retry;
      lotSize = minLot;
      lotNote += ` (retried at ${minLot} lots after margin reject)`;
      await updateRow({ lotSize: minLot });
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

  // Always ensure broker SL/TP exist (order may open without them after bare retry)
  if (stops.stopLoss != null || stops.takeProfit != null) {
    let positionId = order.positionId ? String(order.positionId) : undefined;
    if (!positionId) {
      // Brief wait for position book to update
      await new Promise((r) => setTimeout(r, 400));
      const after = await getMetaApiPositions(accountId);
      const match = positionOnSymbol(after, brokerSymbol, tradeSymbolResolved)[0];
      positionId = match?.id != null ? String(match.id) : undefined;
    }
    if (positionId) {
      const mod = await attachBrokerStops({
        accountId,
        positionId,
        stopLoss: stops.stopLoss,
        takeProfit: stops.takeProfit,
      });
      if (mod.ok) {
        lotNote += ` · broker SL ${stops.stopLoss ?? "—"} / TP ${stops.takeProfit ?? "—"}`;
        if (mod.error) lotNote += ` (${mod.error})`;
      } else if (mod.error) {
        lotNote += ` · broker stops pending (${mod.error})`;
      }
    } else {
      lotNote += " · broker stops pending (no position id yet — next tick will attach)";
    }
  } else if (row.stopLossPrice != null || row.exitPrice) {
    lotNote +=
      " · SL/TP not set on MT (levels not on valid side of live bid/ask — check Stop/Exit vs market). Software will still exit on tick.";
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
