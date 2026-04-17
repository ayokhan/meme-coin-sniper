import type { Session } from "next-auth";
import { isOwnerSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSubscriptionTier } from "@/lib/subscription";
import { getFeatureFlag, FEATURE_FLAG_KEYS } from "@/lib/feature-flags";

export type PolymarketTrackerAccessResult =
  | { ok: true; userId: string; isOwner: boolean }
  | { ok: false; status: number; error: string; disabled?: boolean };

/**
 * Owner: always (when feature flag on). VIP: tier vip + polymarket on-demand + flag.
 */
export async function getPolymarketTrackerAccess(session: Session | null): Promise<PolymarketTrackerAccessResult> {
  if (!session?.user?.id) {
    return { ok: false, status: 401, error: "Sign in required." };
  }
  const enabled = await getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_POLYMARKET_TRACKER);
  if (!enabled) {
    return { ok: false, status: 403, error: "Nova Polymarket Tracker is disabled by admin.", disabled: true };
  }
  const userId = session.user.id;
  if (isOwnerSession(session)) {
    return { ok: true, userId, isOwner: true };
  }
  const tier = await getSubscriptionTier(userId);
  if (tier !== "vip") {
    return { ok: false, status: 403, error: "VIP with Nova Polymarket Pro access required." };
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const polyOn = !!(user as { polymarketBotOnDemand?: boolean } | null)?.polymarketBotOnDemand;
  if (!polyOn) {
    return { ok: false, status: 403, error: "Ask admin to enable Nova Polymarket Pro (on demand) for your account." };
  }
  return { ok: true, userId, isOwner: false };
}
