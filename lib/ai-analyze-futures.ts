import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export type FuturesAnalysisParams = {
  symbol: string;
  margin: number;
  leverage: number;
  tradeTimeframe: string;
  chartTimeframe: string;
  riskAmount?: number | null;
  direction?: 'long' | 'short' | null;
};

export type FuturesAnalysisResult = {
  score: number;
  signal: 'buy' | 'no_buy';
  reasons: string[];
  recommendations?: {
    supportResistance?: string;
    marketStructure?: string;
    entryZone?: string;
    takeProfitPct?: string;
    stopLossPct?: string;
  };
};

export async function runFuturesAnalysis(
  imageBase64: string,
  imageMediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif',
  params: FuturesAnalysisParams
): Promise<FuturesAnalysisResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('AI analysis is not configured.');
  }

  const riskLine = params.riskAmount != null && params.riskAmount > 0
    ? `Risk amount (max loss willing to take): $${params.riskAmount}`
    : 'Risk amount: not specified (optional)';
  const directionLine = params.direction
    ? `Direction: ${params.direction.toUpperCase()}`
    : 'Direction: not specified (analyze both long/short bias from chart)';

  const prompt = `You are an expert crypto futures and technical analysis specialist. The user has uploaded a price chart and provided the following trade context.

Trade context:
- Symbol: ${params.symbol}
- Margin (amount to invest): $${params.margin}
- Leverage: ${params.leverage}x
- Chart timeframe (what the chart shows): ${params.chartTimeframe}
- Trade timeframe (how long they plan to hold): ${params.tradeTimeframe}
- ${riskLine}
- ${directionLine}

Analyze the chart image and provide:
1. A score 0-100 (0-25 = avoid / poor setup, 26-50 = risky or weak structure, 51-75 = decent setup with clear levels, 76-100 = strong setup with confluence).
2. Signal: "buy" only if score >= 51 and the chart supports the intended direction; otherwise "no_buy".
3. Reasons: 4-8 short bullet points (mix of positives and negatives) covering: structure, key levels, momentum, risk/reward, and any caveats.
4. Trading levels (futures-style, price-based):
   - supportResistance: Clear support and resistance levels from the chart (use price levels, not market cap).
   - marketStructure: One line (e.g. "Higher highs and higher lows", "Range-bound", "Break of structure", "Consolidation before move").
   - entryZone: Recommended entry zone in price (e.g. "$97,000–$97,500" or "On pullback to $95,200–95,800"). For futures this is price-based.
   - takeProfitPct: Suggested take-profit as % from entry (e.g. "50–100%" or "1.5x–2x with leverage").
   - stopLossPct: Suggested stop-loss as % from entry (e.g. "-2% to -3%" or "Tight -1.5% for scalp").

Consider leverage: ${params.leverage}x means small price moves have large PnL impact. Tailor stop loss and take profit to the chart timeframe and trade timeframe.

Respond ONLY with valid JSON (no markdown, no code block):
{
  "score": <number 0-100>,
  "signal": "buy" or "no_buy",
  "reasons": [ "<short reason 1>", ... ],
  "recommendations": {
    "supportResistance": "<one line, price levels>",
    "marketStructure": "<one line>",
    "entryZone": "<one line, price zone>",
    "takeProfitPct": "<one line>",
    "stopLossPct": "<one line>"
  }
}
Keep reasons short and actionable.`;

  type ImageMediaType = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';
  const content = [
    {
      type: 'image' as const,
      source: {
        type: 'base64' as const,
        media_type: imageMediaType as ImageMediaType,
        data: imageBase64,
      },
    },
    { type: 'text' as const, text: prompt },
  ];

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 900,
    messages: [{ role: 'user', content }],
  });

  const responseText = message.content[0].type === 'text' ? message.content[0].text : '{}';
  const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed = JSON.parse(cleaned) as {
    score?: number;
    signal?: string;
    reasons?: string[];
    recommendations?: {
      supportResistance?: string;
      marketStructure?: string;
      entryZone?: string;
      takeProfitPct?: string;
      stopLossPct?: string;
    };
  };

  const score = typeof parsed.score === 'number' ? Math.min(100, Math.max(0, Math.round(parsed.score))) : 50;
  const signal = (parsed.signal ?? '').toLowerCase() === 'buy' ? 'buy' : 'no_buy';
  const reasons = Array.isArray(parsed.reasons) ? parsed.reasons.filter((r) => typeof r === 'string') : ['No reasons provided.'];
  const recommendations = parsed.recommendations && typeof parsed.recommendations === 'object' ? parsed.recommendations : undefined;

  return {
    score,
    signal,
    reasons,
    recommendations,
  };
}
