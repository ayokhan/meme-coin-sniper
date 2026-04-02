/**
 * NovaScalper: Blofin perps — enter at entry price (cross), exit by closing position at exit price (or optional stop).
 * Repeats when flat up to maxRounds (0 = unlimited). Uses same margin sizing as AI bot: notional = positionSizeUsdt × leverage.
 */

import { prisma } from "@/lib/db";
import {
  getTicker,
  getInstrument,
  getPositions,
  getOpenOrders,
  setLeverage,
  placeMarketOrder,
  placeTPSLOrder,
  closePositionViaApi,
  getConfig as getBlofinEnvConfig,
  type BlofinConfig,
} from "@/lib/blofin";
import { getBlofinConfigForUser } from "@/lib/blofin-user-config";
import { parseScalperInstrument } from "@/lib/nova-scalper-instrument";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

function parseFloatSafe(s: string): number {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function roundSize(size: number, minSize: number, lotSize: number): string {
  const step = Math.max(lotSize, minSize);
  const n = Math.max(minSize, Math.floor(size / step) * step);
  return n.toFixed(1);
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

/** Match Blofin instId variants (BTC-USDT vs BTC/USDT). */
function sameInstId(a: string, b: string): boolean {
  const norm = (s: string) => (s || "").replace(/[-/]/g, "").toUpperCase();
  return norm(a) === norm(b);
}

export async function runNovaScalperTick(userId: string): Promise<{ ok: boolean; message?: string; error?: string }> {
  if (!userId) {
    return { ok: false, error: "Sign in required to run NovaScalper." };
  }

  let row: ScalperRow | null = null;
  try {
    row = await db.novaScalperConfig.findFirst({ where: { userId } });
  } catch {
    return { ok: false, error: "NovaScalper table missing. Run prisma db push." };
  }

  if (!row || !row.enabled) {
    return { ok: true, message: "NovaScalper is off or save your config first." };
  }

  let blofinConfig: BlofinConfig | null = null;
  if (userId) blofinConfig = await getBlofinConfigForUser(userId);
  if (!blofinConfig) blofinConfig = getBlofinEnvConfig();
  if (!blofinConfig) {
    return {
      ok: false,
      error: userId
        ? "Blofin API keys missing. Save keys under Trading Bot or set server env."
        : "Blofin API keys not set for server run.",
    };
  }

  const isDemo = row.mode === "demo";
  const blofinOpts = { demo: isDemo, config: blofinConfig };
  const marginMode = (row.marginMode === "isolated" ? "isolated" : "cross") as "isolated" | "cross";
  const { instId, base } = parseScalperInstrument(row.symbol, row.marginCurrency ?? "USDT");
  if (!base || !instId) {
    return { ok: false, error: "Invalid instrument. Save BTC/USDT or BTC/USDC (or base + margin) in NovaScalper." };
  }
  const side = row.side === "short" ? "short" : "long";

  if (side === "long" && row.exitPrice <= row.entryPrice) {
    return { ok: false, error: "Long: exit price should be above entry price." };
  }
  if (side === "short" && row.exitPrice >= row.entryPrice) {
    return { ok: false, error: "Short: exit price should be below entry price." };
  }

  const ticker = await getTicker(instId, isDemo, { config: blofinConfig });
  const price = ticker?.last ? parseFloatSafe(ticker.last) : 0;
  if (!Number.isFinite(price) || price <= 0) {
    await db.novaScalperConfig.update({
      where: { id: row.id },
      data: { lastError: "No price", lastTickAt: new Date() },
    });
    return { ok: false, error: "Could not read last price." };
  }

  const positions = await getPositions(instId, blofinOpts);
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

  const trigger = row.entryTrigger === "cross_up" ? "cross_up" : "cross_down";

  if (row.inPosition || hasExchangePosition) {
    if (row.stopLossPrice != null && Number.isFinite(row.stopLossPrice) && stopHit(side, row.stopLossPrice, price)) {
      const cl = await closePositionViaApi(instId, marginMode, "net", blofinOpts);
      if (!cl.ok) {
        await updateRow({ lastError: cl.error ?? "Stop close failed", lastTickAt: new Date() });
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
      const cl = await closePositionViaApi(instId, marginMode, "net", blofinOpts);
      if (!cl.ok) {
        await updateRow({ lastError: cl.error ?? "Exit close failed", lastTickAt: new Date() });
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

  const openOrders = await getOpenOrders({ demo: isDemo, instId, limit: 50, config: blofinConfig });
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

  if (!shouldEnter(side, trigger, row.entryPrice, lastRef, price)) {
    await updateRow({ lastRefPrice: price, lastTickAt: new Date(), lastError: null });
    return { ok: true, message: "Flat; waiting for entry cross." };
  }

  const instRes = await getInstrument(instId, { demo: isDemo, config: blofinConfig });
  if (!instRes) {
    await updateRow({ lastError: "No instrument", lastTickAt: new Date() });
    return { ok: false, error: "Could not load instrument." };
  }
  const contractValue = parseFloatSafe(instRes.contractValue);
  const minSize = parseFloatSafe(instRes.minSize);
  const lotSize = minSize;
  if (contractValue <= 0) {
    return { ok: false, error: "Invalid contract value." };
  }

  const lev = Math.max(1, Math.min(125, row.leverage || 1));
  const notionalUsdt = row.positionSizeUsdt * lev;
  const sizeContracts = notionalUsdt / (price * contractValue);
  const sizeStr = roundSize(sizeContracts, minSize, lotSize);
  if (parseFloat(sizeStr) < minSize) {
    return { ok: false, error: `Size below minimum (${minSize} contracts). Increase margin or leverage.` };
  }

  await setLeverage(instId, lev, marginMode, blofinOpts);
  const orderSide = side === "long" ? "buy" : "sell";
  const ord = await placeMarketOrder(instId, orderSide, sizeStr, marginMode, blofinOpts);
  if (!ord.ok) {
    await updateRow({ lastError: ord.error ?? "Order failed", lastTickAt: new Date() });
    return { ok: false, error: ord.error };
  }

  let tpslNote = "";
  if (row.attachTpsl && (row.tpslTpPct ?? 0) > 0 && (row.tpslSlPct ?? 0) > 0) {
    const tpsl = await placeTPSLOrder(
      instId,
      orderSide,
      sizeStr,
      marginMode,
      price,
      row.tpslTpPct ?? 2,
      row.tpslSlPct ?? 1,
      blofinOpts
    );
    tpslNote = tpsl.ok ? " TP/SL attach attempted." : ` TP/SL skipped: ${tpsl.error ?? ""}`;
  }

  await updateRow({
    inPosition: true,
    lastRefPrice: price,
    lastTickAt: new Date(),
    lastError: null,
    lastAction: `Opened ${side} ${sizeStr} @ ~${price}.${tpslNote} Will close at exit ${row.exitPrice} or stop.`,
  });

  return { ok: true, message: `Entered ${side}. Monitoring exit/stop.` };
}

export async function resetNovaScalperState(
  userId: string,
  options?: {
    clearRounds?: boolean;
    clearInPosition?: boolean;
  }
): Promise<{ ok: boolean; error?: string }> {
  try {
    const row = await db.novaScalperConfig.findFirst({ where: { userId } });
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
