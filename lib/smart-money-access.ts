import type { Session } from "next-auth";
import { isOwnerSession } from "@/lib/auth";
import { getSubscriptionTier } from "@/lib/subscription";
import { FEATURE_FLAG_KEYS, getFeatureFlag } from "@/lib/feature-flags";

export type SmartMoneyAccess =
  | { ok: true; userId: string; isOwner: boolean }
  | { ok: false; status: number; error: string; disabled?: boolean; locked?: boolean };

/**
 * Tri-state: master OFF → nobody; master + ownerOnly → owner; master + !ownerOnly → VIP/Coach/owner.
 */
export async function getSmartMoneyAlertsAccess(session: Session | null): Promise<SmartMoneyAccess> {
  if (!session?.user?.id) {
    return { ok: false, status: 401, error: "Sign in required." };
  }

  const masterOn = await getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_SMART_MONEY_ALERTS);
  if (!masterOn) {
    return {
      ok: false,
      status: 403,
      error: "Smart Money Alerts is not available on your account yet. Contact support if you need access.",
      disabled: true,
    };
  }

  const ownerOnly = await getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_SMART_MONEY_ALERTS_OWNER_ONLY);
  if (isOwnerSession(session)) {
    return { ok: true, userId: session.user.id, isOwner: true };
  }

  if (ownerOnly) {
    return {
      ok: false,
      status: 403,
      error: "Smart Money Alerts is not available on your account yet. Contact support if you need access.",
      disabled: true,
    };
  }

  const tier = await getSubscriptionTier(session.user.id);
  const isCoach = (session.user as { isCoachUser?: boolean })?.isCoachUser === true;
  if (tier !== "vip" && !isCoach) {
    return {
      ok: false,
      status: 403,
      error: "VIP subscription required for Smart Money Alerts.",
      locked: true,
    };
  }

  return { ok: true, userId: session.user.id, isOwner: false };
}
