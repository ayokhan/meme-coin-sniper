import type { Session } from "next-auth";
import { isOwnerSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSubscriptionTier } from "@/lib/subscription";
import { FEATURE_FLAG_KEYS, getFeatureFlag } from "@/lib/feature-flags";

export type NovaPerpWalletAnalystAccess =
  | { ok: true; userId: string; isOwner: boolean }
  | { ok: false; status: number; error: string; disabled?: boolean };

/**
 * Access policy:
 * - Owner: always allowed when feature flag is ON.
 * - User: VIP tier + Nova Ultimate on-demand enabled (UVIP flow) + feature flag ON.
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
    return { ok: false, status: 403, error: "UVIP access required (VIP + Nova Ultimate enabled)." };
  }

  const user = await (prisma as any).user.findUnique({
    where: { id: userId },
  });
  const isUvip = !!(user as { novaUltimateOnDemand?: boolean } | null)?.novaUltimateOnDemand;
  if (!isUvip) {
    return { ok: false, status: 403, error: "Ask admin to enable Nova Ultimate (on demand) for your account." };
  }

  return { ok: true, userId, isOwner: false };
}
