import type { Session } from "next-auth";
import { isOwnerSession } from "@/lib/auth";
import { FEATURE_FLAG_KEYS, getFeatureFlag } from "@/lib/feature-flags";
import { prisma } from "@/lib/db";

export type CoachCallsAccess =
  | { ok: true; userId: string; isOwner: boolean }
  | { ok: false; status: number; error: string; disabled?: boolean; locked?: boolean };

/**
 * Tri-state audience for Coach Calls (same pattern as Nova Jobs Agent):
 * Off / Owner only (+ on-demand grants) / All VIP.
 * Coach publishers (`coachUser`) always retain view access when the master flag is on.
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
    return { ok: false, status: 401, error: "Sign in required." };
  }

  if (isOwnerSession(session)) {
    return { ok: true, userId: session.user.id, isOwner: true };
  }

  const ownerOnly = await getFeatureFlag(FEATURE_FLAG_KEYS.COACH_CALLS_OWNER_ONLY);

  const user = (await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { coachCallsOnDemand: true, coachUser: true },
  })) as { coachCallsOnDemand?: boolean; coachUser?: boolean } | null;

  // Admin-granted early access always works (even while Owner-only testing).
  if (user?.coachCallsOnDemand) {
    return { ok: true, userId: session.user.id, isOwner: false };
  }

  // Publishers need to see the feed to post.
  if (user?.coachUser || (session.user as { isCoachUser?: boolean }).isCoachUser) {
    return { ok: true, userId: session.user.id, isOwner: false };
  }

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
    return { ok: true, userId: session.user.id, isOwner: false };
  }

  return {
    ok: false,
    status: 403,
    error: "VIP subscription required for Coach Calls.",
    locked: true,
  };
}
