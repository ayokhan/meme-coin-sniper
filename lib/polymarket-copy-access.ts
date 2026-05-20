import type { Session } from "next-auth";
import { getPolymarketTrackerAccess } from "@/lib/polymarket-tracker-access";
import { getFeatureFlag, FEATURE_FLAG_KEYS } from "@/lib/feature-flags";

export type PolymarketCopyBotAccessResult =
  | { ok: true; userId: string; isOwner: boolean }
  | { ok: false; status: number; error: string; disabled?: boolean; copyBotDisabled?: boolean };

/**
 * Same as Nova Polymarket Tracker access, plus admin flag {@link FEATURE_FLAG_KEYS.NOVA_POLYMARKET_COPY_BOT}.
 */
export async function getPolymarketCopyBotAccess(session: Session | null): Promise<PolymarketCopyBotAccessResult> {
  const base = await getPolymarketTrackerAccess(session);
  if (!base.ok) return base;
  const copyOn = await getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_POLYMARKET_COPY_BOT);
  if (!copyOn) {
    return {
      ok: false,
      status: 403,
      error: "Nova Polymarket Copy Trading Bot is not available on your account yet. Contact support if you need access.",
      copyBotDisabled: true,
    };
  }
  return { ok: true, userId: base.userId, isOwner: base.isOwner };
}
