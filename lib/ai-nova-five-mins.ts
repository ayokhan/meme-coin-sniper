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
 * Claude reads compact OHLC context and returns a directional lean for a *hypothetical* next few minutes,
 * aligned with Polymarket-style Up/Down framing (not a guarantee).
 */
export async function runNovaFiveMinsAnalysis(marketFacts: string, symbolLabel: string): Promise<NovaFiveMinsAiResult> {
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

  const prompt = `You are a disciplined crypto microstructure analyst helping VIP users think about VERY short-horizon (roughly 1–5 minute) direction, similar in spirit to Polymarket "Up or Down in 5 minutes" style markets.

Context (spot 1m candles — NOT the same oracle Polymarket uses; Polymarket often resolves on Chainlink BTC/USD streams):
${marketFacts}

Asset label: ${symbolLabel}

Task: Based ONLY on the numbers above (momentum, micro-range, last candle bias), lean Up or Down for the *next few minutes* of spot movement, or Unclear if noise dominates.

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
    max_tokens: 400,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    msg.content?.find((b) => b.type === "text")?.type === "text"
      ? (msg.content.find((b) => b.type === "text") as { type: "text"; text: string }).text
      : "";

  return parseAiLines(text);
}
