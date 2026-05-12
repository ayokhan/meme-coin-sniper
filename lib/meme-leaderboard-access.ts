import type { Session } from "next-auth";
import { isOwnerSession } from "@/lib/auth";
import { FEATURE_FLAG_KEYS, getFeatureFlag } from "@/lib/feature-flags";

export type MemeLeaderboardAccess =
  | { ok: true; userId: string; isOwner: boolean }
  | { ok: false; status: number; error: string; disabled?: boolean; locked?: boolean };

/**
 * Access policy:
 * - Feature flag NOVA_MEME_LEADERBOARD must be ON.
 * - Owner: always allowed when flag is ON.
 * - Any VIP user is allowed (no extra on-demand entitlement required).
 */
export async function getMemeLeaderboardAccess(session: Session | null): Promise<MemeLeaderboardAccess> {
  if (!session?.user?.id) {
    return { ok: false, status: 401, error: "Sign in required." };
  }

  const enabled = await getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_MEME_LEADERBOARD);
  if (!enabled) {
    return { ok: false, status: 403, error: "Meme Coin Advantage Bundle is disabled by admin.", disabled: true };
  }

  if (isOwnerSession(session)) {
    return { ok: true, userId: session.user.id, isOwner: true };
  }

  const tier = (session.user as { tier?: string | null })?.tier;
  if (tier !== "vip") {
    return {
      ok: false,
      status: 403,
      error: "VIP subscription required for Meme Coin Advantage Bundle.",
      locked: true,
    };
  }

  return { ok: true, userId: session.user.id, isOwner: false };
}
