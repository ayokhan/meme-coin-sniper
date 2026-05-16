import type { Session } from "next-auth";
import { getFeatureFlag, FEATURE_FLAG_KEYS } from "@/lib/feature-flags";
import { getNovaMemeIntelligenceAccess, type VipFuturesAddonAccess } from "@/lib/vip-futures-addon-access";

export async function getMemeRunnerAccess(session: Session | null): Promise<VipFuturesAddonAccess> {
  const base = await getNovaMemeIntelligenceAccess(session);
  if (!base.ok) return base;
  const on = await getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_MEME_RUNNER);
  if (!on) {
    return { ok: false, status: 403, error: "Meme Runner is disabled by admin.", disabled: true };
  }
  return base;
}
