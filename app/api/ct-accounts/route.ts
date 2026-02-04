import { NextResponse } from 'next/server';
import {
  TIER_1_INFLUENCERS,
  TIER_2_INFLUENCERS,
  TIER_3_ECOSYSTEM,
  TIER_4_CULTURE,
  TIER_5_WHALES,
  TIER_FOUNDERS,
  TIER_MEME_SOLANA,
  getAccountWeight,
} from '@/lib/config/ct-influencers';

export async function GET() {
  const tiers = [
    { name: 'Tier 1', accounts: TIER_1_INFLUENCERS, weight: 3 },
    { name: 'Tier 2', accounts: TIER_2_INFLUENCERS, weight: 2 },
    { name: 'Tier 3 Ecosystem', accounts: TIER_3_ECOSYSTEM, weight: 2.5 },
    { name: 'Tier 4 Culture', accounts: TIER_4_CULTURE, weight: 1.5 },
    { name: 'Tier 5 Whales', accounts: TIER_5_WHALES, weight: 2.5 },
    { name: 'Founders', accounts: TIER_FOUNDERS, weight: 3 },
    { name: 'Meme/Solana', accounts: TIER_MEME_SOLANA, weight: 1.8 },
  ];
  const accounts = tiers.flatMap((t) =>
    t.accounts.map((username) => ({
      username,
      tier: t.name,
      weight: getAccountWeight(username),
      url: `https://x.com/${username}`,
    }))
  );
  return NextResponse.json({ success: true, accounts, tiers });
}
