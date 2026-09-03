/**
 * NovaScalper: Blofin perps — enter at entry price (cross), exit by closing position at exit price (or optional stop).
 * Repeats when flat up to maxRounds (0 = unlimited). Uses same margin sizing as AI bot: notional = positionSizeUsdt × leverage.
 */

import { prisma } from "@/lib/db";
import { stopLossForActualFill } from "@/lib/nova-scalp-agent";
import {
  resolveScalperExchangeSession,
  scalperClosePosition,
  scalperClampLeverage,
  scalperGetInstrument,
  scalperGetOpenOrders,
  scalperGetPositions,
  scalperGetTicker,
  scalperPlaceMarketOrder,
  scalperPlaceTPSL,
  scalperRoundSize,
  scalperSetLeverage,
} from "@/lib/nova-scalper-exchange";
import { computeCoinbaseSizeFromConfig } from "@/lib/coinbase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

function parseFloatSafe(s: string): number {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

type ScalperRow = {
  id: string;
  userId?: string | null;
  enabled: boolean;
  mode: string;
  symbol: string;
  marginCurrency: string;
  marginMode: string;
  side: string;
  entryTrigger: string;
  leverage: number;
  entryPrice: number;
  exitPrice: number;
  stopLossPrice: number | null;
  positionSizeUsdt: number;
  maxRounds: number;
  completedRounds: number;
  inPosition: boolean;
  lastRefPrice: number | null;
  attachTpsl: boolean;
  tpslTpPct: number | null;
  tpslSlPct: number | null;
  exchange?: string | null;
  sizeMode?: string | null;
  lastAction?: string | null;
  lastError?: string | null;
};

function parseEntryTrigger(raw: string | null | undefined): "cross_down" | "cross_up" | "immediate" {
  if (raw === "cross_up") return "cross_up";
  if (raw === "immediate") return "immediate";
  return "cross_down";
}

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

function looksLikeFailedMarketEntry(action: string | null | undefined, err: string | null | undefined): boolean {
  const t = `${action ?? ""} ${err ?? ""}`;
  return /market (buy|sell) failed/i.test(t);
}

function shouldExit(side: string, exit: number, lastRef: number, price: number): boolean {
  if (side === "long") return lastRef < exit && price >= exit;
  return lastRef > exit && price <= exit;
}

function stopHit(side: string, stop: number, price: number): boolean {
  if (side === "long") return price <= stop;
  return price >= stop;
}

function liveStopPrice(
  row: ScalperRow,
  side: "long" | "short",
  fillPrice: number,
  tickSize?: number | null
): number | null {
  return stopLossForActualFill({
    side,
    planEntry: row.entryPrice,
    planStop:
      row.stopLossPrice != null && Number.isFinite(row.stopLossPrice) && row.stopLossPrice > 0
        ? row.stopLossPrice
        : null,
    fillPrice,
    leverage: row.leverage || 1,
    tickSize,
  });
}

/** Match Blofin instId variants (BTC-USDT vs BTC/USDT). */
function sameInstId(a: string, b: string): boolean {
  const norm = (s: string) => (s || "").replace(/[-/]/g, "").toUpperCase();
  return norm(a) === norm(b);
}

export async function runNovaScalperTick(
  userId: string,
  runOpts?: { envFallbackForOwner?: boolean; configId?: string }
): Promise<{ ok: boolean; message?: string; error?: string }> {
  if (!userId) {
    return { ok: false, error: "Sign in required to run NovaScalper." };
  }

  let row: ScalperRow | null = null;
  try {
    if (runOpts?.configId) {
      row = await db.novaScalperConfig.findFirst({
        where: { id: runOpts.configId, userId },
      });
    } else {
      row = await db.novaScalperConfig.findFirst({
        where: { userId },
        orderBy: { slot: "asc" },
      });
    }
  } catch {
    return { ok: false, error: "NovaScalper table missing. Run prisma db push." };
  }

  if (!row || !row.enabled || (row as { ownerForceOff?: boolean }).ownerForceOff) {
    return {
      ok: true,
      message: "NovaScalper is off, suspended by the owner, or save your config first.",
    };
  }

  const resolved = await resolveScalperExchangeSession(userId, row, runOpts);
  if ("error" in resolved) {
    return { ok: false, error: resolved.error };
  }
  const ex = resolved.session;
  const { instId } = ex;
  const marginMode = (row.marginMode === "isolated" ? "isolated" : "cross") as "isolated" | "cross";
  const side = row.side === "short" ? "short" : "long";

  if (side === "long" && row.exitPrice <= row.entryPrice) {
    return { ok: false, error: "Long: exit price should be above entry price." };
  }
  if (side === "short" && row.exitPrice >= row.entryPrice) {
    return { ok: false, error: "Short: exit price should be below entry price." };
  }

  const ticker = await scalperGetTicker(ex);
  const price = ticker?.last ? parseFloatSafe(ticker.last) : 0;
  if (!Number.isFinite(price) || price <= 0) {
    await db.novaScalperConfig.update({
      where: { id: row.id },
      data: {
        lastError: "No price",
        lastTickAt: new Date(),
        lastAction: `Tick failed: could not read ${ex.label} last price.`,
      },
    });
    return { ok: false, error: "Could not read last price." };
  }

  const positions = await scalperGetPositions(ex);
  const hasExchangePosition = positions.length > 0;

  const updateRow = async (data: Record<string, unknown>) => {
    await db.novaScalperConfig.update({ where: { id: row!.id }, data });
  };

  if (row.inPosition && !hasExchangePosition) {
    await updateRow({
      inPosition: false,
      lastAction: "Sync: was marked in-position but exchange has no position; reset to flat.",
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
        "Detected open position on exchange (manual or prior run). NovaScalper will try to exit at your exit/stop only.",
      lastRefPrice: price,
      lastTickAt: new Date(),
      lastError: null,
    });
    row.inPosition = true;
    row.lastRefPrice = price;
  }

  let lastRef = row.lastRefPrice;
  if (lastRef == null || !Number.isFinite(lastRef)) {
    await updateRow({ lastRefPrice: price, lastTickAt: new Date(), lastError: null, lastAction: "Primed reference price for cross detection." });
    return { ok: true, message: "Primed price reference. Next tick evaluates entry/exit crosses." };
  }

  const failedEntryRetry = looksLikeFailedMarketEntry(row.lastAction, row.lastError);
  const trigger = failedEntryRetry ? "immediate" : parseEntryTrigger(row.entryTrigger);

  const posAvgPx = hasExchangePosition && positions[0]?.avgPx ? parseFloatSafe(positions[0].avgPx) : 0;

  if (row.inPosition || hasExchangePosition) {
    const fillForStop = posAvgPx > 0 ? posAvgPx : row.entryPrice;
    const stop = liveStopPrice(row, side, fillForStop);
    if (stop != null && Number.isFinite(stop) && stopHit(side, stop, price)) {
      const cl = await scalperClosePosition(ex, marginMode);
      if (!cl.ok) {
        const err = cl.error ?? "Stop close failed";
        await updateRow({
          lastError: err,
          lastTickAt: new Date(),
          lastAction: `Stop hit @ ~${price}, but close failed: ${err}`,
        });
        return { ok: false, error: cl.error };
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
      const cl = await scalperClosePosition(ex, marginMode);
      if (!cl.ok) {
        const err = cl.error ?? "Exit close failed";
        await updateRow({
          lastError: err,
          lastTickAt: new Date(),
          lastAction: `Exit target @ ~${price}, but close failed: ${err}`,
        });
        return { ok: false, error: cl.error };
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

  const openOrders = await scalperGetOpenOrders(ex);
  const pendingHere = openOrders.filter((o) => sameInstId(o.instId, instId));
  if (pendingHere.length > 0) {
    await updateRow({
      lastRefPrice: price,
      lastTickAt: new Date(),
      lastError: null,
      lastAction: `Open/pending order(s) on ${instId}; skipping new entry until order(s) complete or cancel.`,
    });
    return { ok: true, message: "Pending orders on this contract; not opening another entry." };
  }

  if (row.stopLossPrice != null && Number.isFinite(row.stopLossPrice) && stopHit(side, row.stopLossPrice, price)) {
    await updateRow({
      lastRefPrice: price,
      lastTickAt: new Date(),
      lastError: null,
      lastAction: `Not entering — live ~${price} already through stop ${row.stopLossPrice}. Refresh the scalp plan.`,
    });
    return { ok: true, message: "Skipped entry; stop already hit." };
  }

  if (!shouldEnter(side, trigger, row.entryPrice, lastRef, price)) {
    await updateRow({ lastRefPrice: price, lastTickAt: new Date(), lastError: null });
    return { ok: true, message: "Flat; waiting for entry cross." };
  }

  const instRes = await scalperGetInstrument(ex);
  if (!instRes) {
    await updateRow({
      lastError: "No instrument",
      lastTickAt: new Date(),
      lastAction: `Entry cross detected, but could not load instrument ${instId}.`,
    });
    return { ok: false, error: "Could not load instrument." };
  }
  if (instRes.state && instRes.state !== "live") {
    const err = `${instId} is not live on ${ex.label} (${instRes.state}).`;
    await updateRow({
      lastError: err,
      lastTickAt: new Date(),
      lastAction: `Entry cross detected, but ${err}`,
    });
    return { ok: false, error: err };
  }
  const { leverage: lev, clampedFrom } = scalperClampLeverage(ex, row.leverage || 1, instRes.maxLeverage);
  const levNote =
    clampedFrom != null
      ? ` Leverage clamped ${clampedFrom}x → ${lev}x (${ex.label} max for ${instId}${instRes.assetClass ? ` · ${instRes.assetClass}` : ""}).`
      : "";

  let sizeStr: string;
  let amountBase: number | undefined;
  if (ex.exchange === "coinbase") {
    const contractSize = parseFloatSafe(instRes.contractValue) || 0.01;
    const minContracts = parseFloatSafe(instRes.minSize) || 1;
    const sized = computeCoinbaseSizeFromConfig({
      sizeMode: row.sizeMode === "contracts" ? "contracts" : "margin",
      sizeValue: row.positionSizeUsdt,
      leverage: lev,
      price,
      contractSize,
      minContracts,
      lotSize: parseFloatSafe(instRes.lotSize) || 1,
    });
    sizeStr = sized.sizeStr;
    amountBase = sized.amountBase;
    if (sized.contracts < minContracts) {
      const err = `Size below minimum (${minContracts} contracts). Increase contracts, margin, or leverage.`;
      await updateRow({
        lastError: err,
        lastTickAt: new Date(),
        lastAction: `Entry cross @ ~${price}, but order size too small: ${err}`,
      });
      return { ok: false, error: err };
    }
  } else {
    const contractValue = parseFloatSafe(instRes.contractValue);
    const minSize = parseFloatSafe(instRes.minSize);
    const lotSize = parseFloatSafe(instRes.lotSize) || minSize;
    if (contractValue <= 0) {
      await updateRow({
        lastError: "Invalid contract value",
        lastTickAt: new Date(),
        lastAction: `Entry cross detected, but ${instId} has an invalid contract value.`,
      });
      return { ok: false, error: "Invalid contract value." };
    }
    const notionalUsdt = row.positionSizeUsdt * lev;
    const sizeContracts = notionalUsdt / (price * contractValue);
    sizeStr = scalperRoundSize(ex, sizeContracts, minSize, lotSize);
    if (parseFloat(sizeStr) < minSize) {
      const err = `Size below minimum (${minSize} contracts). Increase margin or leverage.`;
      await updateRow({
        lastError: err,
        lastTickAt: new Date(),
        lastAction: `Entry cross @ ~${price}, but order size too small: ${err}`,
      });
      return { ok: false, error: err };
    }
  }

  const maxMarket = parseFloatSafe(instRes.maxMarketSize ?? "");
  if (maxMarket > 0 && parseFloat(sizeStr) > maxMarket) {
    const err = `Size ${sizeStr} exceeds max market size ${maxMarket} for ${instId}. Lower margin.`;
    await updateRow({
      lastError: err,
      lastTickAt: new Date(),
      lastAction: `Entry cross @ ~${price}, but ${err}`,
    });
    return { ok: false, error: err };
  }

  const levRes = await scalperSetLeverage(ex, lev, marginMode);
  if (!levRes.ok) {
    const err = levRes.error ?? "Set leverage failed";
    await updateRow({
      lastError: err,
      lastTickAt: new Date(),
      lastAction: `Entry cross @ ~${price} — set leverage ${lev}x failed: ${err}`,
    });
    return { ok: false, error: err };
  }
  const orderSide = side === "long" ? "buy" : "sell";
  const ord = await scalperPlaceMarketOrder(ex, orderSide, sizeStr, marginMode, { amountBase });
  if (!ord.ok) {
    const err = ord.error ?? "Order failed";
    await updateRow({
      lastError: err,
      lastTickAt: new Date(),
      lastRefPrice: price,
      entryTrigger: "immediate",
      lastAction: `Entry @ ~${price} — market ${orderSide} failed: ${err}${levNote} Next tick will retry at live.`,
    });
    return { ok: false, error: ord.error };
  }

  let fillPrice = price;
  try {
    const opened = await scalperGetPositions(ex);
    const avg = opened[0]?.avgPx ? parseFloatSafe(opened[0].avgPx) : 0;
    if (avg > 0) fillPrice = avg;
  } catch {
    /* ticker last is the fallback */
  }

  const tickSize = parseFloatSafe(instRes.tickSize ?? "");
  const slForFill = liveStopPrice(row, side, fillPrice, tickSize > 0 ? tickSize : null);
  const slTightened =
    slForFill != null &&
    row.stopLossPrice != null &&
    Number.isFinite(row.stopLossPrice) &&
    Math.abs(slForFill - row.stopLossPrice) > 1e-12;

  let tpslNote = "";
  if (row.attachTpsl) {
    const tpAbs = row.exitPrice > 0 ? row.exitPrice : null;
    const slAbs = slForFill;
    const tpPct = row.tpslTpPct ?? 0;
    const slPct = row.tpslSlPct ?? 0;
    if (tpAbs || slAbs || tpPct > 0 || slPct > 0) {
      const tpsl = await scalperPlaceTPSL(
        ex,
        orderSide,
        sizeStr,
        marginMode,
        fillPrice,
        // Prefer plan absolute levels; pct only fills gaps when abs missing.
        tpAbs ? 0 : tpPct,
        slAbs ? 0 : slPct,
        {
          tpTriggerPrice: tpAbs,
          slTriggerPrice: slAbs,
          amountBase,
        }
      );
      tpslNote = tpsl.ok
        ? ` TP/SL attached on ${ex.label}${slForFill != null ? ` (SL ${slForFill})` : ""}.`
        : ` TP/SL attach failed: ${tpsl.error ?? "unknown"} (soft exit via cron still active).`;
    }
  }

  const stopNote =
    slForFill != null
      ? ` or stop ${slForFill}${slTightened ? " (moved with fill to keep planned margin risk)" : ""}`
      : "";
  const afterOpen: Record<string, unknown> = {
    inPosition: true,
    lastRefPrice: fillPrice,
    lastTickAt: new Date(),
    lastError: tpslNote.includes("failed") ? tpslNote.trim() : null,
    lastAction: `Opened ${side} ${sizeStr} @ ~${fillPrice}.${levNote}${tpslNote} Will close at exit ${row.exitPrice}${stopNote}.`,
  };
  if (trigger === "immediate") {
    afterOpen.entryTrigger = side === "short" ? "cross_up" : "cross_down";
    afterOpen.lastAction = `${afterOpen.lastAction} Next entries need a price cross.`;
  }
  await updateRow(afterOpen);

  return { ok: true, message: `Entered ${side}. Monitoring exit/stop.` };
}

export async function resetNovaScalperState(
  userId: string,
  options?: {
    configId?: string;
    clearRounds?: boolean;
    clearInPosition?: boolean;
  }
): Promise<{ ok: boolean; error?: string }> {
  try {
    let row: { id: string } | null = null;
    if (options?.configId) {
      row = await db.novaScalperConfig.findFirst({ where: { id: options.configId, userId } });
    } else {
      row = await db.novaScalperConfig.findFirst({
        where: { userId },
        orderBy: { slot: "asc" },
      });
    }
    if (!row) return { ok: false, error: "No config. Open NovaScalper once to create it." };
    await db.novaScalperConfig.update({
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
