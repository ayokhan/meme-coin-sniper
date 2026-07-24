import { NextResponse } from "next/server";
import { getSessionAndSubscription } from "@/lib/auth-server";
import { isOwnerEmail, isOwnerWallet } from "@/lib/auth";

function parseExpiresAt(raw: unknown): number | null {
  if (!raw) return null;
  const t = raw instanceof Date ? raw.getTime() : new Date(raw as any).getTime();
  return Number.isFinite(t) ? t : null;
}

/**
 * Returns the *effective* on-demand access for the current session user.
 * Used by the dashboard to reflect admin enable/disable changes immediately.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const { tier, session } = await getSessionAndSubscription();
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
  }

  const user = session.user as {
    ctScanOnDemand?: boolean;
    ctScanOnDemandExpiresAt?: Date | string | null;
    memeCoinsTraderOnDemand?: boolean;
    memeCoinsTraderOnDemandExpiresAt?: Date | string | null;
    novaJobAgentOnDemand?: boolean;
  };

  const now = Date.now();
  const ctExp = parseExpiresAt(user.ctScanOnDemandExpiresAt);
  const memeExp = parseExpiresAt(user.memeCoinsTraderOnDemandExpiresAt);

  const isVip = tier === "vip";
  const owner = isOwnerEmail(session.user.email) || isOwnerWallet(session.user.walletAddress);

  const ctScanAllowed = owner || (Boolean(user.ctScanOnDemand) && (!ctExp || ctExp > now) && isVip);
  const memeCoinsTraderAllowed =
    owner || (Boolean(user.memeCoinsTraderOnDemand) && (!memeExp || memeExp > now) && isVip);
  const novaJobsAgentAllowed = owner || Boolean(user.novaJobAgentOnDemand);

  // Owners are handled by separate server-side auth gates; dashboard uses tier+flags for on-demand tabs.

  return NextResponse.json({
    success: true,
    ctScanAllowed,
    memeCoinsTraderAllowed,
    novaJobsAgentAllowed,
  });
}
