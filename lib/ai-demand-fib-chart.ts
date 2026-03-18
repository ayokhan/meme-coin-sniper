/**
 * Demand + Fib LONG playbook — vision analysis of uploaded chart (owner-only).
 */

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export type DemandFibChartResult = {
  setup: "LONG" | "NO_SETUP";
  confluenceScore: number;
  entry: string;
  sl: string;
  tp1: string;
  tp2: string;
  summary: string;
  reasons: string[];
  demandZoneNote?: string;
  fibNote?: string;
};

const PLAYBOOK = `
You apply the "Demand Zone + Deep Fibonacci" LONG playbook:
- HTF: horizontal demand zone at prior support; deep Fib retracement 76.4%–88.6% overlapping zone = confluence.
- LTF: bullish reaction (wick into zone, close above zone top / engulfing / pin bar).
- SL: below zone low. TP1 toward 50% Fib retrace of swing, TP2 toward 38.2%.
- If the chart does not clearly show this confluence or is not a bullish-reversal context, respond NO_SETUP.
Confluence score 0–1: only LONG if you see credible zone + fib overlap + recent bullish structure; else NO_SETUP (score < 0.55).
`;

export async function runDemandFibChartAnalysis(
  imageBase64: string,
  imageMediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif",
  symbolHint?: string
): Promise<DemandFibChartResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("Demand + Fib chart analysis is not configured (ANTHROPIC_API_KEY).");
  }

  const sym = symbolHint?.trim() ? `User says symbol/asset: ${symbolHint.trim()}` : "Symbol not specified—infer from chart if visible.";

  const prompt = `You are a technical analyst. The user uploaded a price chart.

${sym}

${PLAYBOOK}

From the chart image only, estimate visible levels (numbers with units if shown). If timeframes are visible, mention them briefly.

Respond ONLY with valid JSON (no markdown):
{
  "setup": "LONG" or "NO_SETUP",
  "confluenceScore": <number 0-1>,
  "entry": "<price or zone text>",
  "sl": "<price or zone>",
  "tp1": "<50% fib area or target>",
  "tp2": "<38.2% fib area or target>",
  "summary": "<1-3 sentences>",
  "reasons": ["<bullet>", "..."],
  "demandZoneNote": "<optional short note>",
  "fibNote": "<optional short note>"
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

  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1200,
    messages: [{ role: "user", content }],
  });

  const text = msg.content.find((b) => b.type === "text")?.text ?? "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Could not parse AI response.");
  }
  const parsed = JSON.parse(jsonMatch[0]) as Partial<DemandFibChartResult>;
  return {
    setup: parsed.setup === "LONG" ? "LONG" : "NO_SETUP",
    confluenceScore: typeof parsed.confluenceScore === "number" ? Math.min(1, Math.max(0, parsed.confluenceScore)) : 0,
    entry: String(parsed.entry ?? "—"),
    sl: String(parsed.sl ?? "—"),
    tp1: String(parsed.tp1 ?? "—"),
    tp2: String(parsed.tp2 ?? "—"),
    summary: String(parsed.summary ?? ""),
    reasons: Array.isArray(parsed.reasons) ? parsed.reasons.map(String) : [],
    demandZoneNote: parsed.demandZoneNote ? String(parsed.demandZoneNote) : undefined,
    fibNote: parsed.fibNote ? String(parsed.fibNote) : undefined,
  };
}
