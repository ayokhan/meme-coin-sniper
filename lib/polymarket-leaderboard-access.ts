import type { Session } from "next-auth";
import { getPolymarketTrackerAccess } from "@/lib/polymarket-tracker-access";
import { getFeatureFlag, FEATURE_FLAG_KEYS } from "@/lib/feature-flags";

export type PolymarketLeaderboardAccessResult =
  | { ok: true; userId: string; isOwner: boolean }
  | { ok: false; status: number; error: string; disabled?: boolean; leaderboardDisabled?: boolean };

/**
 * Same as Nova Polymarket Tracker access, plus admin flag {@link FEATURE_FLAG_KEYS.NOVA_POLYMARKET_LEADERBOARD}.
 */
export async function getPolymarketLeaderboardAccess(session: Session | null): Promise<PolymarketLeaderboardAccessResult> {
  const base = await getPolymarketTrackerAccess(session);
  if (!base.ok) return base;
  const on = await getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_POLYMARKET_LEADERBOARD);
  if (!on) {
    return {
      ok: false,
      status: 403,
      error: "Nova Polymarket Leaderboard is not available on your account yet. Contact support if you need access.",
      leaderboardDisabled: true,
    };
  }
  return { ok: true, userId: base.userId, isOwner: base.isOwner };
}
