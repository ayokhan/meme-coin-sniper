import Anthropic from '@anthropic-ai/sdk';
import { CLAUDE_SONNET_MODEL } from '@/lib/anthropic-models';
import { parseClaudeJsonResponse } from '@/lib/parse-claude-json';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export type ChartAnalysisType = 'perp' | 'meme';

export type FuturesAnalysisParams = {
  chartType: ChartAnalysisType;
  symbol: string;
  margin: number;
  leverage?: number | null;
  tradeTimeframe: string;
  chartTimeframe: string;
  riskAmount?: number | null;
  direction?: 'long' | 'short' | null;
};

export type FuturesAnalysisResult = {
  chartType: ChartAnalysisType;
  score: number;
  signal: 'buy' | 'no_buy';
  tradeDirection?: 'long' | 'short';
  reasons: string[];
  recommendations?: {
    supportResistance?: string;
    marketStructure?: string;
    entryZone?: string;
    takeProfitPct?: string;
    stopLossPct?: string;
  };
};

function buildPerpPrompt(params: FuturesAnalysisParams): string {
  const leverage = params.leverage ?? 10;
  const riskLine =
    params.riskAmount != null && params.riskAmount > 0
      ? `Risk amount (max loss willing to take): $${params.riskAmount}`
      : 'Risk amount: not specified (optional)';
  const directionLine = params.direction
    ? `Direction: ${params.direction.toUpperCase()}`
    : 'Direction: not specified (analyze both long/short bias from chart)';

  return `You are an expert crypto futures and technical analysis specialist. The user has uploaded a perp/futures price chart and provided the following trade context.

Trade context:
- Symbol: ${params.symbol}
- Margin (amount to invest): $${params.margin}
- Leverage: ${leverage}x
- Chart timeframe (what the chart shows): ${params.chartTimeframe}
- Trade timeframe (how long they plan to hold): ${params.tradeTimeframe}
- ${riskLine}
- ${directionLine}

Analyze the chart image and provide:
1. A score 0-100 (0-25 = avoid / poor setup, 26-50 = risky or weak structure, 51-75 = decent setup with clear levels, 76-100 = strong setup with confluence).
2. Signal: "buy" only if score >= 51 and the chart supports the intended direction; otherwise "no_buy".
3. tradeDirection: When the user asked to "analyze both", you MUST recommend whether to trade LONG or SHORT. Set "tradeDirection" to "long" or "short". When the user already chose a direction, set tradeDirection accordingly.
4. Reasons: 4-8 short bullet points covering structure, key levels, momentum, risk/reward, and caveats.
5. Trading levels (futures-style, price-based):
   - supportResistance, marketStructure, entryZone, takeProfitPct, stopLossPct

Consider leverage: ${leverage}x means small price moves have large PnL impact.

Respond ONLY with valid JSON (no markdown):
{
  "score": <number 0-100>,
  "signal": "buy" or "no_buy",
  "tradeDirection": "long" or "short",
  "reasons": [ "..." ],
  "recommendations": {
    "supportResistance": "...",
    "marketStructure": "...",
    "entryZone": "...",
    "takeProfitPct": "...",
    "stopLossPct": "..."
  }
}`;
}

function buildMemeChartPrompt(params: FuturesAnalysisParams): string {
  const leverage = params.leverage != null && params.leverage > 0 ? params.leverage : null;
  const riskLine =
    params.riskAmount != null && params.riskAmount > 0
      ? `Risk amount (max loss willing to take): $${params.riskAmount}`
      : 'Risk amount: not specified (optional)';
  const leverageLine = leverage
    ? `Leverage (if applicable): ${leverage}x`
    : 'Leverage: spot / not using leverage';

  return `You are an expert meme-coin and spot technical analysis specialist. The user uploaded a screenshot from Dexscreener, Axiom, pump.fun, or similar — NOT a perp chart. This is a spot meme coin chart. Do NOT recommend shorting.

Trade context:
- Token / symbol: ${params.symbol}
- Amount to invest: $${params.margin}
- ${leverageLine}
- Chart timeframe (what the chart shows): ${params.chartTimeframe}
- Trade timeframe (how long they plan to hold): ${params.tradeTimeframe}
- ${riskLine}

Analyze the chart image and provide:
1. A score 0-100 for setup quality (0-25 = avoid, 26-50 = weak/risky, 51-75 = decent, 76-100 = strong).
2. Signal: "buy" if score >= 51 and the chart supports a spot long entry; otherwise "no_buy". No shorting on spot memes.
3. Reasons: 4-8 bullets — structure, S/R, momentum, liquidity/volatility warnings, rug/chase risks visible from the chart context.
4. Trading levels (price-based from the chart):
   - supportResistance: key support and resistance (price levels from the chart).
   - marketStructure: one line (trend, range, breakout, etc.).
   - entryZone: where to consider entering (price zone).
   - takeProfitPct: take-profit target as % from entry.
   - stopLossPct: stop-loss as % from entry.

Do NOT include tradeDirection. Spot memes are buy or wait only.

Respond ONLY with valid JSON (no markdown):
{
  "score": <number 0-100>,
  "signal": "buy" or "no_buy",
  "reasons": [ "..." ],
  "recommendations": {
    "supportResistance": "...",
    "marketStructure": "...",
    "entryZone": "...",
    "takeProfitPct": "...",
    "stopLossPct": "..."
  }
}`;
}

export async function runFuturesAnalysis(
  imageBase64: string,
  imageMediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif',
  params: FuturesAnalysisParams
): Promise<FuturesAnalysisResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('NovaStaris AI Agent is not configured.');
  }

  const chartType = params.chartType === 'meme' ? 'meme' : 'perp';
  const prompt = chartType === 'meme' ? buildMemeChartPrompt(params) : buildPerpPrompt(params);

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

  type ParsedAnalysis = {
    score?: number;
    signal?: string;
    tradeDirection?: string;
    reasons?: string[];
    recommendations?: {
      supportResistance?: string;
      marketStructure?: string;
      entryZone?: string;
      takeProfitPct?: string;
      stopLossPct?: string;
    };
  };

  let parsed: ParsedAnalysis = {};
  for (let attempt = 0; attempt < 2; attempt++) {
    const message = await anthropic.messages.create({
      model: CLAUDE_SONNET_MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content }],
    });
    const responseText = message.content[0].type === 'text' ? message.content[0].text : '{}';
    try {
      parsed = parseClaudeJsonResponse<ParsedAnalysis>(responseText);
      break;
    } catch (e) {
      if (attempt === 1) throw e;
    }
  }

  const score = typeof parsed.score === 'number' ? Math.min(100, Math.max(0, Math.round(parsed.score))) : 50;
  const signal = (parsed.signal ?? '').toLowerCase() === 'buy' ? 'buy' : 'no_buy';
  const tradeDirectionRaw = (parsed.tradeDirection ?? '').toLowerCase();
  const tradeDirection =
    chartType === 'perp' && (tradeDirectionRaw === 'long' || tradeDirectionRaw === 'short')
      ? tradeDirectionRaw
      : undefined;
  const reasons = Array.isArray(parsed.reasons) ? parsed.reasons.filter((r) => typeof r === 'string') : ['No reasons provided.'];
  const recommendations = parsed.recommendations && typeof parsed.recommendations === 'object' ? parsed.recommendations : undefined;

  return {
    chartType,
    score,
    signal,
    tradeDirection,
    reasons,
    recommendations,
  };
}
