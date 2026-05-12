import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import { FEATURE_FLAG_KEYS, getFeatureFlag } from "@/lib/feature-flags";
import { getTrackedWallets } from "@/lib/wallet-tracker-config";
import { discoverSmartMoneyCandidates } from "@/lib/api-clients/helius-discovery";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function intParam(url: URL, key: string): number | undefined {
  const raw = url.searchParams.get(key);
  if (raw == null) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

/** POST - Discover smart-money candidates. Owner-only. Free APIs (Dexscreener + Helius free tier).
 *
 * Tunable query-string params (all optional):
 *   ?maxPairs=25            number of trending pairs to scan (5-60)
 *   ?holdersPerMint=30      top holders to inspect per mint (5-30)
 *   ?minAppearances=1       1 = include single-hit wallets, 2+ = stricter overlap
 *   ?maxCandidates=50       cap on returned candidates
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
  }
  if (!isOwnerSession(session)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }
  const enabled = await getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_MEME_LEADERBOARD);
  if (!enabled) {
    return NextResponse.json({ success: false, error: "Meme Coin Advantage Bundle is disabled by admin." }, { status: 403 });
  }

  try {
    const url = new URL(request.url);
    const tracked = await getTrackedWallets();
    const excludeAddresses = new Set(tracked.map((w) => w.address));
    const result = await discoverSmartMoneyCandidates({
      excludeAddresses,
      maxPairs: intParam(url, "maxPairs"),
      holdersPerMint: intParam(url, "holdersPerMint"),
      minAppearances: intParam(url, "minAppearances"),
      maxCandidates: intParam(url, "maxCandidates"),
    });
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Discovery failed." },
      { status: 500 },
    );
  }
}
