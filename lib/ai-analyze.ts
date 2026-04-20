import Anthropic from '@anthropic-ai/sdk';
import { getSolanaToken, extractSocials } from '@/lib/api-clients/dexscreener';
import { checkSolanaTokenSecurity, getSecuritySummary, getTopHolderPercentage } from '@/lib/api-clients/goplus';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export type AnalysisResult = {
  score: number;
  signal: 'buy' | 'no_buy';
  reasons: string[];
  narrativeAssessment?: string;
  amountRiskNote?: string;
  recommendations?: {
    supportResistance?: string;
    marketStructure?: string;
    directionBias?: string;
    trendlineRead?: string;
    demandSupplyZones?: string;
    buyZoneMcap?: string;
    takeProfitPct?: string;
    stopLossPct?: string;
  };
  tokenInfo: {
    symbol?: string;
    name?: string;
    contractAddress: string;
    liquidityUsd?: number;
    volume24h?: number;
    priceUsd?: number | null;
    priceChange24hPct?: number;
    marketCapUsd?: number | null;
    hasTwitter?: boolean;
    hasTelegram?: boolean;
    hasWebsite?: boolean;
    securityIssues?: string[];
    securityWarnings?: string[];
  };
};

export async function runAiAnalysis(contractAddress: string, options?: { amountUsd?: number }): Promise<AnalysisResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('NovaStaris AI Agent is not configured.');
  }

  const [dexData, securityData] = await Promise.all([
    getSolanaToken(contractAddress),
    checkSolanaTokenSecurity(contractAddress),
  ]);

  if (!dexData) {
    throw new Error('Token not found on DexScreener.');
  }

  const socials = extractSocials(dexData);
  const liq = dexData.liquidity?.usd ?? 0;
  const vol24 = dexData.volume?.h24 ?? 0;
  const vol1h = dexData.volume?.h1 ?? dexData.volume?.h6 ?? vol24;
  const txns = dexData.txns?.h24 ?? dexData.txns?.h6 ?? dexData.txns?.h1;
  const priceChange = dexData.priceChange?.h24 ?? dexData.priceChange?.h6 ?? 0;
  const securitySummary = securityData ? getSecuritySummary(securityData) : { issues: [] as string[], warnings: [] as string[] };
  const topHolderPct = securityData ? getTopHolderPercentage(securityData) : 0;
  const mcap = dexData.fdv ?? undefined;

  const tokenSummary = {
    symbol: dexData.baseToken.symbol,
    name: dexData.baseToken.name,
    contractAddress: dexData.baseToken.address,
    liquidityUsd: liq,
    volume24h: vol24,
    volume1h: vol1h,
    priceUsd: dexData.priceUsd ? parseFloat(dexData.priceUsd) : null,
    marketCapUsd: mcap,
    priceChange24hPct: priceChange,
    txns24h: txns ? { buys: txns.buys, sells: txns.sells, total: txns.buys + txns.sells } : null,
    pairCreatedAt: dexData.pairCreatedAt ? new Date(dexData.pairCreatedAt).toISOString() : null,
    hasTwitter: !!socials.twitter,
    hasTelegram: !!socials.telegram,
    hasWebsite: !!socials.website,
    security: {
      isHoneypot: securityData?.is_honeypot === '1',
      isMintable: securityData?.is_mintable === '1',
      topHolderPercent: topHolderPct,
      issues: securitySummary.issues,
      warnings: securitySummary.warnings,
    },
  };

  const amountUsd = options?.amountUsd != null && Number.isFinite(options.amountUsd) && options.amountUsd > 0 ? options.amountUsd : null;
  const amountBlock = amountUsd != null
    ? `\nThe user is considering investing $${amountUsd.toLocaleString()}. Add a field "amountRiskNote": one short line saying whether this amount is too risky given liquidity/mcap (e.g. "Investing $500 in a $20k liquidity pool is very risky — consider a smaller size" or "Amount is reasonable relative to liquidity").\n`
    : '';

  const prompt = `You are an expert meme-coin analyst. Analyze this Solana token and provide a score, signal, reasons, narrative assessment, AND trading levels.

Token data (JSON):
${JSON.stringify(tokenSummary, null, 2)}
${amountBlock}

NARRATIVE MATTERS: Meme coins are driven by narratives. A strong, viral narrative (viral tweet, community buzz, KOL endorsement, cultural moment, clear theme) often leads to massive volume and market cap. When scoring, treat narrative strength as a core factor: infer from token name/symbol, socials presence (Twitter, Telegram, website), and volume/activity as proxies for buzz. Weak or absent narrative = cap upside; strong narrative = higher potential.

Score (0-100): 0-25 = avoid, 26-50 = risky/speculative, 51-75 = moderate potential, 76-100 = stronger metrics. Factor in liquidity, volume, security (honeypot, mintable, top holder %), socials, price action, AND narrative strength (viral potential, community/KOL buzz).
Signal: "buy" only if score >= 51 and no critical security issues; otherwise "no_buy".
Meme coins are highly volatile; a good score now can change in minutes.

You MUST include:
- narrativeAssessment: one short line assessing the meme's narrative (e.g. "Strong: fits [trend], has Twitter/Telegram and volume suggests buzz" or "Weak: no clear story or community links" or "Moderate: theme present but need to confirm CT/KOL pickup"). This drives how much narrative should influence the score.

Also provide trading levels (infer from current price/mcap and volatility when no chart data):
- supportResistance: brief note on likely support and resistance (e.g. "Support near $X mcap; resistance at $Y" or "No clear levels; treat as speculative").
- marketStructure: one line on structure (e.g. "Consolidation", "Uptrend", "Distribution", "Unknown - too new").
- directionBias: one line with directional call and confidence (e.g. "Long bias, moderate confidence" / "Short bias, low confidence" / "Neutral").
- trendlineRead: one line on trendline-style read using swing highs/lows in available data (e.g. "Rising trendline intact", "Trendline break risk", "No clear trendline").
- demandSupplyZones: one line naming nearest demand/supply zones inferred from recent structure (or "No clear zones / too noisy").
- buyZoneMcap: recommended market cap zone to consider buying (e.g. "Under $500k" or "Pullback to $200k-$300k"), or "Not recommended" if no_buy.
- takeProfitPct: suggested take-profit as % from entry (e.g. "50-100%" or "2x-3x").
- stopLossPct: suggested stop-loss as % from entry (e.g. "-30%" or "Tight -20% for memes").
${amountUsd != null ? '- amountRiskNote: one line on whether investing the stated amount is too risky given liquidity/mcap.' : ''}

Respond ONLY with valid JSON (no markdown, no code block):
{
  "score": <number 0-100>,
  "signal": "buy" or "no_buy",
  "reasons": [ "<short reason 1>", ... ],
  "narrativeAssessment": "<one line on narrative strength / viral potential>",
  "recommendations": {
    "supportResistance": "<one line>",
    "marketStructure": "<one line>",
    "directionBias": "<one line>",
    "trendlineRead": "<one line>",
    "demandSupplyZones": "<one line>",
    "buyZoneMcap": "<one line>",
    "takeProfitPct": "<one line>",
    "stopLossPct": "<one line>"
  }${amountUsd != null ? ',\n  "amountRiskNote": "<one line>"' : ''}
}
Keep reasons short. Include at least one reason that references narrative/viral potential when relevant. Include positives and negatives.`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 700,
    messages: [{ role: 'user', content: prompt }],
  });

  const responseText = message.content[0].type === 'text' ? message.content[0].text : '{}';
  const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed = JSON.parse(cleaned) as {
    score?: number;
    signal?: string;
    reasons?: string[];
    narrativeAssessment?: string;
    amountRiskNote?: string;
    recommendations?: {
      supportResistance?: string;
      marketStructure?: string;
      directionBias?: string;
      trendlineRead?: string;
      demandSupplyZones?: string;
      buyZoneMcap?: string;
      takeProfitPct?: string;
      stopLossPct?: string;
    };
  };

  const score = typeof parsed.score === 'number' ? Math.min(100, Math.max(0, Math.round(parsed.score))) : 50;
  const signal = (parsed.signal ?? '').toLowerCase() === 'buy' ? 'buy' : 'no_buy';
  const reasons = Array.isArray(parsed.reasons) ? parsed.reasons.filter((r) => typeof r === 'string') : ['No reasons provided.'];
  const narrativeAssessment = typeof parsed.narrativeAssessment === 'string' ? parsed.narrativeAssessment.trim().slice(0, 400) : undefined;
  const amountRiskNote = typeof parsed.amountRiskNote === 'string' ? parsed.amountRiskNote.trim().slice(0, 500) : undefined;
  const recommendations = parsed.recommendations && typeof parsed.recommendations === 'object' ? parsed.recommendations : undefined;

  return {
    score,
    signal,
    reasons,
    narrativeAssessment: narrativeAssessment || undefined,
    amountRiskNote: amountRiskNote || undefined,
    recommendations,
    tokenInfo: {
      symbol: tokenSummary.symbol,
      name: tokenSummary.name,
      contractAddress: tokenSummary.contractAddress,
      liquidityUsd: tokenSummary.liquidityUsd,
      volume24h: tokenSummary.volume24h,
      priceUsd: tokenSummary.priceUsd,
      priceChange24hPct: tokenSummary.priceChange24hPct,
      marketCapUsd: tokenSummary.marketCapUsd ?? null,
      hasTwitter: tokenSummary.hasTwitter,
      hasTelegram: tokenSummary.hasTelegram,
      hasWebsite: tokenSummary.hasWebsite,
      securityIssues: tokenSummary.security.issues,
      securityWarnings: tokenSummary.security.warnings,
    },
  };
}
