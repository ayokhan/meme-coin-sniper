import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { detectViralTokens } from '@/lib/api-clients/twitter';
import { getSolanaToken, extractSocials } from '@/lib/api-clients/dexscreener';
import { searchTokenBySymbol } from '@/lib/api-clients/birdeye';
import { checkSolanaTokenSecurity, calculateSecurityScore, getTopHolderPercentage } from '@/lib/api-clients/goplus';
import { calculateViralScore } from '@/lib/utils/viral-score';
import { sendTokenAlerts } from '@/lib/telegram';

type ScannedToken = {
  symbol: string;
  name: string;
  contractAddress: string;
  viralScore: number;
  liquidity: number | null;
  priceUSD: number | null;
  pairAddress: string | null;
  twitter: string | null;
  telegram: string | null;
  website: string | null;
};

export async function GET() {
  try {
    if (!process.env.APIFY_API_TOKEN) {
      return NextResponse.json({
        success: false,
        error: 'Twitter scan is not available right now. Please try again later.',
      }, { status: 503 });
    }
    const viralTokens = await detectViralTokens();
    const scanned: Awaited<ReturnType<typeof prisma.token.upsert>>[] = [];

    // Resolve $TICKER to contract address when missing (most CT tweets use $SYMBOL not CA)
    for (const viral of viralTokens) {
      if (!viral.contractAddress && viral.token) {
        const symbol = viral.token.replace(/^\$/, '').trim();
        if (symbol.length >= 2 && symbol.length <= 10) {
          const address = await searchTokenBySymbol(symbol);
          if (address) (viral as { contractAddress?: string }).contractAddress = address;
          await new Promise((r) => setTimeout(r, 300)); // avoid Birdeye rate limit
        }
      }
    }

    for (const viral of viralTokens) {
      if (!viral.contractAddress) continue;
      
      const dexData = await getSolanaToken(viral.contractAddress);
      if (!dexData) continue;
      
      const securityData = await checkSolanaTokenSecurity(viral.contractAddress);
      if (securityData?.is_honeypot === '1') continue;
      
      const socials = extractSocials(dexData);
      const viralScoreData = calculateViralScore({
        liquidity: dexData.liquidity?.usd ?? 0,
        volume24h: dexData.volume?.h24 ?? 0,
        priceChange24h: dexData.priceChange?.h24 ?? 0,
        ageMinutes: (Date.now() - dexData.pairCreatedAt) / 60000,
        hasWebsite: !!socials.website,
        hasTwitter: !!socials.twitter,
        hasTelegram: !!socials.telegram,
        securityScore: securityData ? calculateSecurityScore(securityData) : 40,
        topHolderPct: securityData ? getTopHolderPercentage(securityData) : 0,
        holderCount: parseInt(securityData?.holder_count || '0'),
        isHoneypot: false,
        twitterScore: viral.twitterScore,
        twitterMentions: viral.mentions,
      });
      
      const token = await prisma.token.upsert({
        where: { contractAddress: viral.contractAddress },
        create: {
          contractAddress: viral.contractAddress,
          symbol: dexData.baseToken.symbol,
          name: dexData.baseToken.name,
          chain: 'solana',
          source: 'twitter',
          dexId: dexData.dexId,
          pairAddress: dexData.pairAddress,
          liquidity: dexData.liquidity?.usd ?? 0,
          priceUSD: parseFloat(dexData.priceUsd ?? '0'),
          viralScore: viralScoreData.total,
          scoreBreakdown: { ...viralScoreData, twitterData: { mentions: viral.mentions, uniqueAccounts: viral.uniqueAccounts, sentiment: viral.sentiment } } as any,
          isHoneypot: false,
          website: socials.website,
          twitter: socials.twitter,
          telegram: socials.telegram,
          launchedAt: new Date(dexData.pairCreatedAt),
        },
        update: {
          viralScore: viralScoreData.total,
          source: 'twitter',
          scoreBreakdown: { ...viralScoreData, twitterData: { mentions: viral.mentions, uniqueAccounts: viral.uniqueAccounts, sentiment: viral.sentiment } } as any,
        },
      });
      
      scanned.push(token);
    }

    if (scanned.length > 0) {
      sendTokenAlerts(
        (scanned as ScannedToken[]).map((t) => ({
          symbol: t.symbol,
          name: t.name,
          contractAddress: t.contractAddress,
          viralScore: t.viralScore,
          liquidity: t.liquidity,
          priceUSD: t.priceUSD,
          pairAddress: t.pairAddress,
          twitter: t.twitter,
          telegram: t.telegram,
          website: t.website,
        }))
      ).catch((e) => console.error('Telegram alerts error:', e));
    }
    
    return NextResponse.json({ success: true, tokens: scanned });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
