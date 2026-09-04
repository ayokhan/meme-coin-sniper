import type { Session } from "next-auth";
import { isOwnerSession } from "@/lib/auth";
import { FEATURE_FLAG_KEYS, getFeatureFlag } from "@/lib/feature-flags";
import { prisma } from "@/lib/db";

export const COACH_CALLS_FEATURE_KEY = "coach_calls";

export type CoachCallsAccess =
  | { ok: true; userId: string; isOwner: boolean }
  | { ok: false; status: number; error: string; disabled?: boolean; locked?: boolean; onDemand?: boolean };

/**
 * Coach Calls access:
 * - Master flag off → disabled for everyone
 * - Owner / coach publisher → always allowed when master on
 * - VIP + admin on-demand grant → allowed
 * - VIP without grant → on-demand lock (request access)
 * - Non-VIP → VIP upgrade lock
 * Owner-only flag: hide from VIP on-demand pool (testing); grants still work.
 */
export async function getCoachCallsAccess(session: Session | null): Promise<CoachCallsAccess> {
  const masterOn = await getFeatureFlag(FEATURE_FLAG_KEYS.PAGE_TAB_COACH_CALLS);
  if (!masterOn) {
    return {
      ok: false,
      status: 403,
      error: "Coach Calls is not available on your account yet. Contact support if you need access.",
      disabled: true,
    };
  }

  if (!session?.user?.id) {
    return { ok: false, status: 401, error: "Sign in required.", locked: true };
  }

  if (isOwnerSession(session)) {
    return { ok: true, userId: session.user.id, isOwner: true };
  }

  const user = (await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { coachCallsOnDemand: true, coachUser: true },
  })) as { coachCallsOnDemand?: boolean; coachUser?: boolean } | null;

  if (user?.coachCallsOnDemand) {
    return { ok: true, userId: session.user.id, isOwner: false };
  }

  if (user?.coachUser || (session.user as { isCoachUser?: boolean }).isCoachUser) {
    return { ok: true, userId: session.user.id, isOwner: false };
  }

  const ownerOnly = await getFeatureFlag(FEATURE_FLAG_KEYS.COACH_CALLS_OWNER_ONLY);
  if (ownerOnly) {
    return {
      ok: false,
      status: 403,
      error: "Coach Calls is in owner testing mode. Ask an admin to enable it for your account.",
      disabled: true,
    };
  }

  const tier = (session.user as { tier?: string }).tier;
  if (tier === "vip") {
    return {
      ok: false,
      status: 403,
      error: "Coach Calls is VIP on-demand. Request access and an admin will enable it for your account.",
      onDemand: true,
    };
  }

  return {
    ok: false,
    status: 403,
    error: "VIP subscription required for Coach Calls.",
    locked: true,
  };
}
