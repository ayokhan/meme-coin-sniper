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
  type Candle,
} from "@/lib/blofin";
import { indicatorsSignal, maCrossoverSignal, candlePatternSignal, findSupportResistance, ema, rsi } from "@/lib/trading-bot-ta";
import { getAITradingSignal } from "@/lib/ai-trading-signal";

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

export async function runTradingBotCycle(): Promise<{ ok: boolean; message?: string; error?: string }> {
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
  if (!isBlofinConfigured()) {
    return { ok: false, error: "Blofin API keys not set. Set BLOFIN_API_KEY, BLOFIN_SECRET_KEY, BLOFIN_PASSPHRASE in your server env (e.g. Vercel)." };
  }

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

  const isDemo = bot.mode === "demo";
  try {
    const [candlesRes, tickerRes, instRes, positionsRes] = await Promise.all([
      getCandles(instId, bar, candleLimit, isDemo),
      getTicker(instId, isDemo),
      getInstrument(instId, { demo: isDemo }),
      getPositions(instId, { demo: isDemo }),
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
    const leverageOk = await setLeverage(instId, bot.leverage, marginMode);
    if (!leverageOk.ok) {
      console.warn("setLeverage:", leverageOk.error);
      // continue anyway
    }

    const side = signal === "long" ? "buy" : "sell";
    const order = await placeMarketOrder(instId, side, sizeStr, marginMode, { demo: isDemo });
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
        { demo: isDemo }
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
 * Close open position(s). If closeInstId is set, close only that symbol; if closeAll is true, close all positions; otherwise close bot's symbol. Owner-only.
 * Uses Blofin dedicated close-position API when possible.
 */
export async function closeTradingBotPosition(options?: {
  closeInstId?: string;
  closeAll?: boolean;
}): Promise<{ ok: boolean; message?: string; error?: string }> {
  const closeInstId = options?.closeInstId?.trim();
  const closeAll = options?.closeAll === true;

  const bot = await db.tradingBot.findFirst({ orderBy: { updatedAt: "desc" } });
  if (!bot) return { ok: false, error: "No bot config." };
  if (!isBlofinConfigured()) {
    return { ok: false, error: "Blofin API keys not set." };
  }

  const isDemo = bot.mode === "demo";
  const marginMode = ((bot as { marginMode?: string }).marginMode ?? "cross") as "isolated" | "cross";

  const positions = closeAll
    ? await getPositionsBlofin(undefined, { demo: isDemo })
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
        { demo: isDemo }
      );

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
    let result = await closePositionViaApiBlofin(instId, marginMode, positionSide, { demo: isDemo });
    if (!result.ok && positionSide !== "net") {
      const errMsg = (result.error ?? "").toLowerCase();
      if (errMsg.includes("closed") || errMsg.includes("position")) {
        result = await closePositionViaApiBlofin(instId, marginMode, "net", { demo: isDemo });
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
}): Promise<{ ok: boolean; orderId?: string; message?: string; error?: string }> {
  const bot = await db.tradingBot.findFirst({ orderBy: { updatedAt: "desc" } });
  if (!bot) return { ok: false, error: "No bot config." };
  if (!isBlofinConfigured()) return { ok: false, error: "Blofin API keys not set." };
  const rawSymbol = (bot.symbol ?? "").trim().toUpperCase();
  if (!rawSymbol) return { ok: false, error: "Symbol required." };
  const instId = rawSymbol.includes("/") ? rawSymbol.replace("/", "-") : `${rawSymbol}-${bot.marginCurrency ?? "USDT"}`;
  const isDemo = bot.mode === "demo";
  const marginMode = ((bot as { marginMode?: string }).marginMode ?? "cross") as "isolated" | "cross";
  const instRes = await getInstrumentBlofin(instId, { demo: isDemo });
  if (!instRes) return { ok: false, error: "Could not get instrument." };
  const contractValue = parseFloatSafe(instRes.contractValue);
  const minSize = parseFloatSafe(instRes.minSize);
  if (contractValue <= 0) return { ok: false, error: "Invalid contract value." };
  const notionalUsdt = bot.positionSizeUsdt * (bot.leverage ?? 1);
  const sizeContracts = notionalUsdt / (options.price * contractValue);
  const sizeStr = roundSize(sizeContracts, minSize, minSize);
  if (parseFloat(sizeStr) < minSize) return { ok: false, error: `Size below minimum (${minSize} contracts).` };
  await setLeverageBlofin(instId, bot.leverage, marginMode, { demo: isDemo });
  const side = options.side === "long" ? "buy" : "sell";
  const result = await placeLimitOrderBlofin(instId, side, sizeStr, String(options.price), marginMode, { demo: isDemo });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, orderId: result.orderId, message: `Limit ${options.side} ${sizeStr} @ ${options.price} placed.` };
}

/** Run AI monitor: evaluate open positions; close if trend is opposite or AI suggests exit (negative). */
export async function runAIMonitorCycle(): Promise<{ ok: boolean; closed: number; message?: string; error?: string }> {
  const bot = await db.tradingBot.findFirst({ orderBy: { updatedAt: "desc" } });
  if (!bot) return { ok: false, closed: 0, error: "No bot config." };
  if (!isBlofinConfigured()) return { ok: false, closed: 0, error: "Blofin API keys not set." };
  const isDemo = bot.mode === "demo";
  const marginMode = ((bot as { marginMode?: string }).marginMode ?? "cross") as "isolated" | "cross";
  const strategy = (bot as { strategy?: string }).strategy ?? "simple";
  const allPositions = await getPositionsBlofin(undefined, { demo: isDemo });
  const monitorSymbolsRaw = (bot as { monitorSymbols?: string | null }).monitorSymbols;
  const monitorSet = monitorSymbolsRaw
    ? new Set(
        monitorSymbolsRaw
          .split(",")
          .map((s) => s.trim().toUpperCase().replace("/", "-"))
          .filter(Boolean)
      )
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
    const modeLabel = isDemo ? "Demo" : "Live";
    if (monitorSet?.size && openSymbols.length > 0) {
      return {
        ok: true,
        closed: 0,
        message: `No open positions match your monitoring board. You have open positions: ${openSymbols.join(", ")}. Pin them from the Positions tab or add these symbols to the board; or clear the board to monitor all. (AI monitor uses ${modeLabel} account.)`,
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
  const bar = toBlofinBar(bot.timeframe);
  const candleLimit = 100;
  let closed = 0;
  for (const pos of positions) {
    const rawSize = String(pos.pos ?? "0").trim();
    if (Math.abs(parseFloat(rawSize)) <= 0) continue;
    const instId = (pos.instId ?? "").trim();
    if (!instId) continue;
    const posSide = (pos.posSide ?? "").toLowerCase();
    const isLongPos = posSide === "long";
    const candles = await getCandlesBlofin(instId, bar, candleLimit, isDemo);
    const ticker = await getTickerBlofin(instId, isDemo);
    const lastPrice = ticker?.last ? parseFloatSafe(ticker.last) : (candles.length ? parseFloatSafe(candles[0][4]) : 0);
    if (candles.length < 5 || lastPrice <= 0) continue;
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
    const message = (resolved.message ?? "").toLowerCase();
    const bearish = /negative|down|bearish|exit|sell|weaken|drop|fall/.test(message);
    const bullish = /positive|up|bullish|buy|strengthen|rise/.test(message);
    const shouldClose =
      (isLongPos && signal === "short") ||
      (isLongPos && !signal && bearish) ||
      (!isLongPos && signal === "long") ||
      (!isLongPos && !signal && bullish);
    if (!shouldClose) continue;
    const rawPosSide = (pos as { rawPositionSide?: string }).rawPositionSide?.toLowerCase();
    const positionSide = (rawPosSide === "net" ? "net" : (posSide === "long" || posSide === "short" ? posSide : "net")) as "long" | "short" | "net";
    const result = await closePositionViaApiBlofin(instId, marginMode, positionSide, { demo: isDemo });
    if (result.ok) closed++;
  }
  return { ok: true, closed, message: closed > 0 ? `AI monitor closed ${closed} position(s).` : "No positions closed." };
}
