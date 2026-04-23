import type { Session } from "next-auth";
import { isOwnerSession } from "@/lib/auth";
import { getSubscriptionTier } from "@/lib/subscription";
import { getFeatureFlag, FEATURE_FLAG_KEYS } from "@/lib/feature-flags";

export type VipFuturesAddonAccess =
  | { ok: true; userId: string }
  | { ok: false; status: number; error: string; disabled?: boolean };

async function assertVip(session: Session | null): Promise<VipFuturesAddonAccess> {
  if (!session?.user?.id) {
    return { ok: false, status: 401, error: "Sign in required." };
  }
  if (!isOwnerSession(session)) {
    const tier = await getSubscriptionTier(session.user.id);
    if (tier !== "vip") {
      return { ok: false, status: 403, error: "This feature is for VIP subscribers." };
    }
  }
  return { ok: true, userId: session.user.id };
}

export async function getNovaEagleAccess(session: Session | null): Promise<VipFuturesAddonAccess> {
  const base = await assertVip(session);
  if (!base.ok) return base;
  const on = await getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_EAGLE);
  if (!on) {
    return { ok: false, status: 403, error: "Nova Eagle is disabled by admin.", disabled: true };
  }
  return base;
}

export async function getCryptoBuddieAccess(session: Session | null): Promise<VipFuturesAddonAccess> {
  const base = await assertVip(session);
  if (!base.ok) return base;
  const on = await getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_CRYPTO_BUDDIE);
  if (!on) {
    return { ok: false, status: 403, error: "Crypto Buddie is disabled by admin.", disabled: true };
  }
  return base;
}

export async function getNovaFuturesNarrativesAccess(session: Session | null): Promise<VipFuturesAddonAccess> {
  const base = await assertVip(session);
  if (!base.ok) return base;
  const on = await getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_FUTURES_NARRATIVES);
  if (!on) {
    return { ok: false, status: 403, error: "Nova Futures Narratives is disabled by admin.", disabled: true };
  }
  return base;
}
