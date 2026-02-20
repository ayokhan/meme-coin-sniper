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
  const reasonMatch = text.match(/REASON:\s*(.+?)(?:\n|$)/s);

  if (signalMatch) signal = signalMatch[1].toLowerCase() as "long" | "short" | "no_buy";
  if (scoreMatch) score = Math.min(100, Math.max(0, parseInt(scoreMatch[1], 10)));
  if (reasonMatch) reason = reasonMatch[1].trim();

  return { signal: signal === "long" || signal === "short" ? signal : "no_buy", score, reason };
}
