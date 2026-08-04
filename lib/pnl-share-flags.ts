import { FEATURE_FLAG_KEYS } from "@/lib/feature-flags";

/** Owner-controlled PNL share-card options for Nova Bot + Nova Forex. */
export type PnlShareFlags = {
  showUsd: boolean;
  showInvested: boolean;
  showHeldFor: boolean;
  showLeverage: boolean;
  cardMessage: boolean;
  /** Include personal referral code + QR on share cards. Default ON. */
  showReferral: boolean;
};

export const DEFAULT_PNL_SHARE_FLAGS: PnlShareFlags = {
  showUsd: true,
  showInvested: true,
  showHeldFor: true,
  showLeverage: true,
  cardMessage: false,
  showReferral: true,
};

export function pnlShareFlagsFromRecord(flags: Record<string, boolean> | null | undefined): PnlShareFlags {
  if (!flags) return { ...DEFAULT_PNL_SHARE_FLAGS };
  return {
    showUsd: flags[FEATURE_FLAG_KEYS.PNL_SHARE_SHOW_USD] !== false,
    showInvested: flags[FEATURE_FLAG_KEYS.PNL_SHARE_SHOW_INVESTED] !== false,
    showHeldFor: flags[FEATURE_FLAG_KEYS.PNL_SHARE_SHOW_HELD_FOR] !== false,
    showLeverage: flags[FEATURE_FLAG_KEYS.PNL_SHARE_SHOW_LEVERAGE] !== false,
    cardMessage: flags[FEATURE_FLAG_KEYS.PNL_SHARE_CARD_MESSAGE] === true,
    showReferral: flags[FEATURE_FLAG_KEYS.PNL_SHARE_SHOW_REFERRAL] !== false,
  };
}
