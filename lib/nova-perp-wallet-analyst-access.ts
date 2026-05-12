import type { Session } from "next-auth";
import { isOwnerSession } from "@/lib/auth";
import { getSubscriptionTier } from "@/lib/subscription";
import { FEATURE_FLAG_KEYS, getFeatureFlag } from "@/lib/feature-flags";

export type NovaPerpWalletAnalystAccess =
  | { ok: true; userId: string; isOwner: boolean }
  | { ok: false; status: number; error: string; disabled?: boolean };

/**
 * Access policy:
 * - Owner: always allowed when feature flag is ON.
 * - User: VIP tier + feature flag ON. (Previously required Nova Ultimate on-demand;
 *   relaxed so all VIP customers can use the Wallet Analyst Agent.)
 */
export async function getNovaPerpWalletAnalystAccess(session: Session | null): Promise<NovaPerpWalletAnalystAccess> {
  if (!session?.user?.id) {
    return { ok: false, status: 401, error: "Sign in required." };
  }

  const enabled = await getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_PERP_WALLET_ANALYST);
  if (!enabled) {
    return { ok: false, status: 403, error: "Nova Perp Wallet Analyst Agent is disabled by admin.", disabled: true };
  }

  const userId = session.user.id;
  if (isOwnerSession(session)) {
    return { ok: true, userId, isOwner: true };
  }

  const tier = await getSubscriptionTier(userId);
  if (tier !== "vip") {
    return { ok: false, status: 403, error: "VIP subscription required for Nova Perp Wallet Analyst Agent." };
  }

  return { ok: true, userId, isOwner: false };
}
