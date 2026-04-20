import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type NovaEagleAiBrief = {
  text: string;
  aiGenerated: boolean;
};

/**
 * Short educational summary from aggregated public position data (no claims of insider information).
 */
export async function summarizeNovaEagleForAi(payload: {
  aggregates: Array<{ coin: string; longUsd: number; shortUsd: number; whaleCount: number }>;
  heuristics: string[];
}): Promise<NovaEagleAiBrief> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      aiGenerated: false,
      text: "Configure ANTHROPIC_API_KEY on the server for an AI summary. Heuristic lines above still reflect aggregated public positions only.",
    };
  }

  const user = `You help traders read AGGREGATED HYPERLIQUID / PUBLIC TRACKED-WALLET POSITIONS (not all whales, not insider data).

Data (USD notionals, long vs short among large open positions on tracked wallets):
${JSON.stringify(payload.aggregates.slice(0, 12), null, 2)}

Heuristic notes already computed:
${payload.heuristics.slice(0, 8).join("\n")}

Write 3–5 sentences: (1) strongest skews by coin, (2) remind this is delayed/public snapshot, (3) risk disclaimer — not financial advice, no insider claims. No "they know something" language.`;

  const msg = await anthropic.messages.create({
    model: "claude-3-5-haiku-20241022",
    max_tokens: 400,
    messages: [{ role: "user", content: user }],
  });
  const block = msg.content[0];
  const text = block?.type === "text" ? block.text.trim() : "";
  return { text: text || "No AI summary returned.", aiGenerated: true };
}
