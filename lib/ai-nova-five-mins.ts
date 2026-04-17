import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type NovaFiveMinsTapeRegime = "up_slope" | "down_slope" | "sideways" | "mixed";

export type NovaFiveMinsAiResult = {
  direction: "Up" | "Down" | "Unclear";
  confidencePct: number;
  tapeRegime: NovaFiveMinsTapeRegime;
  summary: string;
  factors: string[];
  riskNote: string;
};

/** User started a 5m trade clock after entering a position (this feed only). */
export type NovaFiveMinsTradeCycleContext = {
  startedAtIso: string;
  endsAtIso: string;
  secondsRemaining: number;
  anchorOpen: number;
};

function parseTapeRegime(raw: string | undefined): NovaFiveMinsTapeRegime {
  const t = (raw ?? "").toLowerCase().replace(/[^a-z_]/g, "");
  if (t === "up_slope" || t === "upslope") return "up_slope";
  if (t === "down_slope" || t === "downslope") return "down_slope";
  if (t === "sideways" || t === "range" || t === "chop") return "sideways";
  if (t === "mixed" || t === "two_way" || t === "twoway") return "mixed";
  return "mixed";
}

function parseAiLines(text: string): NovaFiveMinsAiResult {
  const directionMatch = text.match(/DIRECTION:\s*(Up|Down|Unclear)/i);
  const confMatch = text.match(/CONFIDENCE:\s*(\d+)/i);
  const regimeMatch = text.match(/REGIME:\s*(up_slope|down_slope|sideways|mixed|upslope|downslope|range|chop|two_way|twoway)/i);
  const summaryMatch = text.match(/SUMMARY:\s*([\s\S]+?)(?=FACTORS:|RISK:|$)/i);
  const factorsMatch = text.match(/FACTORS:\s*([\s\S]+?)(?=RISK:|$)/i);
  const riskMatch = text.match(/RISK:\s*([\s\S]+?)$/im);

  const dirRaw = directionMatch?.[1]?.toLowerCase();
  const direction: "Up" | "Down" | "Unclear" =
    dirRaw === "up" ? "Up" : dirRaw === "down" ? "Down" : "Unclear";
  const confidencePct = confMatch ? Math.min(100, Math.max(0, parseInt(confMatch[1]!, 10))) : 0;
  const tapeRegime = parseTapeRegime(regimeMatch?.[1]);
  const summary = summaryMatch?.[1]?.trim().replace(/\n+/g, " ") || "No summary returned.";
  const factorsText = factorsMatch?.[1]?.trim() ?? "";
  const factors = factorsText
    ? factorsText
        .split(/[;\n•]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 8)
    : [];
  const riskNote =
    riskMatch?.[1]?.trim() ||
    "Not financial advice. Short-horizon noise dominates; Polymarket resolves on Chainlink, not this spot feed.";

  return { direction, confidencePct, tapeRegime, summary, factors, riskNote };
}

/**
 * Claude reads compact OHLC context and returns a directional lean for a *hypothetical* window,
 * aligned with Polymarket-style Up/Down framing (not a guarantee).
 */
export async function runNovaFiveMinsAnalysis(
  marketFacts: string,
  symbolLabel: string,
  horizonMinutes: 5 | 15 | 60 = 5,
  tradeCycle: NovaFiveMinsTradeCycleContext | null = null
): Promise<NovaFiveMinsAiResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      direction: "Unclear",
      confidencePct: 0,
      tapeRegime: "mixed",
      summary: "ANTHROPIC_API_KEY is not set; Nova 5 mins AI is unavailable.",
      factors: [],
      riskNote: "Configure Anthropic on the server to enable AI.",
    };
  }

  const cycleBlock = tradeCycle
    ? `
LIVE TRADE CYCLE (user entered a position and started a personal 5-minute clock on THIS feed — not Polymarket's official window):
- Cycle start (ISO): ${tradeCycle.startedAtIso}
- Cycle end (ISO): ${tradeCycle.endsAtIso}
- ~Seconds remaining in their clock: ${tradeCycle.secondsRemaining}
- Anchor "price to beat" ON THIS FEED at cycle start: ${tradeCycle.anchorOpen.toFixed(6)}

Give a **deeper** read than a casual snapshot: path since entry, how close price is to the anchor, what would **invalidate** an Up vs Down resolve before the bell, micro-aggression (offers vs bids), and late-cycle mean-reversion risk. Still use ONLY the numbers in the context block; do not invent fills or order flow you cannot see.

`
    : "";

  const taskHorizon = tradeCycle ? 5 : horizonMinutes;

  const prompt = `You are a disciplined crypto microstructure analyst helping VIP users think about short-horizon direction, similar in spirit to Polymarket "Up or Down" crypto markets (5m, 15m, etc.).
${cycleBlock}
The user chose an analysis horizon of **${horizonMinutes} minutes**${tradeCycle ? " (trade cycle mode locks the window to **5 minutes** from their start click)" : ""}. Interpret "Up" as: spot (this feed) more likely to finish that horizon **at or above** the opening reference (approx. open from ${taskHorizon} 1m bars ago on this feed, OR the TRADE_CYCLE anchor when provided). "Down" means likely **below** that reference. This is NOT the same as Polymarket settlement (Chainlink oracle, exact window times).

Context (1m candles — NOT Polymarket's oracle):
${marketFacts}

Asset label: ${symbolLabel}

Task: Based ONLY on the numbers above (momentum, micro-range, last candle bias${tradeCycle ? ", path since cycle start vs anchor" : ""}), lean Up or Down for how spot may resolve over the **remaining time** vs the correct reference (rolling window OR trade-cycle anchor), or Unclear if noise dominates.

Rules:
- Prefer DIRECTION Unclear unless there is a modest edge from the tape (tight chop → Unclear).
- REGIME must describe the *current* tape: up_slope (clear bid / higher lows), down_slope (clear offer / lower highs), sideways (range-bound, little net drift), or mixed (two-way, whipsaw).
- In SUMMARY, if the tape is sideways or drifting down while your DIRECTION is Up (or the opposite), call that tension out in plain language.
- Never claim certainty; this is opinionated scenario analysis.
- Output EXACTLY these lines and nothing else:
DIRECTION: Up|Down|Unclear
CONFIDENCE: 0-100
REGIME: up_slope|down_slope|sideways|mixed
SUMMARY: one or two sentences
FACTORS: bullet phrases separated by semicolons (max 6)
RISK: one sentence on oracle mismatch / noise / not advice`;

  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: tradeCycle ? 650 : 400,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    msg.content?.find((b) => b.type === "text")?.type === "text"
      ? (msg.content.find((b) => b.type === "text") as { type: "text"; text: string }).text
      : "";

  return parseAiLines(text);
}
