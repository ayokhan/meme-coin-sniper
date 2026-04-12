/**
 * Run one cycle of the trading bot: load config, fetch candles, signal (simple | indicators | ai | hybrid), place order if needed.
 * Blofin only.
 */

import { prisma } from "@/lib/db";
import {
  getCandles as getCandlesBlofin,
  getTicker as getTickerBlofin,
  getInstrument as getInstrumentBlofin,
  getPositions as getPositionsBlofin,
  setLeverage as setLeverageBlofin,
  placeMarketOrder as placeMarketOrderBlofin,
  placeLimitOrder as placeLimitOrderBlofin,
  placeTPSLOrder as placeTPSLOrderBlofin,
  closePositionViaApi as closePositionViaApiBlofin,
  toBlofinBar,
  isBlofinConfigured,
  getConfig as getBlofinEnvConfig,
  type Candle,
  type BlofinConfig,
} from "@/lib/blofin";
import { getBlofinConfigForUser } from "@/lib/blofin-user-config";
import { indicatorsSignal, maCrossoverSignal, candlePatternSignal, findSupportResistance, ema, rsi } from "@/lib/trading-bot-ta";
import { getAITradingSignal, getAIDeepPositionReview, getAIOpenPositionTactic } from "@/lib/ai-trading-signal";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

function parseFloatSafe(s: string): number {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/** Simple signal: last close vs previous close. */
function simpleSignal(candles: Candle[]): "long" | "short" | null {
  if (candles.length < 2) return null;
  const last = parseFloatSafe(candles[0][4]);
  const prev = parseFloatSafe(candles[1][4]);
  if (last > prev) return "long";
  if (last < prev) return "short";
  return null;
}

/** Resolve signal from strategy: simple | indicators | ai | hybrid. */
async function resolveSignal(
  strategy: string,
  candles: Candle[],
  currentPrice: number,
  symbol: string,
  timeframe: string,
  emaPeriod: number,
  fastMA: number,
  slowMA: number,
  rsiPeriod: number
): Promise<{ signal: "long" | "short" | null; message?: string }> {
  if (strategy === "simple") {
    const s = simpleSignal(candles);
    return { signal: s ?? null };
  }

  const closes = candles.map((c) => parseFloatSafe(c[4])).filter((c) => c > 0);

  if (strategy === "indicators") {
    const { signal, score, reasons } = indicatorsSignal(candles, currentPrice, {
      emaPeriod,
      fastMA,
      slowMA,
      rsiPeriod,
      requireConfluence: true,
    });
    return { signal, message: reasons.length ? `${score}%: ${reasons.slice(0, 3).join("; ")}` : undefined };
  }

  if (strategy === "ai") {
    const emaVal = ema(closes, emaPeriod);
    const rsiVal = rsi(closes, rsiPeriod);
    const { support, resistance } = findSupportResistance(candles, 8);
    const maCross = maCrossoverSignal(closes, fastMA, slowMA);
    const candlePat = candlePatternSignal(candles);
    const summary = {
      symbol,
      timeframe,
      lastCloses: closes,
      currentPrice,
      ema200: emaVal,
      rsi: rsiVal,
      supportLevels: support,
      resistanceLevels: resistance,
      maCrossover: maCross,
      candlePattern: candlePat ? (candlePat === "long" ? "bullish engulfing" : "bearish engulfing") : null,
    };
    const ai = await getAITradingSignal(summary);
    if (ai.signal === "no_buy") return { signal: null, message: ai.reason };
    return { signal: ai.signal, message: ai.reason };
  }

  if (strategy === "hybrid") {
    const { signal: indSignal, score: indScore, reasons } = indicatorsSignal(candles, currentPrice, { emaPeriod, fastMA, slowMA, rsiPeriod, requireConfluence: true });
    const emaVal = ema(closes, emaPeriod);
    const rsiVal = rsi(closes, rsiPeriod);
    const { support, resistance } = findSupportResistance(candles, 8);
    const maCross = maCrossoverSignal(closes, fastMA, slowMA);
    const candlePat = candlePatternSignal(candles);
    const ai = await getAITradingSignal({
      symbol,
      timeframe,
      lastCloses: closes,
      currentPrice,
      ema200: emaVal,
      rsi: rsiVal,
      supportLevels: support,
      resistanceLevels: resistance,
      maCrossover: maCross,
      candlePattern: candlePat ? (candlePat === "long" ? "bullish engulfing" : "bearish engulfing") : null,
    });
    if (indSignal && ai.signal !== "no_buy" && indSignal === ai.signal) {
      return { signal: indSignal, message: `TA(${indScore}) + AI agree: ${ai.reason}` };
    }
    return { signal: null, message: "TA and AI did not agree" };
  }

  return { signal: simpleSignal(candles), message: undefined };
}

/** Round size to minSize and lotSize (e.g. 0.1 step). */
function roundSize(size: number, minSize: number, lotSize: number): string {
  const step = Math.max(lotSize, minSize);
  const n = Math.max(minSize, Math.floor(size / step) * step);
  return n.toFixed(1);
}

export async function runTradingBotCycle(
  userId?: string,
  runOpts?: { envFallbackForOwner?: boolean }
): Promise<{ ok: boolean; message?: string; error?: string }> {
  let bot: {
    id: string;
    provider: string;
    symbol: string;
    timeframe: string;
    leverage: number;
    tpPct: number;
    slPct: number;
    mode: string;
    marginCurrency: string;
    positionSizeUsdt: number;
    strategy: string;
    emaPeriod: number;
    fastMA: number;
    slowMA: number;
    rsiPeriod: number;
  } | null = null;
  try {
    bot = await db.tradingBot.findFirst({ where: { enabled: true }, orderBy: { updatedAt: "desc" } });
  } catch (e) {
    return { ok: false, error: "Failed to load config" };
  }

  if (!bot) {
    return { ok: true, message: "No enabled bot" };
  }

  const provider = (bot.provider ?? "blofin").toLowerCase();
  if (provider !== "blofin") {
    return { ok: false, error: "Only Blofin is supported. Set provider to Blofin in config." };
  }
  let blofinConfig: BlofinConfig | null = null;
  if (userId) {
    blofinConfig = await getBlofinConfigForUser(userId);
  }
  // Server env keys: cron (no userId), or explicit owner fallback — never for customers / VIP.
  if (!blofinConfig && userId && runOpts?.envFallbackForOwner) {
    blofinConfig = getBlofinEnvConfig();
  }
  if (!blofinConfig && !userId) {
    blofinConfig = getBlofinEnvConfig();
  }
  if (!blofinConfig) {
    if (userId) {
      return { ok: false, error: "Your Blofin API keys are not set. Add your keys in Trading Bot settings." };
    }
    return { ok: false, error: "Blofin API keys not set. Set BLOFIN_API_KEY, BLOFIN_SECRET_KEY, BLOFIN_PASSPHRASE in your server env (e.g. Vercel)." };
  }
  const isDemo = bot.mode === "demo";
  const blofinOpts = { demo: isDemo, config: blofinConfig };

  const rawSymbol = (bot.symbol ?? "").trim().toUpperCase();
  if (!rawSymbol) {
    return { ok: false, error: "Symbol is required (e.g. BTC or BTC/USDT)." };
  }
  const instId = rawSymbol.includes("/")
    ? rawSymbol.replace("/", "-")
    : `${rawSymbol}-${bot.marginCurrency ?? "USDT"}`;
  const bar = toBlofinBar(bot.timeframe);
  const strategy = bot.strategy ?? "simple";
  const needMoreCandles = strategy === "indicators" || strategy === "ai" || strategy === "hybrid";
  const candleLimit = needMoreCandles ? 250 : 50;

  const getCandles = getCandlesBlofin;
  const getTicker = getTickerBlofin;
  const getInstrument = getInstrumentBlofin;
  const getPositions = getPositionsBlofin;
  const setLeverage = setLeverageBlofin;
  const placeMarketOrder = placeMarketOrderBlofin;

  const updateLastRun = async (
    err: string | null,
    decision?: "no_trade" | "long" | "short",
    decisionMsg?: string,
    decisionReason?: string
  ) => {
    try {
      await db.tradingBot.update({
        where: { id: bot!.id },
        data: {
          lastRunAt: new Date(),
          lastError: err,
          lastDecision: decision ?? null,
          lastDecisionMsg: decisionMsg ?? null,
          lastDecisionReason: decisionReason ?? null,
        },
      });
    } catch {
      // ignore
    }
  };

  try {
    const [candlesRes, tickerRes, instRes, positionsRes] = await Promise.all([
      getCandles(instId, bar, candleLimit, isDemo, blofinOpts),
      getTicker(instId, isDemo, blofinOpts),
      getInstrument(instId, blofinOpts),
      getPositions(instId, blofinOpts),
    ]);

    const minCandles = needMoreCandles ? Math.max(2, (bot.emaPeriod ?? 200) + 5) : 2;
    if (candlesRes.length < minCandles) {
      const msg = `Not enough candle data (got ${candlesRes.length}, need ${minCandles}). Use symbol like BTC or BTC-USDT, and a shorter timeframe (e.g. 15m) if needed.`;
      await updateLastRun(msg, "no_trade", msg);
      return { ok: false, error: msg };
    }

    const lastPrice = tickerRes?.last ? parseFloatSafe(tickerRes.last) : parseFloatSafe(candlesRes[0][4]);
    if (lastPrice <= 0) {
      await updateLastRun("Could not get price", "no_trade", "Could not get price");
      return { ok: false, error: "Could not get price" };
    }

    const positions = positionsRes ?? [];
    const hasPosition = positions.length > 0;

    if (hasPosition) {
      await updateLastRun(null, "no_trade", "Already in position, skip");
      return { ok: true, message: "Already in position, skip" };
    }

    const resolved = await resolveSignal(
      strategy,
      candlesRes,
      lastPrice,
      bot.symbol,
      bot.timeframe,
      bot.emaPeriod ?? 200,
      bot.fastMA ?? 9,
      bot.slowMA ?? 21,
      bot.rsiPeriod ?? 14
    );
    const signal = resolved.signal;
    if (!signal) {
      const msg = resolved.message ?? "No signal";
      await updateLastRun(null, "no_trade", msg);
      return { ok: true, message: msg };
    }

    if (!instRes) {
      await updateLastRun("Could not get instrument", "no_trade", "Could not get instrument");
      return { ok: false, error: "Could not get instrument" };
    }

    const contractValue = parseFloatSafe(instRes.contractValue);
    const minSize = parseFloatSafe(instRes.minSize);
    if (contractValue <= 0) {
      await updateLastRun("Invalid contract value", "no_trade", "Invalid contract value");
      return { ok: false, error: "Invalid contract value" };
    }

    // Position size in config = margin (USDT). Notional = margin × leverage so exchange margin matches.
    const notionalUsdt = bot.positionSizeUsdt * (bot.leverage ?? 1);
    const sizeContracts = notionalUsdt / (lastPrice * contractValue);
    const lotSize = parseFloatSafe(instRes.minSize);
    const sizeStr = roundSize(sizeContracts, minSize, lotSize);
    if (parseFloat(sizeStr) < minSize) {
      const err = `Position size below minimum (min ${minSize} contracts)`;
      await updateLastRun(err, "no_trade", err);
      return { ok: false, error: err };
    }

    const marginMode = ((bot as { marginMode?: string }).marginMode ?? "cross") as "isolated" | "cross";
    const leverageOk = await setLeverage(instId, bot.leverage, marginMode, { demo: isDemo, config: blofinConfig });
    if (!leverageOk.ok) {
      console.warn("setLeverage:", leverageOk.error);
      // continue anyway
    }

    const side = signal === "long" ? "buy" : "sell";
    const order = await placeMarketOrder(instId, side, sizeStr, marginMode, blofinOpts);
    if (!order.ok) {
      const err = order.error ?? "Order failed";
      await updateLastRun(err, "no_trade", err);
      return { ok: false, error: order.error };
    }

    const successMsg = `Opened ${signal} ${sizeStr} @ ${lastPrice}`;
    await updateLastRun(null, signal, successMsg, resolved.message ?? undefined);

    if (bot.tpPct > 0 || bot.slPct > 0) {
      const tpsl = await placeTPSLOrderBlofin(
        instId,
        side,
        sizeStr,
        marginMode,
        lastPrice,
        bot.tpPct,
        bot.slPct,
        blofinOpts
      );
      if (!tpsl.ok) console.warn("TP/SL order failed:", tpsl.error);
    }

    return { ok: true, message: successMsg };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    await updateLastRun(err, "no_trade", err);
    return { ok: false, error: err };
  }
}

/**
 * Close open position(s). If closeInstId is set, close only that symbol (optionally filtered by posSide); if closeAll is true, close all positions; otherwise close bot's symbol. Owner-only.
 * Uses Blofin dedicated close-position API when possible.
 */
export async function closeTradingBotPosition(options?: {
  closeInstId?: string;
  closeAll?: boolean;
  posSide?: "long" | "short" | "net";
  blofinConfig: BlofinConfig;
}): Promise<{ ok: boolean; message?: string; error?: string }> {
  const closeInstId = options?.closeInstId?.trim();
  const closeAll = options?.closeAll === true;
  const filterPosSide = options?.posSide;
  const blofinConfig = options?.blofinConfig;
  if (!blofinConfig) return { ok: false, error: "Blofin config missing." };

  const bot = await db.tradingBot.findFirst({ orderBy: { updatedAt: "desc" } });
  if (!bot) return { ok: false, error: "No bot config." };

  const isDemo = blofinConfig.demo;
  const marginMode = ((bot as { marginMode?: string }).marginMode ?? "cross") as "isolated" | "cross";
  const blofinOpts = { demo: isDemo, config: blofinConfig };

  let positions = closeAll
    ? await getPositionsBlofin(undefined, blofinOpts)
    : await getPositionsBlofin(
        closeInstId
          ? closeInstId.replace("/", "-")
          : (() => {
              const rawSymbol = (bot.symbol ?? "").trim().toUpperCase();
              if (!rawSymbol) return undefined;
              return rawSymbol.includes("/")
                ? rawSymbol.replace("/", "-")
                : `${rawSymbol}-${bot.marginCurrency ?? "USDT"}`;
            })(),
        blofinOpts
      );

  if (filterPosSide) {
    positions = positions.filter((p) => {
      const rawPosSide = (p as { rawPositionSide?: string }).rawPositionSide?.toLowerCase();
      const pSide = rawPosSide === "net" ? "net" : (p.posSide === "long" || p.posSide === "short" ? p.posSide : "net");
      return pSide === filterPosSide;
    });
  }

  if (!positions.length) {
    return {
      ok: false,
      error: closeAll
        ? "No open positions. Check Bot Mode (Demo/Live) and Blofin API permissions."
        : "No open position found for this symbol. Check: (1) Bot Mode is Live if the position is on live Blofin. (2) Your Blofin API key has permission to read positions. (3) Symbol matches (e.g. BTC/USDT → BTC-USDT).",
    };
  }

  for (const pos of positions) {
    const rawSize = String(pos.pos ?? "0").trim();
    const sizeNum = Math.abs(parseFloat(rawSize));
    if (sizeNum <= 0 || !Number.isFinite(sizeNum)) continue;
    const instId = (pos.instId ?? "").trim() || closeInstId;
    if (!instId) continue;
    // Blofin one-way mode returns positionSide "net"; close-position API expects "net" in that case, not long/short.
    const rawPosSide = (pos as { rawPositionSide?: string }).rawPositionSide?.toLowerCase();
    const positionSide = (rawPosSide === "net" ? "net" : (pos.posSide === "long" || pos.posSide === "short" ? pos.posSide : "net")) as "long" | "short" | "net";
    let result = await closePositionViaApiBlofin(instId, marginMode, positionSide, blofinOpts);
    if (!result.ok && positionSide !== "net") {
      const errMsg = (result.error ?? "").toLowerCase();
      if (errMsg.includes("closed") || errMsg.includes("position")) {
        result = await closePositionViaApiBlofin(instId, marginMode, "net", blofinOpts);
      }
    }
    if (!result.ok) {
      return { ok: false, error: result.error ?? "Failed to close position." };
    }
  }
  return { ok: true, message: positions.length > 1 ? `${positions.length} positions closed.` : "Position closed." };
}

/**
 * Place a limit order at the given entry price (e.g. from NovaStaris AI suggested entry).
 * Uses bot config for symbol, size, margin mode, demo/live.
 */
export async function placeLimitOrderTradingBot(options: {
  price: number;
  side: "long" | "short";
  blofinConfig: BlofinConfig;
}): Promise<{ ok: boolean; orderId?: string; message?: string; error?: string }> {
  const blofinConfig = options.blofinConfig;
  const bot = await db.tradingBot.findFirst({ orderBy: { updatedAt: "desc" } });
  if (!bot) return { ok: false, error: "No bot config." };
  const rawSymbol = (bot.symbol ?? "").trim().toUpperCase();
  if (!rawSymbol) return { ok: false, error: "Symbol required." };
  const instId = rawSymbol.includes("/") ? rawSymbol.replace("/", "-") : `${rawSymbol}-${bot.marginCurrency ?? "USDT"}`;
  const isDemo = blofinConfig.demo;
  const blofinOpts = { demo: isDemo, config: blofinConfig };
  const marginMode = ((bot as { marginMode?: string }).marginMode ?? "cross") as "isolated" | "cross";
  const instRes = await getInstrumentBlofin(instId, blofinOpts);
  if (!instRes) return { ok: false, error: "Could not get instrument." };
  const contractValue = parseFloatSafe(instRes.contractValue);
  const minSize = parseFloatSafe(instRes.minSize);
  if (contractValue <= 0) return { ok: false, error: "Invalid contract value." };
  const notionalUsdt = bot.positionSizeUsdt * (bot.leverage ?? 1);
  const sizeContracts = notionalUsdt / (options.price * contractValue);
  const sizeStr = roundSize(sizeContracts, minSize, minSize);
  if (parseFloat(sizeStr) < minSize) return { ok: false, error: `Size below minimum (${minSize} contracts).` };
  await setLeverageBlofin(instId, bot.leverage, marginMode, blofinOpts);
  const side = options.side === "long" ? "buy" : "sell";
  const result = await placeLimitOrderBlofin(instId, side, sizeStr, String(options.price), marginMode, blofinOpts);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, orderId: result.orderId, message: `Limit ${options.side} ${sizeStr} @ ${options.price} placed.` };
}

export type SuggestedClose = { instId: string; posSide: "long" | "short" | "net"; reason: string };

/** Blofin bars allowed for Deep check (multi-hour and longer). */
const DEEP_ALLOWED_BLOFIN_BARS = new Set(["15m", "30m", "1H", "2H", "4H", "6H", "8H", "12H", "1D", "3D", "1W", "1M"]);

function normalizeDeepBar(raw: string): string | null {
  const b = toBlofinBar(raw.trim());
  return DEEP_ALLOWED_BLOFIN_BARS.has(b) ? b : null;
}

/** Default 4H + 1D; persisted JSON is `["4H","1D"]` Blofin bar strings. */
export function parseMonitorDeepTimeframesJson(json: string | null | undefined): [string, string] {
  const fallback: [string, string] = ["4H", "1D"];
  if (!json?.trim()) return fallback;
  try {
    const arr = JSON.parse(json) as unknown;
    if (!Array.isArray(arr) || arr.length < 2) return fallback;
    const a = normalizeDeepBar(String(arr[0]));
    const b = normalizeDeepBar(String(arr[1]));
    if (!a || !b) return fallback;
    return [a, b];
  } catch {
    return fallback;
  }
}

/** Persist two UI timeframe picks as JSON; returns null if either is not allowed for Deep check. */
export function serializeMonitorDeepTimeframes(first: string, second: string): string | null {
  const a = normalizeDeepBar(first);
  const b = normalizeDeepBar(second);
  if (!a || !b) return null;
  return JSON.stringify([a, b]);
}

function candleLimitForDeepBar(bar: string): number {
  if (bar === "1M") return 36;
  if (bar === "1W") return 52;
  if (bar === "3D") return 60;
  if (bar === "1D") return 90;
  if (bar === "12H" || bar === "8H" || bar === "6H") return 90;
  if (bar === "4H" || bar === "2H") return 120;
  if (bar === "1H") return 150;
  if (bar === "30m" || bar === "15m") return 180;
  return 120;
}

function normalizeInstIdToKey(raw: string): string {
  return raw.trim().toUpperCase().replace(/\//g, "-");
}

/** Parse inner object instId → positive number (TP price or USDT profit target). */
function parseSymbolNumberMap(obj: Record<string, unknown> | null | undefined): Record<string, number> {
  if (!obj || typeof obj !== "object") return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = normalizeInstIdToKey(k);
    const n = typeof v === "number" ? v : parseFloat(String(v));
    if (key && Number.isFinite(n) && n > 0) out[key] = n;
  }
  return out;
}

/**
 * Parse saved JSON: legacy flat `{ "ETH-USDT": 2080 }` or bundle
 * `{ "prices": { ... }, "amountsQuote": { ... } }` (optional USDT profit targets for AI).
 */
export function parseMonitorTpTargetsJson(json: string | null | undefined): Record<string, number> {
  if (!json || typeof json !== "string" || !json.trim()) return {};
  try {
    const o = JSON.parse(json) as Record<string, unknown>;
    if (o && typeof o === "object" && !Array.isArray(o) && o.prices != null && typeof o.prices === "object" && !Array.isArray(o.prices)) {
      return parseSymbolNumberMap(o.prices as Record<string, unknown>);
    }
    return parseSymbolNumberMap(o);
  } catch {
    return {};
  }
}

/** Optional per-symbol unrealized-PnL targets in quote (e.g. USDT) for AI monitor / Deep. */
export function parseMonitorTpAmountsJson(json: string | null | undefined): Record<string, number> {
  if (!json || typeof json !== "string" || !json.trim()) return {};
  try {
    const o = JSON.parse(json) as Record<string, unknown>;
    if (!o || typeof o !== "object" || Array.isArray(o)) return {};
    const raw =
      o.amountsQuote != null && typeof o.amountsQuote === "object" && !Array.isArray(o.amountsQuote)
        ? (o.amountsQuote as Record<string, unknown>)
        : o.amounts != null && typeof o.amounts === "object" && !Array.isArray(o.amounts)
          ? (o.amounts as Record<string, unknown>)
          : null;
    return raw ? parseSymbolNumberMap(raw) : {};
  } catch {
    return {};
  }
}

/** Serialize price map and optional USDT profit targets into one DB field. */
export function serializeMonitorTpBundle(prices: Record<string, number>, amountsQuote: Record<string, number>): string {
  const p: Record<string, number> = {};
  for (const [k, v] of Object.entries(prices)) {
    const key = normalizeInstIdToKey(k);
    if (key && typeof v === "number" && Number.isFinite(v) && v > 0) p[key] = v;
  }
  const a: Record<string, number> = {};
  for (const [k, v] of Object.entries(amountsQuote)) {
    const key = normalizeInstIdToKey(k);
    if (key && typeof v === "number" && Number.isFinite(v) && v > 0) a[key] = v;
  }
  if (Object.keys(a).length > 0) return JSON.stringify({ prices: p, amountsQuote: a });
  if (Object.keys(p).length > 0) return JSON.stringify(p);
  return "";
}

export function mergeTpTargets(
  dbJson: string | null | undefined,
  override?: Record<string, number | string> | null
): Record<string, number> {
  const base = parseMonitorTpTargetsJson(dbJson);
  if (!override) return base;
  const merged = { ...base };
  for (const [k, v] of Object.entries(override)) {
    const key = normalizeInstIdToKey(k);
    const n = typeof v === "number" ? v : parseFloat(String(v));
    if (key && Number.isFinite(n) && n > 0) merged[key] = n;
  }
  return merged;
}

export function mergeTpAmounts(
  dbJson: string | null | undefined,
  override?: Record<string, number | string> | null
): Record<string, number> {
  const base = parseMonitorTpAmountsJson(dbJson);
  if (!override) return base;
  const merged = { ...base };
  for (const [k, v] of Object.entries(override)) {
    const key = normalizeInstIdToKey(k);
    const n = typeof v === "number" ? v : parseFloat(String(v));
    if (key && Number.isFinite(n) && n > 0) merged[key] = n;
  }
  return merged;
}

function lookupTpForInst(instId: string, map: Record<string, number>): number | undefined {
  const id = instId.trim().toUpperCase().replace(/\//g, "-");
  if (map[id] != null) return map[id];
  const compact = id.replace(/-/g, "");
  for (const [k, v] of Object.entries(map)) {
    if (k.replace(/-/g, "") === compact) return v;
  }
  return undefined;
}

async function runDeepCheckForPosition(params: {
  instId: string;
  posSide: string;
  isLongPos: boolean;
  entryPx: number;
  markPx: number;
  userTp?: number;
  /** Optional user target for unrealized PnL in quote (e.g. USDT), same symbol row as TP price. */
  userTpAmountQuote?: number;
  uplQuote?: number | null;
  isDemo: boolean;
  blofinConfig: BlofinConfig;
  barPrimary: string;
  barSecondary: string;
}): Promise<{ line: string; action: "hold" | "close"; detailReason: string }> {
  const { instId, isLongPos, isDemo, blofinConfig, barPrimary, barSecondary } = params;
  const limA = candleLimitForDeepBar(barPrimary);
  const limB = candleLimitForDeepBar(barSecondary);
  const candlesA = await getCandlesBlofin(instId, barPrimary, limA, isDemo, { config: blofinConfig });
  const candlesB = await getCandlesBlofin(instId, barSecondary, limB, isDemo, { config: blofinConfig });
  const minA = barPrimary === "1M" || barPrimary === "1W" ? 8 : 20;
  const minB = barSecondary === "1M" || barSecondary === "1W" ? 4 : 10;
  if (candlesA.length < minA || candlesB.length < minB) {
    return {
      line: `${instId} ${params.posSide.toUpperCase()}: [Deep] skipped — insufficient ${barPrimary}/${barSecondary} data.`,
      action: "hold",
      detailReason: "Insufficient candles.",
    };
  }
  const closesA = candlesA.map((c) => parseFloatSafe(c[4])).filter((c) => c > 0);
  const closesB = candlesB.map((c) => parseFloatSafe(c[4])).filter((c) => c > 0);
  const { support, resistance } = findSupportResistance(candlesA, 10);
  const rsiPrimary = rsi(closesA, 14);
  const side = isLongPos ? "long" : "short";
  const uplNum = params.uplQuote != null && Number.isFinite(params.uplQuote) ? params.uplQuote : null;
  const ai = await getAIDeepPositionReview({
    instId,
    positionSide: side,
    entryPrice: params.entryPx,
    markPrice: params.markPx,
    userTakeProfit: params.userTp,
    userTakeProfitAmountQuote:
      params.userTpAmountQuote != null && Number.isFinite(params.userTpAmountQuote) && params.userTpAmountQuote > 0
        ? params.userTpAmountQuote
        : null,
    unrealizedPnlQuote: uplNum,
    seriesA: { label: barPrimary, closes: closesA },
    seriesB: { label: barSecondary, closes: closesB },
    supportPrimary: support,
    resistancePrimary: resistance,
    rsiPrimary,
  });
  const sideLabel = isLongPos ? "LONG" : "SHORT";
  const amt = params.userTpAmountQuote;
  const tpPart =
    params.userTp != null && amt != null && Number.isFinite(amt)
      ? ` TP@${params.userTp} (+${amt.toFixed(0)} USDT PnL target)`
      : params.userTp != null
        ? ` TP@${params.userTp}`
        : amt != null && Number.isFinite(amt)
          ? ` PnL target +${amt.toFixed(0)} USDT`
          : "";
  const tfNote = `[${barPrimary}/${barSecondary}]`;
  const tacticPart = ai.tacticHint ? ` | Tactical: ${ai.tacticHint}` : "";
  const line = `${instId} ${sideLabel}${tpPart}: [Deep] ${tfNote} ${ai.action.toUpperCase()} — TP feasibility: ${ai.tpFeasible}. ETA (uncertain): ${ai.etaHint}. ${ai.reason}${tacticPart}`;
  return { line, action: ai.action, detailReason: ai.reason };
}

/** Run AI monitor: evaluate open positions. When dryRun is true, returns suggested closes only (no auto-close). When dryRun is false, closes positions (used only after user confirmation). pinnedOnly: true = only pinned (monitoring board) symbols; false/omit = all open positions. */
export async function runAIMonitorCycle(options?: {
  dryRun?: boolean;
  deepCloseDryRun?: boolean;
  pinnedOnly?: boolean;
  blofinConfig: BlofinConfig;
  deepOnly?: boolean;
  runDeepEachCycle?: boolean;
  tpTargets?: Record<string, number | string> | null;
  /** Per instId: target unrealized PnL in quote (USDT) for AI coaching (optional). */
  tpAmountsQuote?: Record<string, number | string> | null;
}): Promise<{
  ok: boolean;
  closed: number;
  message?: string;
  error?: string;
  reasons?: string[];
  suggestedCloses?: SuggestedClose[];
  deepReasons?: string[];
  deepSuggestedCloses?: SuggestedClose[];
}> {
  const blofinConfig = options?.blofinConfig;
  if (!blofinConfig) return { ok: false, closed: 0, error: "Blofin config missing." };
  const deepOnly = options?.deepOnly === true;
  const dryRun = options?.dryRun !== false;
  const deepCloseDryRun = options?.deepCloseDryRun !== false;
  const runDeepEachCycle = options?.runDeepEachCycle === true;
  const bot = await db.tradingBot.findFirst({ orderBy: { updatedAt: "desc" } });
  if (!bot) return { ok: false, closed: 0, error: "No bot config." };
  const isDemo = blofinConfig.demo;
  const blofinOpts = { demo: isDemo, config: blofinConfig };
  const marginMode = ((bot as { marginMode?: string }).marginMode ?? "cross") as "isolated" | "cross";
  const strategy = (bot as { strategy?: string }).strategy ?? "simple";
  const tpJson = (bot as { monitorTpTargetsJson?: string | null }).monitorTpTargetsJson;
  const tpMap = mergeTpTargets(tpJson, options?.tpTargets ?? null);
  const tpAmountMap = mergeTpAmounts(tpJson, options?.tpAmountsQuote ?? null);
  const [barPrimary, barSecondary] = parseMonitorDeepTimeframesJson(
    (bot as { monitorDeepTimeframesJson?: string | null }).monitorDeepTimeframesJson
  );
  const allPositions = await getPositionsBlofin(undefined, blofinOpts);
  const monitorSymbolsRaw =
    options?.pinnedOnly === false ? null : (bot as { monitorSymbols?: string | null }).monitorSymbols;
  const monitorSet =
    monitorSymbolsRaw && monitorSymbolsRaw.trim()
      ? new Set(
          monitorSymbolsRaw
            .split(",")
            .map((s) => s.trim().toUpperCase().replace("/", "-"))
            .filter(Boolean)
        )
      : options?.pinnedOnly === true
        ? new Set<string>()
        : null;
  let positions = allPositions;
  if (monitorSet && monitorSet.size > 0) {
    positions = positions.filter((p) => {
      const id = (p.instId ?? "").trim().toUpperCase().replace("/", "-");
      return id && monitorSet.has(id);
    });
  }
  if (!positions.length) {
    const openSymbols = [...new Set(allPositions.map((p) => (p.instId ?? "").trim()).filter(Boolean))];
    const modeLabel = blofinConfig.demo ? "Demo" : "Live";
    if (monitorSet?.size && openSymbols.length > 0) {
      return {
        ok: true,
        closed: 0,
        message: `No open positions match your monitoring board. You have open positions: ${openSymbols.join(", ")}. Pin them from the Positions tab, then click Save in the Monitoring board so the AI monitor can see them; or clear the board to monitor all. (AI monitor uses ${modeLabel} account.)`,
      };
    }
    if (openSymbols.length > 0) {
      return {
        ok: true,
        closed: 0,
        message: `No positions to evaluate after filtering. (AI monitor uses ${modeLabel} account; you have: ${openSymbols.join(", ")}.)`,
      };
    }
    return {
      ok: true,
      closed: 0,
      message: `No open positions to monitor. (AI monitor uses ${modeLabel} account—same as Positions above.)`,
    };
  }

  if (deepOnly) {
    const deepReasons: string[] = [];
    const deepSuggestedCloses: SuggestedClose[] = [];
    for (const pos of positions) {
      const rawSize = String(pos.pos ?? "0").trim();
      if (Math.abs(parseFloat(rawSize)) <= 0) continue;
      const instId = (pos.instId ?? "").trim();
      if (!instId) continue;
      const posSide = (pos.posSide ?? "").toLowerCase();
      const isLongPos = posSide === "long";
      const ticker = await getTickerBlofin(instId, isDemo, { config: blofinConfig });
      const lastPrice = ticker?.last ? parseFloatSafe(ticker.last) : 0;
      const entryPx = parseFloatSafe(pos.avgPx);
      const markPx = pos.markPx ? parseFloatSafe(pos.markPx) : lastPrice;
      if (entryPx <= 0 || markPx <= 0) {
        deepReasons.push(`${instId} ${posSide.toUpperCase()}: [Deep] skipped — missing entry or mark.`);
        continue;
      }
      const userTp = lookupTpForInst(instId, tpMap);
      const userTpAmt = lookupTpForInst(instId, tpAmountMap);
      const uplRaw = (pos as { upl?: string | null }).upl;
      const uplNum = uplRaw != null && String(uplRaw).trim() !== "" ? parseFloatSafe(String(uplRaw)) : null;
      const deep = await runDeepCheckForPosition({
        instId,
        posSide,
        isLongPos,
        entryPx,
        markPx,
        userTp,
        userTpAmountQuote: userTpAmt,
        uplQuote: uplNum,
        isDemo,
        blofinConfig,
        barPrimary,
        barSecondary,
      });
      deepReasons.push(deep.line);
      if (deep.action === "close") {
        const rawPosSide = (pos as { rawPositionSide?: string }).rawPositionSide?.toLowerCase();
        const positionSide = (rawPosSide === "net" ? "net" : (posSide === "long" || posSide === "short" ? posSide : "net")) as "long" | "short" | "net";
        deepSuggestedCloses.push({ instId, posSide: positionSide, reason: deep.detailReason });
      }
    }
    return {
      ok: true,
      closed: 0,
      message:
        deepSuggestedCloses.length > 0
          ? `Deep check (${barPrimary}/${barSecondary}): ${deepSuggestedCloses.length} position(s) lean toward exit (review below; not auto-closed from this run).`
          : `Deep check (${barPrimary}/${barSecondary}) complete.`,
      reasons: deepReasons.length > 0 ? deepReasons : undefined,
      deepReasons: deepReasons.length > 0 ? deepReasons : undefined,
      deepSuggestedCloses: deepSuggestedCloses.length > 0 ? deepSuggestedCloses : undefined,
    };
  }

  const bar = toBlofinBar(bot.timeframe);
  const candleLimit = 100;
  let closed = 0;
  const reasons: string[] = [];
  const suggestedCloses: SuggestedClose[] = [];
  const deepReasons: string[] = [];
  const deepSuggestedCloses: SuggestedClose[] = [];

  for (const pos of positions) {
    const rawSize = String(pos.pos ?? "0").trim();
    if (Math.abs(parseFloat(rawSize)) <= 0) continue;
    const instId = (pos.instId ?? "").trim();
    if (!instId) continue;
    const posSide = (pos.posSide ?? "").toLowerCase();
    const isLongPos = posSide === "long";
    const candles = await getCandlesBlofin(instId, bar, candleLimit, isDemo, { config: blofinConfig });
    const ticker = await getTickerBlofin(instId, isDemo, { config: blofinConfig });
    const lastPrice = ticker?.last ? parseFloatSafe(ticker.last) : (candles.length ? parseFloatSafe(candles[0][4]) : 0);
    if (candles.length < 5 || lastPrice <= 0) {
      reasons.push(`${instId} ${posSide.toUpperCase()}: skipped (insufficient data).`);
      continue;
    }
    const resolved = await resolveSignal(
      strategy,
      candles,
      lastPrice,
      bot.symbol,
      bot.timeframe,
      bot.emaPeriod ?? 200,
      bot.fastMA ?? 9,
      bot.slowMA ?? 21,
      bot.rsiPeriod ?? 14
    );
    const signal = resolved.signal;
    const analysisMsg = (resolved.message ?? "").trim() || "no explicit signal";
    const message = analysisMsg.toLowerCase();
    const bearish = /negative|down|bearish|exit|sell|weaken|drop|fall/.test(message);
    const bullish = /positive|up|bullish|buy|strengthen|rise/.test(message);
    const shouldClose =
      (isLongPos && signal === "short") ||
      (isLongPos && !signal && bearish) ||
      (!isLongPos && signal === "long") ||
      (!isLongPos && !signal && bullish);
    const rawPosSide = (pos as { rawPositionSide?: string }).rawPositionSide?.toLowerCase();
    const positionSide = (rawPosSide === "net" ? "net" : (posSide === "long" || posSide === "short" ? posSide : "net")) as "long" | "short" | "net";

    const closesMon = candles.map((c) => parseFloatSafe(c[4])).filter((c) => c > 0);
    const { support: supM, resistance: resM } = findSupportResistance(candles, 8);
    const rsiMon = rsi(closesMon, 14);
    const uplRawMon = (pos as { upl?: string | null }).upl;
    const uplMon = uplRawMon != null && String(uplRawMon).trim() !== "" ? parseFloatSafe(String(uplRawMon)) : null;
    const userTpAmtMon = lookupTpForInst(instId, tpAmountMap);
    const tacticLine = await getAIOpenPositionTactic({
      instId,
      positionSide: isLongPos ? "long" : "short",
      entryPrice: parseFloatSafe(pos.avgPx),
      markPrice: lastPrice,
      unrealizedPnlQuote: Number.isFinite(uplMon) ? uplMon : null,
      userTakeProfitAmountQuote: userTpAmtMon != null && Number.isFinite(userTpAmtMon) ? userTpAmtMon : null,
      strategy,
      botTimeframe: String(bot.timeframe ?? "15m"),
      taSignal: signal,
      analysisSnippet: analysisMsg,
      lastCloses: closesMon,
      supportLevels: supM,
      resistanceLevels: resM,
      rsi: rsiMon,
    });

    let shortCloseSucceeded = false;
    if (!shouldClose) {
      reasons.push(`${instId} ${posSide.toUpperCase()}: held — ${analysisMsg}`);
      if (tacticLine) reasons.push(tacticLine);
    } else if (dryRun) {
      suggestedCloses.push({ instId, posSide: positionSide, reason: analysisMsg });
      reasons.push(`${instId} ${positionSide.toUpperCase()}: suggested close — ${analysisMsg}`);
      if (tacticLine) reasons.push(tacticLine);
    } else {
      const result = await closePositionViaApiBlofin(instId, marginMode, positionSide, blofinOpts);
      if (result.ok) {
        closed++;
        shortCloseSucceeded = true;
        reasons.push(`${instId} ${posSide.toUpperCase()}: closed — ${analysisMsg}`);
      } else {
        reasons.push(`${instId} ${posSide.toUpperCase()}: close failed — ${result.error ?? "unknown error"}`);
      }
      if (tacticLine) reasons.push(tacticLine);
    }

    if (shortCloseSucceeded) continue;

    if (runDeepEachCycle) {
      const entryPx = parseFloatSafe(pos.avgPx);
      const markPx = pos.markPx ? parseFloatSafe(pos.markPx) : lastPrice;
      const userTp = lookupTpForInst(instId, tpMap);
      const userTpAmtDeep = lookupTpForInst(instId, tpAmountMap);
      const uplDeep = (pos as { upl?: string | null }).upl;
      const uplDeepNum = uplDeep != null && String(uplDeep).trim() !== "" ? parseFloatSafe(String(uplDeep)) : null;
      if (entryPx > 0 && markPx > 0) {
        const deep = await runDeepCheckForPosition({
          instId,
          posSide,
          isLongPos,
          entryPx,
          markPx,
          userTp,
          userTpAmountQuote: userTpAmtDeep,
          uplQuote: uplDeepNum,
          isDemo,
          blofinConfig,
          barPrimary,
          barSecondary,
        });
        deepReasons.push(deep.line);
        if (deep.action === "close") {
          if (deepCloseDryRun) {
            deepSuggestedCloses.push({ instId, posSide: positionSide, reason: deep.detailReason });
          } else {
            const result = await closePositionViaApiBlofin(instId, marginMode, positionSide, blofinOpts);
            if (result.ok) {
              closed++;
              deepReasons[deepReasons.length - 1] = `${instId} ${posSide.toUpperCase()}: [Deep] closed — ${deep.detailReason}`;
            } else {
              deepReasons[deepReasons.length - 1] = `${instId} ${posSide.toUpperCase()}: [Deep] close failed — ${result.error ?? "unknown"}`;
            }
          }
        }
      }
    }
  }

  const shortMsg = dryRun
    ? suggestedCloses.length > 0
      ? `Short-term: suggests closing ${suggestedCloses.length} position(s).`
      : "Short-term: no exit signal."
    : closed > 0
      ? `Closed ${closed} position(s) (short-term and/or deep).`
      : "Short-term: no positions closed.";

  const deepMsg =
    runDeepEachCycle && deepSuggestedCloses.length > 0
      ? ` Deep check suggests closing ${deepSuggestedCloses.length} (enable Deep autopilot to auto-close on deep exit).`
      : runDeepEachCycle && deepReasons.length > 0
        ? " Deep check lines added below."
        : "";

  return {
    ok: true,
    closed,
    message: `${shortMsg}${deepMsg}`.trim(),
    reasons: reasons.length > 0 ? reasons : undefined,
    suggestedCloses: suggestedCloses.length > 0 ? suggestedCloses : undefined,
    deepReasons: deepReasons.length > 0 ? deepReasons : undefined,
    deepSuggestedCloses: deepSuggestedCloses.length > 0 ? deepSuggestedCloses : undefined,
  };
}
