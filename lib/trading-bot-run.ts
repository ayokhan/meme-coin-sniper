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
  placeTPSLOrder as placeTPSLOrderBlofin,
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
    decisionMsg?: string
  ) => {
    try {
      await db.tradingBot.update({
        where: { id: bot!.id },
        data: {
          lastRunAt: new Date(),
          lastError: err,
          lastDecision: decision ?? null,
          lastDecisionMsg: decisionMsg ?? null,
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
    const isDemo = bot.mode === "demo";
    const order = await placeMarketOrder(instId, side, sizeStr, marginMode, { demo: isDemo });
    if (!order.ok) {
      const err = order.error ?? "Order failed";
      await updateLastRun(err, "no_trade", err);
      return { ok: false, error: order.error };
    }

    const successMsg = `Opened ${signal} ${sizeStr} @ ${lastPrice}`;
    await updateLastRun(null, signal, successMsg);

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
 * Close any open position for the trading bot's symbol (Blofin). Owner-only; call from API.
 */
export async function closeTradingBotPosition(): Promise<{ ok: boolean; message?: string; error?: string }> {
  const bot = await db.tradingBot.findFirst({ orderBy: { updatedAt: "desc" } });
  if (!bot) return { ok: false, error: "No bot config." };
  if (!isBlofinConfigured()) {
    return { ok: false, error: "Blofin API keys not set." };
  }
  const rawSymbol = (bot.symbol ?? "").trim().toUpperCase();
  if (!rawSymbol) return { ok: false, error: "Symbol is required." };
  const instId = rawSymbol.includes("/")
    ? rawSymbol.replace("/", "-")
    : `${rawSymbol}-${bot.marginCurrency ?? "USDT"}`;

  const isDemo = bot.mode === "demo";
  const positions = await getPositionsBlofin(instId, { demo: isDemo });
  if (!positions.length) {
    return {
      ok: false,
      error:
        "No open position found for this symbol. Check: (1) Bot Mode is Live if the position is on live Blofin. (2) Your Blofin API key has permission to read positions (e.g. READ or Trade+Read). (3) Symbol matches (e.g. BTC/USDT → BTC-USDT).",
    };
  }

  const marginMode = ((bot as { marginMode?: string }).marginMode ?? "cross") as "isolated" | "cross";
  for (const pos of positions) {
    const rawSize = String(pos.pos ?? "0").trim();
    const sizeNum = Math.abs(parseFloat(rawSize));
    if (sizeNum <= 0 || !Number.isFinite(sizeNum)) continue;
    const size = String(sizeNum);
    const closeSide = (pos.posSide ?? "").toLowerCase() === "long" ? "sell" : "buy";
    const result = await placeMarketOrderBlofin(instId, closeSide, size, marginMode, { demo: isDemo, reduceOnly: true });
    if (!result.ok) {
      return { ok: false, error: result.error ?? "Failed to close position." };
    }
  }
  return { ok: true, message: "Position closed." };
}
