/**
 * AI-powered trading signal: send market summary (OHLC, indicators, S/R) to Claude; get long/short/no_buy.
 */

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type MarketSummary = {
  symbol: string;
  timeframe: string;
  lastCloses: number[];
  currentPrice: number;
  ema200?: number | null;
  rsi?: number | null;
  supportLevels: number[];
  resistanceLevels: number[];
  maCrossover?: "long" | "short" | null;
  candlePattern?: string | null;
};

export type AISignalResult = {
  signal: "long" | "short" | "no_buy";
  score: number;
  reason: string;
};

export async function getAITradingSignal(summary: MarketSummary): Promise<AISignalResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { signal: "no_buy", score: 0, reason: "AI not configured" };
  }

  const lastCandles = summary.lastCloses.slice(0, 20).join(", ");
  const s = summary.supportLevels.slice(0, 5).join(", ") || "none";
  const r = summary.resistanceLevels.slice(0, 5).join(", ") || "none";

  const prompt = `You are an expert crypto futures analyst. Based ONLY on the following market data, output a single trading signal.

Market data:
- Symbol: ${summary.symbol}
- Timeframe: ${summary.timeframe}
- Current price: ${summary.currentPrice}
- Last 20 closes (newest first): ${lastCandles}
${summary.ema200 != null ? `- EMA(200): ${summary.ema200.toFixed(2)} (price ${summary.currentPrice > summary.ema200 ? "above" : "below"} EMA)` : ""}
${summary.rsi != null ? `- RSI(14): ${summary.rsi.toFixed(1)}` : ""}
- Support levels: ${s}
- Resistance levels: ${r}
${summary.maCrossover ? `- MA crossover: ${summary.maCrossover}` : ""}
${summary.candlePattern ? `- Candle pattern: ${summary.candlePattern}` : ""}

Respond with exactly this format (one line each, no extra text):
SIGNAL: long|short|no_buy
SCORE: 0-100
REASON: one short sentence

Rules: signal "long" or "short" only if score >= 55 and setup has clear edge; otherwise "no_buy". Be conservative.`;

  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 150,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    msg.content?.find((b) => b.type === "text")?.type === "text"
      ? (msg.content.find((b) => b.type === "text") as { type: "text"; text: string }).text
      : "";
  let signal: "long" | "short" | "no_buy" = "no_buy";
  let score = 0;
  let reason = "No response";

  const signalMatch = text.match(/SIGNAL:\s*(long|short|no_buy)/i);
  const scoreMatch = text.match(/SCORE:\s*(\d+)/);
  const reasonMatch = text.match(/REASON:\s*([\s\S]+?)(?:\n|$)/);

  if (signalMatch) signal = signalMatch[1].toLowerCase() as "long" | "short" | "no_buy";
  if (scoreMatch) score = Math.min(100, Math.max(0, parseInt(scoreMatch[1], 10)));
  if (reasonMatch) reason = reasonMatch[1].trim();

  return { signal: signal === "long" || signal === "short" ? signal : "no_buy", score, reason };
}

export type DeepSeries = { label: string; closes: number[] };

export type DeepPositionInput = {
  instId: string;
  positionSide: "long" | "short";
  entryPrice: number;
  markPrice: number;
  userTakeProfit?: number | null;
  seriesA: DeepSeries;
  seriesB: DeepSeries;
  supportPrimary: number[];
  resistancePrimary: number[];
  rsiPrimary?: number | null;
};

export type DeepPositionResult = {
  action: "hold" | "close";
  tpFeasible: "high" | "medium" | "low" | "unknown";
  etaHint: string;
  reason: string;
};

/**
 * Longer-horizon read for an open position using two user-chosen candle series (Blofin bars).
 * ETAs are non-binding estimates; not financial advice.
 */
export async function getAIDeepPositionReview(input: DeepPositionInput): Promise<DeepPositionResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      action: "hold",
      tpFeasible: "unknown",
      etaHint: "n/a",
      reason: "AI not configured (set ANTHROPIC_API_KEY).",
    };
  }

  const sliceA = Math.min(50, input.seriesA.closes.length);
  const sliceB = Math.min(40, input.seriesB.closes.length);
  const cA = input.seriesA.closes.slice(0, sliceA).join(", ");
  const cB = input.seriesB.closes.slice(0, sliceB).join(", ");
  const s = input.supportPrimary.slice(0, 5).join(", ") || "none";
  const r = input.resistancePrimary.slice(0, 5).join(", ") || "none";
  const tpLine =
    input.userTakeProfit != null && Number.isFinite(input.userTakeProfit) && input.userTakeProfit > 0
      ? `User-entered take-profit price: ${input.userTakeProfit} (Blofin may not show TP in the app.)`
      : "No user take-profit price; judge holding vs exit using structure in line with the open direction.";

  const prompt = `You are an expert crypto futures analyst. The user has an OPEN ${input.positionSide.toUpperCase()} position and wants a LONGER-HORIZON read (not scalping), using two timeframe contexts below.

Position:
- Symbol: ${input.instId}
- Side: ${input.positionSide}
- Entry (avg): ${input.entryPrice}
- Mark / current: ${input.markPrice}
- ${tpLine}

Context series (newest first):
- Series A (${input.seriesA.label}) last ${sliceA} closes: ${cA}
- Series B (${input.seriesB.label}) last ${sliceB} closes: ${cB}
${input.rsiPrimary != null ? `- RSI(14) on Series A closes: ${input.rsiPrimary.toFixed(1)}` : ""}
- Support (from Series A candles): ${s}
- Resistance (from Series A candles): ${r}

Rules:
- Not personalized financial advice; be cautious.
- ETA_HINT: rough band (e.g. "unlikely within 24h", "several days if structure holds", "weeks+") and state uncertainty — never imply certainty.
- ACTION "close" only if structure across these horizons clearly contradicts holding the ${input.positionSide} OR user TP looks effectively unreachable without invalidating the trade. Otherwise "hold".
- If no user TP, TP_FEASIBLE may be "unknown".

Respond with exactly this format (one line each):
ACTION: hold|close
TP_FEASIBLE: high|medium|low|unknown
ETA_HINT: one short phrase
REASON: 2-4 sentences`;

  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 400,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    msg.content?.find((b) => b.type === "text")?.type === "text"
      ? (msg.content.find((b) => b.type === "text") as { type: "text"; text: string }).text
      : "";

  let action: "hold" | "close" = "hold";
  const actionMatch = text.match(/ACTION:\s*(hold|close)/i);
  if (actionMatch) action = actionMatch[1].toLowerCase() === "close" ? "close" : "hold";

  let tpFeasible: DeepPositionResult["tpFeasible"] = "unknown";
  const tfMatch = text.match(/TP_FEASIBLE:\s*(high|medium|low|unknown)/i);
  if (tfMatch) {
    const v = tfMatch[1].toLowerCase() as DeepPositionResult["tpFeasible"];
    if (v === "high" || v === "medium" || v === "low" || v === "unknown") tpFeasible = v;
  }

  let etaHint = "";
  const etaMatch = text.match(/ETA_HINT:\s*(.+)/i);
  if (etaMatch) etaHint = etaMatch[1].trim();

  let reason = "No response";
  const reasonMatch = text.match(/REASON:\s*([\s\S]+)/i);
  if (reasonMatch) reason = reasonMatch[1].trim().split(/\n\nACTION:/i)[0]?.trim() || reasonMatch[1].trim();

  return { action, tpFeasible, etaHint: etaHint || "uncertain", reason };
}
