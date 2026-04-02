/**
 * NovaScalper: Blofin per-user repeatable entry → exit cycles (mark-price triggers).
 */

import { prisma } from "@/lib/db";
import {
  getTicker,
  getInstrument,
  getPositions,
  setLeverage,
  placeMarketOrder,
  closePositionViaApi,
  getConfig as getBlofinEnvConfig,
  type BlofinConfig,
} from "@/lib/blofin";
import { getBlofinConfigForUser } from "@/lib/blofin-user-config";

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

function toInstId(symbolRaw: string, marginCurrency: string): string {
  const raw = symbolRaw.trim().toUpperCase();
  if (!raw) return "";
  return raw.includes("/") ? raw.replace("/", "-") : `${raw}-${marginCurrency || "USDT"}`;
}

export async function resolveScalperBlofin(
  userId: string,
  mode: string,
  allowEnvFallback: boolean
): Promise<{ config: BlofinConfig; demo: boolean } | null> {
  const isDemo = mode !== "live";
  const userCfg = await getBlofinConfigForUser(userId);
  if (userCfg) {
    return { config: userCfg, demo: isDemo };
  }
  if (allowEnvFallback) {
    const env = getBlofinEnvConfig();
    if (env) return { config: env, demo: isDemo };
  }
  return null;
}

type ScalperRow = {
  id: string;
  userId: string;
  symbol: string;
  marginCurrency: string;
  marginMode: string;
  side: string;
  openWhen: string;
  entryPrice: number;
  exitPrice: number;
  stopLossPrice: number | null;
  marginUsdt: number;
  leverage: number;
  mode: string;
  enabled: boolean;
  runState: string;
  cyclesCompleted: number;
};

export async function runNovaScalperTick(
  userId: string,
  options?: { allowEnvFallback?: boolean }
): Promise<{ ok: boolean; message?: string; error?: string; action?: string }> {
  const allowEnvFallback = options?.allowEnvFallback === true;

  let scalper: ScalperRow | null = null;
  try {
    scalper = await db.novaScalperConfig.findUnique({ where: { userId } });
  } catch {
    return { ok: false, error: "Failed to load NovaScalper config." };
  }
  if (!scalper || !scalper.enabled) {
    return { ok: true, message: "NovaScalper is off.", action: "idle" };
  }

  const blofin = await resolveScalperBlofin(userId, scalper.mode, allowEnvFallback);
  if (!blofin) {
    const msg = allowEnvFallback
      ? "Blofin keys missing. Add keys in Trading Bot (Blofin) or set server env."
      : "Blofin keys not configured for your account. Save API keys under Trading Bot.";
    await db.novaScalperConfig.update({
      where: { id: scalper.id },
      data: { lastError: msg, lastTickAt: new Date() },
    });
    return { ok: false, error: msg };
  }

  const instId = toInstId(scalper.symbol, scalper.marginCurrency ?? "USDT");
  if (!instId) {
    return { ok: false, error: "Invalid symbol." };
  }

  const marginMode = (scalper.marginMode === "isolated" ? "isolated" : "cross") as "isolated" | "cross";
  const side = scalper.side === "short" ? "short" : "long";
  const openWhen = scalper.openWhen === "gte" ? "gte" : "lte";
  const blofinOpts = { demo: blofin.demo, config: blofin.config };

  const ticker = await getTicker(instId, blofin.demo, { config: blofin.config });
  const mark = ticker?.last ? parseFloatSafe(ticker.last) : 0;
  if (mark <= 0) {
    await db.novaScalperConfig.update({
      where: { id: scalper.id },
      data: { lastError: "Could not read mark price.", lastTickAt: new Date() },
    });
    return { ok: false, error: "Could not read mark price." };
  }

  let positions = await getPositions(instId, blofinOpts);
  const hasPos = positions.some((p) => Math.abs(parseFloatSafe(String(p.pos ?? "0"))) > 0);
  let runState = scalper.runState;

  if (runState === "in_position" && !hasPos) {
    runState = "flat";
    await db.novaScalperConfig.update({
      where: { id: scalper.id },
      data: {
        runState: "flat",
        lastActionMsg: "Position closed (exchange flat); ready for next cycle.",
        lastError: null,
        lastMark: mark,
        lastTickAt: new Date(),
      },
    });
    return { ok: true, message: "Synced: was in_position but exchange flat.", action: "sync_flat" };
  }

  if (runState === "flat" && hasPos) {
    await db.novaScalperConfig.update({
      where: { id: scalper.id },
      data: { runState: "in_position", lastError: null, lastMark: mark, lastTickAt: new Date() },
    });
    runState = "in_position";
  }

  const inst = await getInstrument(instId, blofinOpts);
  if (!inst) {
    await db.novaScalperConfig.update({
      where: { id: scalper.id },
      data: { lastError: "Instrument not found.", lastTickAt: new Date(), lastMark: mark },
    });
    return { ok: false, error: "Instrument not found." };
  }
  const contractValue = parseFloatSafe(inst.contractValue);
  const minSize = parseFloatSafe(inst.minSize);
  if (contractValue <= 0) {
    return { ok: false, error: "Invalid contract." };
  }

  const lev = Math.min(125, Math.max(1, scalper.leverage ?? 10));
  const marginUsdt = Math.max(1, scalper.marginUsdt ?? 50);
  const notionalUsdt = marginUsdt * lev;
  const sizeContracts = notionalUsdt / (mark * contractValue);
  const sizeStr = roundSize(sizeContracts, minSize, minSize);
  if (parseFloat(sizeStr) < minSize) {
    await db.novaScalperConfig.update({
      where: { id: scalper.id },
      data: {
        lastError: `Size below minimum (${minSize} contracts). Increase margin or leverage.`,
        lastTickAt: new Date(),
        lastMark: mark,
      },
    });
    return { ok: false, error: `Size below minimum (${minSize}).` };
  }

  const entry = scalper.entryPrice;
  const exitP = scalper.exitPrice;
  const sl = scalper.stopLossPrice;

  const shouldOpen =
    runState === "flat" &&
    !hasPos &&
    (side === "long"
      ? openWhen === "lte"
        ? mark <= entry
        : mark >= entry
      : openWhen === "lte"
        ? mark <= entry
        : mark >= entry);

  if (shouldOpen) {
    await setLeverage(instId, lev, marginMode, blofinOpts);
    const orderSide = side === "long" ? "buy" : "sell";
    const order = await placeMarketOrder(instId, orderSide, sizeStr, marginMode, {
      ...blofinOpts,
      reduceOnly: false,
    });
    if (!order.ok) {
      await db.novaScalperConfig.update({
        where: { id: scalper.id },
        data: { lastError: order.error ?? "Open failed", lastTickAt: new Date(), lastMark: mark },
      });
      return { ok: false, error: order.error ?? "Open failed" };
    }
    await db.novaScalperConfig.update({
      where: { id: scalper.id },
      data: {
        runState: "in_position",
        lastError: null,
        lastMark: mark,
        lastTickAt: new Date(),
        lastActionAt: new Date(),
        lastActionMsg: `Opened ${side} ${sizeStr} @ ~${mark} (entry ${entry}).`,
      },
    });
    return { ok: true, message: `Opened ${side}.`, action: "open" };
  }

  if (runState === "in_position" && hasPos) {
    const hitTp =
      side === "long" ? mark >= exitP : mark <= exitP;
    const hitSl =
      sl != null && Number.isFinite(sl) && (side === "long" ? mark <= sl : mark >= sl);

    if (hitSl || hitTp) {
      const rawPosSide = (positions[0] as { rawPositionSide?: string })?.rawPositionSide?.toLowerCase();
      const posSide = (rawPosSide === "net" ? "net" : positions[0]?.posSide === "short" ? "short" : "long") as
        | "long"
        | "short"
        | "net";
      const closeResult = await closePositionViaApi(instId, marginMode, posSide, blofinOpts);
      if (!closeResult.ok) {
        await db.novaScalperConfig.update({
          where: { id: scalper.id },
          data: { lastError: closeResult.error ?? "Close failed", lastTickAt: new Date(), lastMark: mark },
        });
        return { ok: false, error: closeResult.error ?? "Close failed" };
      }
      const cycles = (scalper.cyclesCompleted ?? 0) + 1;
      await db.novaScalperConfig.update({
        where: { id: scalper.id },
        data: {
          runState: "flat",
          cyclesCompleted: cycles,
          lastError: null,
          lastMark: mark,
          lastTickAt: new Date(),
          lastActionAt: new Date(),
          lastActionMsg: hitSl
            ? `Closed on stop (~${mark}). Cycle #${cycles}.`
            : `Closed on exit (~${mark}). Cycle #${cycles}.`,
        },
      });
      return {
        ok: true,
        message: hitSl ? "Closed (stop loss)." : "Closed (take exit).",
        action: hitSl ? "close_sl" : "close_tp",
      };
    }
  }

  await db.novaScalperConfig.update({
    where: { id: scalper.id },
    data: { lastMark: mark, lastTickAt: new Date(), lastError: null },
  });
  return { ok: true, message: "No action.", action: "hold" };
}
