/**
 * AI-powered trading signal: send market summary (OHLC, indicators, S/R) to Claude; get long/short/no_buy.
 */

import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_SONNET_MODEL } from "@/lib/anthropic-models";

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
    model: CLAUDE_SONNET_MODEL,
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
  /** Optional target unrealized PnL in quote (e.g. USDT) — user-defined take-profit *amount*. */
  userTakeProfitAmountQuote?: number | null;
  /** Unrealized PnL in quote (e.g. USDT) when exchange provides it. */
  unrealizedPnlQuote?: number | null;
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
  /** Actionable coaching: trim, exit, consider flip, etc. */
  tacticHint: string;
};

export type OpenPositionTacticInput = {
  instId: string;
  positionSide: "long" | "short";
  entryPrice: number;
  markPrice: number;
  unrealizedPnlQuote: number | null;
  /** Optional USDT (quote) profit target the user saved for this symbol. */
  userTakeProfitAmountQuote?: number | null;
  strategy: string;
  botTimeframe: string;
  taSignal: "long" | "short" | null;
  analysisSnippet: string;
  lastCloses: number[];
  supportLevels: number[];
  resistanceLevels: number[];
  rsi?: number | null;
};

/**
 * Short-term tactical coaching for an open position (AI Monitor add-on).
 * Not financial advice; does not place orders.
 */
export async function getAIOpenPositionTactic(input: OpenPositionTacticInput): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const closes = input.lastCloses.slice(0, 45).join(", ");
  const s = input.supportLevels.slice(0, 5).join(", ") || "none";
  const r = input.resistanceLevels.slice(0, 5).join(", ") || "none";
  const pnlLine =
    input.unrealizedPnlQuote != null && Number.isFinite(input.unrealizedPnlQuote)
      ? `Unrealized PnL (quote): ${input.unrealizedPnlQuote >= 0 ? "+" : ""}${input.unrealizedPnlQuote.toFixed(2)}`
      : "Unrealized PnL: not provided — infer only from entry vs mark.";
  const tpAmtLine =
    input.userTakeProfitAmountQuote != null && Number.isFinite(input.userTakeProfitAmountQuote) && input.userTakeProfitAmountQuote > 0
      ? `User target profit (quote, e.g. USDT): +${input.userTakeProfitAmountQuote.toFixed(2)} — compare to current unrealized PnL; suggest banking profit, holding for more, or adjusting if structure conflicts.`
      : "";

  const prompt = `You are an experienced crypto perpetual futures analyst. The trader has an OPEN ${input.positionSide.toUpperCase()} on ${input.instId}. This is educational only — not personalized financial advice.

Position:
- Entry (avg): ${input.entryPrice}
- Mark: ${input.markPrice}
- ${pnlLine}
${tpAmtLine ? `- ${tpAmtLine}` : ""}
- Bot timeframe: ${input.botTimeframe}; strategy mode: ${input.strategy}
- TA overlay signal (if any): ${input.taSignal ?? "none"}
- Prior model summary: ${input.analysisSnippet.slice(0, 400)}

Market (newest first):
- Last closes: ${closes}
${input.rsi != null ? `- RSI(14): ${input.rsi.toFixed(1)}` : ""}
- Support: ${s}
- Resistance: ${r}

Task: Using structure (swings, trend, S/R), RSI, and **meaningful PnL vs entry**, give ONE concise tactical line the trader can act on manually. Examples of ideas (pick one when justified): hold; bank some profit / de-risk; full exit; structure favors **closing and looking for a new long**; favors **closing and looking for a new short**; wait for pullback to add same side — only if evidence is clear. If the run has delivered a large favorable move and structure shows exhaustion or a regime shift against the open, say so explicitly.

Output exactly one line (no other lines):
TACTIC_ONE_LINER: max 260 characters, plain text.`;

  const msg = await anthropic.messages.create({
    model: CLAUDE_SONNET_MODEL,
    max_tokens: 200,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    msg.content?.find((b) => b.type === "text")?.type === "text"
      ? (msg.content.find((b) => b.type === "text") as { type: "text"; text: string }).text
      : "";
  const m = text.match(/TACTIC_ONE_LINER:\s*(.+)/i);
  const line = m ? m[1].trim().slice(0, 320) : "";
  if (!line) return null;
  return `${input.instId} ${input.positionSide.toUpperCase()}: [Tactical] ${line}`;
}

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
      tacticHint: "",
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
      ? `User-entered take-profit price: ${input.userTakeProfit} (Blofin may not show TP in the app.) You MUST set TP_FEASIBLE to high, medium, or low (not unknown) based on distance, structure, and whether that target still makes sense for this ${input.positionSide}.`
      : "No explicit user TP price was passed to this model. You may use TP_FEASIBLE **unknown** only if major targets are genuinely ambiguous; otherwise rate feasibility of a typical profit-taking zone vs structure (high/medium/low) and explain briefly.";

  const tpAmtLine =
    input.userTakeProfitAmountQuote != null && Number.isFinite(input.userTakeProfitAmountQuote) && input.userTakeProfitAmountQuote > 0
      ? `User-entered **profit target in quote** (e.g. USDT): +${input.userTakeProfitAmountQuote.toFixed(2)} unrealized PnL — weigh vs current PnL and structure (bank at target, stretch, or invalidation).`
      : "";

  const pnlLine =
    input.unrealizedPnlQuote != null && Number.isFinite(input.unrealizedPnlQuote)
      ? `Unrealized PnL (quote): ${input.unrealizedPnlQuote >= 0 ? "+" : ""}${input.unrealizedPnlQuote.toFixed(2)} — use this with structure: large favorable PnL may warrant de-risk, exit, or planning a flip if the trend/regime is shifting.`
      : "";

  const prompt = `You are an expert crypto futures analyst. The user has an OPEN ${input.positionSide.toUpperCase()} position and wants a LONGER-HORIZON read (not scalping), using two timeframe contexts below.

Position:
- Symbol: ${input.instId}
- Side: ${input.positionSide}
- Entry (avg): ${input.entryPrice}
- Mark / current: ${input.markPrice}
- ${tpLine}
${tpAmtLine ? `- ${tpAmtLine}` : ""}
${pnlLine ? `- ${pnlLine}` : ""}

Context series (newest first):
- Series A (${input.seriesA.label}) last ${sliceA} closes: ${cA}
- Series B (${input.seriesB.label}) last ${sliceB} closes: ${cB}
${input.rsiPrimary != null ? `- RSI(14) on Series A closes: ${input.rsiPrimary.toFixed(1)}` : ""}
- Support (from Series A candles): ${s}
- Resistance (from Series A candles): ${r}

Rules:
- Not personalized financial advice; be cautious.
- ETA_HINT: rough band (e.g. "unlikely within 24h", "several days if structure holds", "weeks+") and state uncertainty — never imply certainty.
- ACTION "close" only if structure across these horizons clearly contradicts holding the ${input.positionSide} OR the trade thesis is broken. Otherwise "hold".
- TACTIC_HINT: one sentence (max 220 chars) with **actionable** coaching: e.g. hold; trim/take profit; full exit; **close short and watch for long re-entry** if structure clearly flipped bullish; **close long and watch for short** if flipped bearish — tie to S/R, swings/trend, RSI, and PnL context when relevant.

Respond with exactly this format (one line each):
ACTION: hold|close
TP_FEASIBLE: high|medium|low|unknown
ETA_HINT: one short phrase
TACTIC_HINT: one sentence (max 220 chars)
REASON: 2-4 sentences`;

  const msg = await anthropic.messages.create({
    model: CLAUDE_SONNET_MODEL,
    max_tokens: 500,
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

  let tacticHint = "";
  const tactMatch = text.match(/TACTIC_HINT:\s*(.+)/i);
  if (tactMatch) tacticHint = tactMatch[1].trim().slice(0, 240);

  let reason = "No response";
  const reasonMatch = text.match(/REASON:\s*([\s\S]+)/i);
  if (reasonMatch) reason = reasonMatch[1].trim().split(/\n\nACTION:/i)[0]?.trim() || reasonMatch[1].trim();

  return { action, tpFeasible, etaHint: etaHint || "uncertain", reason, tacticHint };
}
