import type { Session } from "next-auth";
import { canAccessMemeCoinsTrader, isOwnerSession } from "@/lib/auth";
import { FEATURE_FLAG_KEYS, getFeatureFlag } from "@/lib/feature-flags";

export type MemeLeaderboardAccess =
  | { ok: true; userId: string; isOwner: boolean }
  | { ok: false; status: number; error: string; disabled?: boolean; locked?: boolean };

/**
 * Access policy:
 * - Feature flag NOVA_MEME_LEADERBOARD must be ON.
 * - Owner: always allowed when flag is ON.
 * - Other users: must satisfy canAccessMemeCoinsTrader (VIP + on-demand) — same gate as the
 *   parent Meme Coins Traders sub-tab — so we never grant the leaderboard to users who
 *   can't see the rest of the meme wallet workspace.
 */
export async function getMemeLeaderboardAccess(session: Session | null): Promise<MemeLeaderboardAccess> {
  if (!session?.user?.id) {
    return { ok: false, status: 401, error: "Sign in required." };
  }

  const enabled = await getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_MEME_LEADERBOARD);
  if (!enabled) {
    return { ok: false, status: 403, error: "Meme Leaderboard is disabled by admin.", disabled: true };
  }

  if (isOwnerSession(session)) {
    return { ok: true, userId: session.user.id, isOwner: true };
  }

  if (!canAccessMemeCoinsTrader(session)) {
    return {
      ok: false,
      status: 403,
      error: "Meme Coins Traders on-demand access required.",
      locked: true,
    };
  }

  return { ok: true, userId: session.user.id, isOwner: false };
}
