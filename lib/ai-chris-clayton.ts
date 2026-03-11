/**
 * Chris Clayton Strategy — dedicated SHORT-setup analysis for crypto futures / gold.
 * Uses fixed rules; does not call or affect other NovaStaris AI models.
 */

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export type ChrisClaytonParams = {
  symbol?: string; // e.g. BTCUSDT, XAUUSD
  assetType?: "crypto" | "gold";
};

export type ChrisClaytonResult = {
  signal: "SHORT" | "NO_SETUP";
  confluenceScore: number;
  entry: string;
  tp1: string;
  tp2: string;
  sl: string;
  componentScores?: {
    descendingChannel?: number;
    keyLevel?: number;
    vShape?: number;
    candleRejection?: number;
    momentum?: number;
  };
  summary: string;
  reasons: string[];
};

const RULES = `
Strategy rules (do not change):
- Channel slope between -0.0005 and -0.00001, R² ≥ 0.65
- Price within 0.2% of upper channel trendline
- Key resistance level within 0.2% above price
- V-shape bounce 45–100% retracement
- Confluence score ≥ 0.65 to trigger SHORT
- SL = 0.2% above resistance, TP2 = 2R minimum

Pattern weights: Descending Channel 30%, Key Level 25%, V-Shape Bounce 20%, Candle Rejection 15%, Momentum 10%.
Trade rules: SL placed 0.2% above resistance zone high; TP1 at 1R (close 50%), TP2 at 2R (close remaining 50%).
`;

export async function runChrisClaytonStrategy(
  imageBase64: string,
  imageMediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif",
  params: ChrisClaytonParams
): Promise<ChrisClaytonResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("Chris Clayton Strategy is not configured.");
  }

  const symbolLine = params.symbol ? `Symbol/asset: ${params.symbol}` : "Symbol: not specified (crypto futures or gold).";
  const assetLine = params.assetType ? `Asset type: ${params.assetType}` : "Asset type: crypto or gold (infer from chart if possible).";

  const prompt = `You are a technical analysis expert applying the Chris Clayton Strategy for SHORT setups only. The user has uploaded a price chart.

${symbolLine}
${assetLine}

${RULES}

Analyze the chart image and:
1. Check for a descending channel (negative regression slope, R² ≥ 0.65), price within 0.2% of upper trendline.
2. Identify key resistance (prior swing high clustering) within 0.2% above price.
3. Look for a V-shaped move: sharp drop then bounce with 45–100% retracement.
4. Prefer bearish rejection candle (upper wick ≥ 40% of range).
5. Confirm negative 3-bar momentum.
Compute a confluence score 0–1 from the component weights (Descending Channel 30%, Key Level 25%, V-Shape 20%, Candle Rejection 15%, Momentum 10%). Only output signal "SHORT" if confluence ≥ 0.65; otherwise "NO_SETUP".
Provide entry price/zone, TP1 (1R), TP2 (2R), and SL (0.2% above resistance high). Give a short summary and 3–6 bullet reasons.

Respond ONLY with valid JSON (no markdown, no code block):
{
  "signal": "SHORT" or "NO_SETUP",
  "confluenceScore": <number 0–1>,
  "entry": "<price or zone>",
  "tp1": "<price or level>",
  "tp2": "<price or level>",
  "sl": "<price or level>",
  "componentScores": {
    "descendingChannel": <0–1>,
    "keyLevel": <0–1>,
    "vShape": <0–1>,
    "candleRejection": <0–1>,
    "momentum": <0–1>
  },
  "summary": "<one or two sentences>",
  "reasons": [ "<reason 1>", "<reason 2>", ... ]
}`;

  const content = [
    {
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: imageMediaType,
        data: imageBase64,
      },
    },
    { type: "text" as const, text: prompt },
  ];

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 800,
    messages: [{ role: "user", content }],
  });

  const responseText = message.content[0].type === "text" ? message.content[0].text : "{}";
  const cleaned = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const parsed = JSON.parse(cleaned) as {
    signal?: string;
    confluenceScore?: number;
    entry?: string;
    tp1?: string;
    tp2?: string;
    sl?: string;
    componentScores?: Record<string, number>;
    summary?: string;
    reasons?: string[];
  };

  const signalRaw = (parsed.signal ?? "").toUpperCase();
  const signal = signalRaw === "SHORT" ? "SHORT" : "NO_SETUP";
  const confluenceScore = typeof parsed.confluenceScore === "number" ? Math.min(1, Math.max(0, parsed.confluenceScore)) : 0;
  const entry = typeof parsed.entry === "string" ? parsed.entry.trim() : "—";
  const tp1 = typeof parsed.tp1 === "string" ? parsed.tp1.trim() : "—";
  const tp2 = typeof parsed.tp2 === "string" ? parsed.tp2.trim() : "—";
  const sl = typeof parsed.sl === "string" ? parsed.sl.trim() : "—";
  const summary = typeof parsed.summary === "string" ? parsed.summary.trim() : "";
  const reasons = Array.isArray(parsed.reasons) ? parsed.reasons.filter((r) => typeof r === "string") : [];
  const componentScores = parsed.componentScores && typeof parsed.componentScores === "object" ? parsed.componentScores : undefined;

  return {
    signal,
    confluenceScore,
    entry,
    tp1,
    tp2,
    sl,
    componentScores,
    summary,
    reasons,
  };
}
