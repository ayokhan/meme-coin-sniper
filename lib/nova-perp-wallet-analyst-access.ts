import type { Session } from "next-auth";
import { isOwnerSession } from "@/lib/auth";
import { FEATURE_FLAG_KEYS, getFeatureFlag } from "@/lib/feature-flags";

export type NovaPerpWalletAnalystAccess =
  | { ok: true; userId: string; isOwner: boolean }
  | { ok: false; status: number; error: string; disabled?: boolean };

/**
 * Access policy:
 * - Feature flag NOVA_PERP_WALLET_ANALYST must be ON.
 * - Owner: always allowed.
 * - Any VIP user is allowed (tier read from the session JWT, which is "vip" for paying
 *   VIPs AND for coach users — see lib/auth session callback).
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

  const tier = (session.user as { tier?: string | null })?.tier;
  const isCoach = (session.user as { isCoachUser?: boolean })?.isCoachUser === true;
  if (tier !== "vip" && !isCoach) {
    return { ok: false, status: 403, error: "VIP subscription required for Nova Perp Wallet Analyst Agent." };
  }

  return { ok: true, userId, isOwner: false };
}
