import type { Session } from "next-auth";
import { isOwnerSession } from "@/lib/auth";
import { FEATURE_FLAG_KEYS, getFeatureFlag } from "@/lib/feature-flags";
import { getSubscriptionTier } from "@/lib/subscription";

export type FindWalletAccess =
  | { ok: true; userId: string; isOwner: boolean }
  | { ok: false; status: number; error: string; disabled?: boolean; locked?: boolean };

/**
 * Tri-state: master OFF → nobody; master + ownerOnly → owner; master + !ownerOnly → VIP/Coach/owner.
 */
export async function getFindWalletAccess(session: Session | null): Promise<FindWalletAccess> {
  if (!session?.user?.id) {
    return { ok: false, status: 401, error: "Sign in required." };
  }

  const masterOn = await getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_FIND_WALLET);
  if (!masterOn) {
    return {
      ok: false,
      status: 403,
      error: "Find Wallet is not available on your account yet. Contact support if you need access.",
      disabled: true,
    };
  }

  const ownerOnly = await getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_FIND_WALLET_OWNER_ONLY);
  if (isOwnerSession(session)) {
    return { ok: true, userId: session.user.id, isOwner: true };
  }

  if (ownerOnly) {
    return {
      ok: false,
      status: 403,
      error: "Find Wallet is not available on your account yet. Contact support if you need access.",
      disabled: true,
    };
  }

  const tier = await getSubscriptionTier(session.user.id);
  const isCoach = (session.user as { isCoachUser?: boolean | null })?.isCoachUser === true;
  if (tier !== "vip" && !isCoach) {
    return {
      ok: false,
      status: 403,
      error: "VIP subscription required for Find Wallet.",
      locked: true,
    };
  }

  return { ok: true, userId: session.user.id, isOwner: false };
}
