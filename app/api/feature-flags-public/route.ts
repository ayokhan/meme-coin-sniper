import { NextResponse } from "next/server";
import { getAllFeatureFlags, FEATURE_FLAG_KEYS } from "@/lib/feature-flags";
import { pnlShareFlagsFromRecord } from "@/lib/pnl-share-flags";
import { getOwnerOnlyTabIds } from "@/lib/tab-owner-only";

export const dynamic = "force-dynamic";

/**
 * Public (no auth): read-only feature flags for the client.
 * Used for showing/hiding GUI tabs based on owner toggles.
 */
export async function GET() {
  const [flags, ownerOnlyTabs] = await Promise.all([getAllFeatureFlags(), getOwnerOnlyTabIds()]);
  // Only return GUI page tab flags to keep payload small.
  const pageTabFlags = Object.fromEntries(Object.entries(flags).filter(([k]) => k.startsWith("page_tab_")));
  return NextResponse.json({
    success: true,
    flags: pageTabFlags,
    ownerOnlyTabs,
    analyticsPingEnabled: flags[FEATURE_FLAG_KEYS.ANALYTICS_PING_ENABLED] ?? true,
    liveSupportChatEnabled: flags[FEATURE_FLAG_KEYS.LIVE_SUPPORT_CHAT] ?? false,
    enterLandingEnabled: flags[FEATURE_FLAG_KEYS.ENTER_LANDING_ENABLED] ?? true,
    pnlShare: pnlShareFlagsFromRecord(flags),
    coinbaseTrading: flags[FEATURE_FLAG_KEYS.COINBASE_TRADING] ?? false,
    coinbaseTradingOwnerOnly: flags[FEATURE_FLAG_KEYS.COINBASE_TRADING_OWNER_ONLY] ?? true,
  });
}

