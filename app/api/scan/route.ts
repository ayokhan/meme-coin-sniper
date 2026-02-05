import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getNewSolanaPairs, getTrendingSolanaPairs, getSolanaToken, extractSocials, getQualityScore } from '@/lib/api-clients/dexscreener';
import { getNewListings, isBirdeyeConfigured } from '@/lib/api-clients/birdeye';
import { getNewPumpFunTokens, isMoralisConfigured } from '@/lib/api-clients/moralis';
import { checkSolanaTokenSecurity, calculateSecurityScore, getTopHolderPercentage, getSecuritySummary } from '@/lib/api-clients/goplus';
import { calculateViralScore } from '@/lib/utils/viral-score';
import { sendTokenAlerts } from '@/lib/telegram';
import type { DexPair } from '@/lib/api-clients/dexscreener';

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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const minScore = parseInt(searchParams.get('minScore') || '35');
    const maxPairs = parseInt(searchParams.get('maxPairs') || '25');
    const maxAge = parseInt(searchParams.get('maxAge') || '240');
    const source = searchParams.get('source') || (isBirdeyeConfigured() ? 'birdeye' : 'dexscreener');
    
    console.log(`🔍 Scanning with: minScore=${minScore}, maxPairs=${maxPairs}, source=${source}`);
    
    let pairs: DexPair[] = [];
    
    let dataSource: 'birdeye' | 'moralis' | 'dexscreener' = 'dexscreener';
    if (source === 'birdeye' && isBirdeyeConfigured()) {
      const newListings = await getNewListings(maxPairs * 2);
      console.log(`📊 Birdeye new_listing returned ${newListings.length} tokens`);
      for (const token of newListings.slice(0, maxPairs * 2)) {
        const pair = await getSolanaToken(token.address);
        if (pair) pairs.push(pair);
        await new Promise((r) => setTimeout(r, 200));
      }
      pairs = pairs.slice(0, maxPairs);
      if (pairs.length > 0) dataSource = 'birdeye';
      else {
        console.log('📊 Birdeye returned 0 tokens. Trying Moralis Pump.fun fallback...');
        if (isMoralisConfigured()) {
          const moralisTokens = await getNewPumpFunTokens(maxPairs * 2);
          console.log(`📊 Moralis Pump.fun fallback returned ${moralisTokens.length} tokens`);
        for (const token of moralisTokens.slice(0, maxPairs * 2)) {
          const pair = await getSolanaToken(token.address);
          if (pair) pairs.push(pair);
          await new Promise((r) => setTimeout(r, 200));
        }
        pairs = pairs.slice(0, maxPairs);
        if (pairs.length > 0) dataSource = 'moralis';
        } else {
          console.log('📊 Moralis skipped: set MORALIS_API_KEY in .env.local for Pump.fun new tokens.');
        }
      }
      console.log(`📊 Resolved ${pairs.length} pairs via DexScreener (source: ${dataSource})`);
    }
    if (pairs.length === 0) {
      // Prefer trending (active volume + price change) over raw search to avoid dead coins
      pairs = await getTrendingSolanaPairs(Math.max(maxPairs, 25));
      if (pairs.length === 0) {
        pairs = await getNewSolanaPairs(10000, maxAge);
      }
      dataSource = 'dexscreener';
      console.log(`📊 DexScreener returned ${pairs.length} pairs (trending first, then new)`);
    }
    
    const scanned: Awaited<ReturnType<typeof prisma.token.upsert>>[] = [];
    const skipped: Array<{ symbol: string; reason: string }> = [];
    // New listings (Birdeye/Moralis) often have low liquidity/volume — use looser filters
    const isNewListing = dataSource === 'birdeye' || dataSource === 'moralis';
    const qualityThreshold = isNewListing ? 0 : 10;
    const scoreThreshold = isNewListing ? 15 : Math.min(minScore, 28);
    
    for (const pair of pairs.slice(0, maxPairs)) {
      const quality = getQualityScore(pair);
      if (quality.score < qualityThreshold) {
        const reason = `Low quality (${quality.score})`;
        skipped.push({ symbol: pair.baseToken.symbol, reason });
        console.log(`⏭️ ${pair.baseToken.symbol}: ${reason}`);
        continue;
      }
      
      const securityData = await checkSolanaTokenSecurity(pair.baseToken.address);
      const securityScore = securityData ? calculateSecurityScore(securityData) : 40;
      const summary = securityData ? getSecuritySummary(securityData) : null;
      
      if (summary?.issues.length) {
        const reason = summary.issues.join(', ');
        skipped.push({ symbol: pair.baseToken.symbol, reason });
        console.log(`⏭️ ${pair.baseToken.symbol}: ${reason}`);
        continue;
      }
      
      const socials = extractSocials(pair);
      const ageMinutes = (Date.now() - pair.pairCreatedAt) / 60000;
      
      const viralScoreData = calculateViralScore({
        liquidity: pair.liquidity?.usd ?? 0,
        volume24h: pair.volume?.h24 ?? 0,
        priceChange24h: pair.priceChange?.h24 ?? pair.priceChange?.h6 ?? 0,
        ageMinutes,
        hasWebsite: !!socials.website,
        hasTwitter: !!socials.twitter,
        hasTelegram: !!socials.telegram,
        securityScore,
        topHolderPct: securityData ? getTopHolderPercentage(securityData) : 0,
        holderCount: parseInt(securityData?.holder_count || '0'),
        isHoneypot: false,
      });
      
      if (viralScoreData.total < scoreThreshold) {
        const reason = `Score too low (${viralScoreData.total}, need ${scoreThreshold})`;
        skipped.push({ symbol: pair.baseToken.symbol, reason });
        console.log(`⏭️ ${pair.baseToken.symbol}: ${reason}`);
        continue;
      }
      
      console.log(`✅ ${pair.baseToken.symbol}: ${viralScoreData.total}/100`);
      
      const token = await prisma.token.upsert({
        where: { contractAddress: pair.baseToken.address },
        create: {
          contractAddress: pair.baseToken.address,
          symbol: pair.baseToken.symbol,
          name: pair.baseToken.name,
          chain: 'solana',
          source: dataSource,
          dexId: pair.dexId,
          pairAddress: pair.pairAddress,
          liquidity: pair.liquidity?.usd ?? 0,
          priceUSD: parseFloat(pair.priceUsd ?? '0'),
          viralScore: viralScoreData.total,
          scoreBreakdown: viralScoreData as any,
          isHoneypot: false,
          website: socials.website,
          twitter: socials.twitter,
          telegram: socials.telegram,
          launchedAt: new Date(pair.pairCreatedAt),
        },
        update: { viralScore: viralScoreData.total, source: dataSource },
      });
      
      scanned.push(token);
    }

    if (scanned.length > 0) {
      sendTokenAlerts(
        (scanned as ScannedToken[]).map((t: ScannedToken) => ({
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
    
    console.log(`📈 Scanned: ${scanned.length}, Skipped: ${skipped.length}`);
    
    const hint =
      dataSource === 'birdeye'
        ? 'New listings (catch before viral).'
        : dataSource === 'moralis'
          ? 'New listings from Pump.fun.'
          : 'Using popular tokens from DexScreener.';
    return NextResponse.json({
      success: true,
      source: dataSource,
      tokens: scanned,
      stats: {
        pairsFound: pairs.length,
        scanned: scanned.length,
        skipped: skipped.length,
        skippedSample: skipped.slice(0, 5),
      },
      hint,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
