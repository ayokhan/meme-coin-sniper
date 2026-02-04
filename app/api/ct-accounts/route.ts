import { NextResponse } from 'next/server';
import {
  TIER_1_INFLUENCERS,
  TIER_2_INFLUENCERS,
  TIER_3_ECOSYSTEM,
  TIER_4_CULTURE,
  TIER_5_WHALES,
  TIER_6_NEWS,
  getAccountWeight,
  getAccountTier,
} from '@/lib/config/ct-influencers';

export async function GET() {
  const tiers = [
    { name: 'Elite Alpha', accounts: TIER_1_INFLUENCERS, weight: 3 },
    { name: 'Momentum', accounts: TIER_2_INFLUENCERS, weight: 2 },
    { name: 'Ecosystem', accounts: TIER_3_ECOSYSTEM, weight: 2.5 },
    { name: 'Culture', accounts: TIER_4_CULTURE, weight: 1.5 },
    { name: 'Whale', accounts: TIER_5_WHALES, weight: 2.5 },
    { name: 'News', accounts: TIER_6_NEWS, weight: 1 },
  ];
  const accounts = tiers.flatMap((t) =>
    t.accounts.map((username) => ({
      username,
      tier: getAccountTier(username),
      weight: getAccountWeight(username),
      url: `https://x.com/${username}`,
    }))
  );
  return NextResponse.json({ success: true, accounts, tiers });
}
