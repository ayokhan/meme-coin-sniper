import type { Session } from "next-auth";
import { getPolymarketTrackerAccess } from "@/lib/polymarket-tracker-access";
import { getFeatureFlag, FEATURE_FLAG_KEYS } from "@/lib/feature-flags";

export type PolymarketEliteAccessResult =
  | { ok: true; userId: string; isOwner: boolean }
  | { ok: false; status: number; error: string; disabled?: boolean; eliteDisabled?: boolean };

/**
 * Same as Nova Polymarket Tracker access, plus admin flag {@link FEATURE_FLAG_KEYS.NOVA_POLYMARKET_ELITE}.
 */
export async function getPolymarketEliteAccess(session: Session | null): Promise<PolymarketEliteAccessResult> {
  const base = await getPolymarketTrackerAccess(session);
  if (!base.ok) return base;
  const on = await getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_POLYMARKET_ELITE);
  if (!on) {
    return {
      ok: false,
      status: 403,
      error: "Polymarket Elite is not available on your account yet. Contact support if you need access.",
      eliteDisabled: true,
    };
  }
  return { ok: true, userId: base.userId, isOwner: base.isOwner };
}
