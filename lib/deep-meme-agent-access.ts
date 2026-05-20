import type { Session } from "next-auth";
import { isOwnerSession } from "@/lib/auth";
import { FEATURE_FLAG_KEYS, getFeatureFlag } from "@/lib/feature-flags";

export type DeepMemeAgentAccess =
  | { ok: true; userId: string; isOwner: boolean }
  | { ok: false; status: number; error: string; disabled?: boolean; locked?: boolean };

/**
 * Access policy for Deep Meme Agent:
 * - Feature flag NOVA_DEEP_MEME_AGENT must be ON.
 * - Owner always allowed when flag is ON.
 * - Any VIP user (tier=vip) or coach user is allowed.
 */
export async function getDeepMemeAgentAccess(session: Session | null): Promise<DeepMemeAgentAccess> {
  if (!session?.user?.id) {
    return { ok: false, status: 401, error: "Sign in required." };
  }
  const enabled = await getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_DEEP_MEME_AGENT);
  if (!enabled) {
    return { ok: false, status: 403, error: "Deep Meme Agent is not available on your account yet. Contact support if you need access.", disabled: true };
  }
  if (isOwnerSession(session)) {
    return { ok: true, userId: session.user.id, isOwner: true };
  }
  const tier = (session.user as { tier?: string | null })?.tier;
  const isCoach = (session.user as { isCoachUser?: boolean | null })?.isCoachUser === true;
  if (tier !== "vip" && !isCoach) {
    return {
      ok: false,
      status: 403,
      error: "VIP subscription required for Deep Meme Agent.",
      locked: true,
    };
  }
  return { ok: true, userId: session.user.id, isOwner: false };
}
