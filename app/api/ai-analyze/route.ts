import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getSolanaToken, extractSocials } from '@/lib/api-clients/dexscreener';
import { checkSolanaTokenSecurity, getSecuritySummary, getTopHolderPercentage } from '@/lib/api-clients/goplus';
import { getSessionAndSubscription } from '@/lib/auth-server';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

function isValidSolanaAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  const trimmed = address.trim();
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed);
}

export async function POST(request: Request) {
  try {
    const { isPaid } = await getSessionAndSubscription();
    if (!isPaid) {
      return NextResponse.json({ success: false, error: 'Subscribe to use NovaStaris AI Analysis.', locked: true }, { status: 403 });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'AI analysis is not available right now. Please try again later.' },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const contractAddress = (body.contractAddress ?? body.ca ?? '').trim();
    if (!contractAddress) {
      return NextResponse.json(
        { success: false, error: 'Missing contractAddress or ca in request body.' },
        { status: 400 }
      );
    }
    if (!isValidSolanaAddress(contractAddress)) {
      return NextResponse.json(
        { success: false, error: 'Invalid Solana contract address.' },
        { status: 400 }
      );
    }

    const [dexData, securityData] = await Promise.all([
      getSolanaToken(contractAddress),
      checkSolanaTokenSecurity(contractAddress),
    ]);

    if (!dexData) {
      return NextResponse.json(
        { success: false, error: 'Token not found on DexScreener. Check the contract address.' },
        { status: 404 }
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

    const tokenSummary = {
      symbol: dexData.baseToken.symbol,
      name: dexData.baseToken.name,
      contractAddress: dexData.baseToken.address,
      liquidityUsd: liq,
      volume24h: vol24,
      volume1h: vol1h,
      priceUsd: dexData.priceUsd ? parseFloat(dexData.priceUsd) : null,
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

    const prompt = `You are a meme-coin analyst. Based on the following on-chain and security data for a Solana token, give a single overall score from 0 to 100 and clear reasons.

Token data (JSON):
${JSON.stringify(tokenSummary, null, 2)}

Score meaning: 0–25 = avoid, 26–50 = risky/speculative, 51–75 = moderate potential, 76–100 = strong metrics / lower risk.

Also give a clear signal: "buy" only if you would consider buying (e.g. score >= 51, no critical security issues). Use "no_buy" if avoid or too risky.

Respond ONLY with valid JSON (no markdown, no code block):
{
  "score": <number 0-100>,
  "signal": "buy" or "no_buy",
  "reasons": [ "<reason 1>", "<reason 2>", ... ]
}
Keep reasons short (one line each). Include both positives and negatives. Mention liquidity, volume, security (honeypot/mintable/top holder), socials, and price action where relevant.`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '{}';
    const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned) as { score?: number; signal?: string; reasons?: string[] };
    const score = typeof parsed.score === 'number' ? Math.min(100, Math.max(0, Math.round(parsed.score))) : 50;
    const signal = (parsed.signal ?? '').toLowerCase() === 'buy' ? 'buy' : 'no_buy';
    const reasons = Array.isArray(parsed.reasons) ? parsed.reasons.filter((r) => typeof r === 'string') : ['No reasons provided.'];

    return NextResponse.json({
      success: true,
      score,
      signal,
      reasons,
      tokenInfo: {
        symbol: tokenSummary.symbol,
        name: tokenSummary.name,
        contractAddress: tokenSummary.contractAddress,
        liquidityUsd: tokenSummary.liquidityUsd,
        volume24h: tokenSummary.volume24h,
        priceUsd: tokenSummary.priceUsd,
        priceChange24hPct: tokenSummary.priceChange24hPct,
        hasTwitter: tokenSummary.hasTwitter,
        hasTelegram: tokenSummary.hasTelegram,
        hasWebsite: tokenSummary.hasWebsite,
        securityIssues: tokenSummary.security.issues,
        securityWarnings: tokenSummary.security.warnings,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'AI analysis failed';
    console.error('AI analyze error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
