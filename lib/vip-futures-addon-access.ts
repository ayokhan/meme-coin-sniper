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
    const isCoach = (session.user as { isCoachUser?: boolean })?.isCoachUser === true;
    if (tier !== "vip" && !isCoach) {
      return { ok: false, status: 403, error: "This feature is for VIP and Coach users." };
    }
  }
  return { ok: true, userId: session.user.id };
}

export async function getNovaEagleAccess(session: Session | null): Promise<VipFuturesAddonAccess> {
  const base = await assertVip(session);
  if (!base.ok) return base;
  const on = await getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_EAGLE);
  if (!on) {
    return { ok: false, status: 403, error: "Nova Eagle is not available on your account yet. Contact support if you need access.", disabled: true };
  }
  return base;
}

export async function getCryptoBuddieAccess(session: Session | null): Promise<VipFuturesAddonAccess> {
  const base = await assertVip(session);
  if (!base.ok) return base;
  const on = await getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_CRYPTO_BUDDIE);
  if (!on) {
    return { ok: false, status: 403, error: "Crypto Buddie is not available on your account yet. Contact support if you need access.", disabled: true };
  }
  return base;
}

export async function getNovaFuturesNarrativesAccess(session: Session | null): Promise<VipFuturesAddonAccess> {
  const base = await assertVip(session);
  if (!base.ok) return base;
  const on = await getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_FUTURES_NARRATIVES);
  if (!on) {
    return { ok: false, status: 403, error: "Nova Futures Narratives is not available on your account yet. Contact support if you need access.", disabled: true };
  }
  return base;
}

export async function getNovaMemeIntelligenceAccess(session: Session | null): Promise<VipFuturesAddonAccess> {
  const base = await assertVip(session);
  if (!base.ok) return base;
  const on = await getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_MEME_INTELLIGENCE);
  if (!on) {
    return { ok: false, status: 403, error: "Nova Meme Intelligence is not available on your account yet. Contact support if you need access.", disabled: true };
  }
  return base;
}

export async function getNovaQMemesAccess(session: Session | null): Promise<VipFuturesAddonAccess> {
  const base = await getNovaMemeIntelligenceAccess(session);
  if (!base.ok) return base;
  const on = await getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_Q_MEMES);
  if (!on) {
    return { ok: false, status: 403, error: "NovaQ - Memes is not available on your account yet. Contact support if you need access.", disabled: true };
  }
  return base;
}

export async function getNovaSmartMemesAccess(session: Session | null): Promise<VipFuturesAddonAccess> {
  const base = await getNovaMemeIntelligenceAccess(session);
  if (!base.ok) return base;
  const on = await getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_SMART_MEMES);
  if (!on) {
    return { ok: false, status: 403, error: "Nova Smart Analysis for Memes is not available on your account yet. Contact support if you need access.", disabled: true };
  }
  return base;
}

export async function getTopMemeCoinsAccess(session: Session | null): Promise<VipFuturesAddonAccess> {
  const base = await getNovaMemeIntelligenceAccess(session);
  if (!base.ok) return base;
  const on = await getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_TOP_MEME_COINS);
  if (!on) {
    return { ok: false, status: 403, error: "Top Meme coins is not available on your account yet. Contact support if you need access.", disabled: true };
  }
  return base;
}

export async function getMemePriceFactorAccess(session: Session | null): Promise<VipFuturesAddonAccess> {
  const base = await getNovaMemeIntelligenceAccess(session);
  if (!base.ok) return base;
  const on = await getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_MEME_PRICE_FACTOR);
  if (!on) {
    return { ok: false, status: 403, error: "Meme Price Factor is not available on your account yet. Contact support if you need access.", disabled: true };
  }
  return base;
}

export async function getMemeRunnerAddonAccess(session: Session | null): Promise<VipFuturesAddonAccess> {
  const base = await getNovaMemeIntelligenceAccess(session);
  if (!base.ok) return base;
  const on = await getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_MEME_RUNNER);
  if (!on) {
    return { ok: false, status: 403, error: "Meme Runner is not available on your account yet. Contact support if you need access.", disabled: true };
  }
  return base;
}

export async function getNovaScalpAgentAccess(session: Session | null): Promise<VipFuturesAddonAccess> {
  const base = await assertVip(session);
  if (!base.ok) return base;
  const on = await getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_SCALP_AGENT);
  if (!on) {
    return { ok: false, status: 403, error: "Nova Scalp Agent is not available on your account yet. Contact support if you need access.", disabled: true };
  }
  return base;
}

export async function getNovaQFibAccess(session: Session | null): Promise<VipFuturesAddonAccess> {
  const base = await assertVip(session);
  if (!base.ok) return base;
  const on = await getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_Q_FIB);
  if (!on) {
    return { ok: false, status: 403, error: "NovaQ Fib is not available on your account yet. Contact support if you need access.", disabled: true };
  }
  return base;
}

export async function getNovaExtraAccess(session: Session | null): Promise<VipFuturesAddonAccess> {
  const base = await assertVip(session);
  if (!base.ok) return base;
  const on = await getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_EXTRA);
  if (!on) {
    return { ok: false, status: 403, error: "Nova Extra is not available on your account yet. Contact support if you need access.", disabled: true };
  }
  return base;
}

export async function getNovaForexAgentAccess(session: Session | null): Promise<VipFuturesAddonAccess> {
  const base = await assertVip(session);
  if (!base.ok) return base;
  const on = await getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_FOREX_AGENT);
  if (!on) {
    return { ok: false, status: 403, error: "Nova Forex Agent is not available on your account yet. Contact support if you need access.", disabled: true };
  }
  return base;
}

export async function getNovaForexFibAccess(session: Session | null): Promise<VipFuturesAddonAccess> {
  const base = await getNovaForexAgentAccess(session);
  if (!base.ok) return base;
  const on = await getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_FOREX_FIB);
  if (!on) {
    return { ok: false, status: 403, error: "Nova Forex Fib is not available on your account yet. Contact support if you need access.", disabled: true };
  }
  return base;
}

export async function getNovaForexScalpAgentAccess(session: Session | null): Promise<VipFuturesAddonAccess> {
  const base = await getNovaForexAgentAccess(session);
  if (!base.ok) return base;
  const on = await getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_FOREX_SCALP_AGENT);
  if (!on) {
    return { ok: false, status: 403, error: "Nova Forex Scalp Agent is not available on your account yet. Contact support if you need access.", disabled: true };
  }
  return base;
}
