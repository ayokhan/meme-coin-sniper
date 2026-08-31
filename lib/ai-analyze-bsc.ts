import Anthropic from '@anthropic-ai/sdk';
import { CLAUDE_SONNET_MODEL } from '@/lib/anthropic-models';
import { getBscToken, getEthToken, getHyperEvmToken, getRobinhoodToken, extractSocials } from '@/lib/api-clients/dexscreener';
import {
  checkBscTokenSecurity,
  checkEthTokenSecurity,
  getSecuritySummary,
  getTopHolderPercentage,
  isLPLocked,
} from '@/lib/api-clients/goplus';
import { parseClaudeJsonResponse } from '@/lib/parse-claude-json';

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
    priceOutlook?: string;
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
    isHoneypot?: boolean | null;
    isMintable?: boolean | null;
    lpLocked?: boolean | null;
    topHolderPercent?: number | null;
    holderCount?: number | null;
  };
};

export type EvmAnalysisChain = 'bsc' | 'ethereum' | 'robinhood' | 'hyperevm';

const EVM_CHAIN_LABELS: Record<EvmAnalysisChain, string> = {
  bsc: 'BSC (Binance Smart Chain)',
  ethereum: 'Ethereum',
  robinhood: 'Robinhood Chain',
  hyperevm: 'HyperEVM',
};

async function getDexDataForChain(chain: EvmAnalysisChain, contractAddress: string) {
  if (chain === 'ethereum') return getEthToken(contractAddress);
  if (chain === 'robinhood') return getRobinhoodToken(contractAddress);
  if (chain === 'hyperevm') return getHyperEvmToken(contractAddress);
  return getBscToken(contractAddress);
}

export async function runAiAnalysisEvm(
  contractAddress: string,
  chain: EvmAnalysisChain = 'bsc',
  options?: { amountUsd?: number }
): Promise<AnalysisResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('NovaStaris AI Agent is not configured.');
  }

  const chainLabel = EVM_CHAIN_LABELS[chain];
  const hasGoPlus = chain === 'bsc' || chain === 'ethereum';
  const [dexData, securityData] = await Promise.all([
    getDexDataForChain(chain, contractAddress),
    hasGoPlus
      ? chain === 'ethereum'
        ? checkEthTokenSecurity(contractAddress)
        : checkBscTokenSecurity(contractAddress)
      : Promise.resolve(null),
  ]);

  if (!dexData) {
    throw new Error(
      `Token not found on DexScreener (${chainLabel}). Use the token contract address (0x + 40 hex). If you copied the DexScreener URL, try the token address shown under the token name on the page, or check for typos.`
    );
  }

  const socials = extractSocials(dexData);
  const liq = dexData.liquidity?.usd ?? 0;
  const vol24 = dexData.volume?.h24 ?? 0;
  const vol1h = dexData.volume?.h1 ?? dexData.volume?.h6 ?? vol24;
  const txns = dexData.txns?.h24 ?? dexData.txns?.h6 ?? dexData.txns?.h1;
  const priceChange = dexData.priceChange?.h24 ?? dexData.priceChange?.h6 ?? 0;
  const securitySummary = securityData ? getSecuritySummary(securityData) : { issues: [] as string[], warnings: [] as string[] };
  const topHolderPct = securityData ? getTopHolderPercentage(securityData) : 0;
  const holderCountRaw = securityData?.holder_count ? parseInt(securityData.holder_count, 10) : NaN;
  const holderCount = Number.isFinite(holderCountRaw) ? holderCountRaw : null;
  const mcap = dexData.fdv ?? undefined;

  const tokenSummary = {
    chain: chainLabel,
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
    pairCreatedAt: dexData.pairCreatedAt ? new Date(dexData.pairCreatedAt < 1e12 ? dexData.pairCreatedAt * 1000 : dexData.pairCreatedAt).toISOString() : null,
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

  const prompt = `You are an expert meme-coin analyst. Analyze this ${chainLabel} token and provide a score, signal, reasons, narrative assessment, AND trading levels.

Token data (JSON):
${JSON.stringify(tokenSummary, null, 2)}
${amountBlock}

NARRATIVE MATTERS: Meme coins are driven by narratives. A strong, viral narrative (viral tweet, community buzz, KOL endorsement, cultural moment, clear theme) often leads to massive volume and market cap. When scoring, treat narrative strength as a core factor: infer from token name/symbol, socials presence (Twitter, Telegram, website), and volume/activity as proxies for buzz. Weak or absent narrative = cap upside; strong narrative = higher potential.

Score (0-100): 0-25 = avoid, 26-50 = risky/speculative, 51-75 = moderate potential, 76-100 = stronger metrics. Factor in liquidity, volume, security (honeypot, mintable, top holder %), socials, price action, AND narrative strength (viral potential, community/KOL buzz).
Signal: "buy" only if score >= 51 and no critical security issues; otherwise "no_buy".
EVM meme coins are highly volatile; a good score now can change in minutes.

You MUST include:
- narrativeAssessment: one short line assessing the meme's narrative (e.g. "Strong: fits [trend], has Twitter/Telegram and volume suggests buzz" or "Weak: no clear story or community links" or "Moderate: theme present but need to confirm CT/KOL pickup"). This drives how much narrative should influence the score.

Also provide trading levels (infer from current price/mcap and volatility when no chart data):
- supportResistance: brief note on likely support and resistance (e.g. "Support near $X mcap; resistance at $Y" or "No clear levels; treat as speculative").
- marketStructure: one line on structure (e.g. "Consolidation", "Uptrend", "Distribution", "Unknown - too new").
- priceOutlook: spot-only price outlook (meme coins are buy/sell on DEX — no shorting). Use "Bullish outlook, moderate confidence" | "Bearish outlook — wait or avoid new entry" | "Neutral / unclear". Do NOT use "long", "short", or futures language.
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
    "priceOutlook": "<one line — bullish / bearish / neutral, spot only>",
    "trendlineRead": "<one line>",
    "demandSupplyZones": "<one line>",
    "buyZoneMcap": "<one line>",
    "takeProfitPct": "<one line>",
    "stopLossPct": "<one line>"
  }${amountUsd != null ? ',\n  "amountRiskNote": "<one line>"' : ''}
}
Keep reasons short. Include at least one reason that references narrative/viral potential when relevant. Include positives and negatives.`;

  type ParsedAnalysis = {
    score?: number;
    signal?: string;
    reasons?: string[];
    narrativeAssessment?: string;
    amountRiskNote?: string;
    recommendations?: {
      supportResistance?: string;
      marketStructure?: string;
      priceOutlook?: string;
      trendlineRead?: string;
      demandSupplyZones?: string;
      buyZoneMcap?: string;
      takeProfitPct?: string;
      stopLossPct?: string;
    };
  };

  let parsed: ParsedAnalysis = {};
  for (let attempt = 0; attempt < 2; attempt++) {
    const message = await anthropic.messages.create({
      model: CLAUDE_SONNET_MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
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
      isHoneypot: securityData ? securityData.is_honeypot === '1' : null,
      isMintable: securityData ? securityData.is_mintable === '1' : null,
      lpLocked: securityData ? isLPLocked(securityData) : null,
      topHolderPercent: securityData ? topHolderPct : null,
      holderCount,
    },
  };
}

export async function runAiAnalysisBsc(contractAddress: string, options?: { amountUsd?: number }): Promise<AnalysisResult> {
  return runAiAnalysisEvm(contractAddress, 'bsc', options);
}
