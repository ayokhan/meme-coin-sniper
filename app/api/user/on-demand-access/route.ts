import { NextResponse } from "next/server";
import { getSessionAndSubscription } from "@/lib/auth-server";
import { isOwnerEmail, isOwnerWallet } from "@/lib/auth";
import { FEATURE_FLAG_KEYS, getFeatureFlag } from "@/lib/feature-flags";
import { prisma } from "@/lib/db";
import { COACH_CALLS_FEATURE_KEY } from "@/lib/coach-calls-access";

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
    id?: string;
    ctScanOnDemand?: boolean;
    ctScanOnDemandExpiresAt?: Date | string | null;
    memeCoinsTraderOnDemand?: boolean;
    memeCoinsTraderOnDemandExpiresAt?: Date | string | null;
    novaJobAgentOnDemand?: boolean;
    coachCallsOnDemand?: boolean;
    isCoachUser?: boolean;
  };

  const now = Date.now();
  const ctExp = parseExpiresAt(user.ctScanOnDemandExpiresAt);
  const memeExp = parseExpiresAt(user.memeCoinsTraderOnDemandExpiresAt);

  const isVip = tier === "vip";
  const owner = isOwnerEmail(session.user.email) || isOwnerWallet(session.user.walletAddress);

  const ctScanAllowed = owner || (Boolean(user.ctScanOnDemand) && (!ctExp || ctExp > now) && isVip);
  const memeCoinsTraderAllowed =
    owner || (Boolean(user.memeCoinsTraderOnDemand) && (!memeExp || memeExp > now) && isVip);

  const jobsMasterOn = await getFeatureFlag(FEATURE_FLAG_KEYS.PAGE_TAB_NOVA_JOB_AGENT);
  const jobsOwnerOnly = await getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_JOB_AGENT_OWNER_ONLY);
  const novaJobsAgentAllowed =
    jobsMasterOn &&
    (owner ||
      Boolean(user.novaJobAgentOnDemand) ||
      (isVip && !jobsOwnerOnly));

  const coachMasterOn = await getFeatureFlag(FEATURE_FLAG_KEYS.PAGE_TAB_COACH_CALLS);
  const coachOwnerOnly = await getFeatureFlag(FEATURE_FLAG_KEYS.COACH_CALLS_OWNER_ONLY);
  const coachCallsAllowed =
    coachMasterOn &&
    !coachOwnerOnly &&
    (owner || Boolean(user.coachCallsOnDemand) || Boolean(user.isCoachUser));
  // Owner-only testing: still allow owner + explicit grants / coach publishers.
  const coachCallsAllowedOwnerMode =
    coachMasterOn &&
    coachOwnerOnly &&
    (owner || Boolean(user.coachCallsOnDemand) || Boolean(user.isCoachUser));

  let coachCallsRequestPending = false;
  if (session.user.id && !coachCallsAllowed && !coachCallsAllowedOwnerMode) {
    try {
      const pending = await (prisma as any).featureAccessRequest.findFirst({
        where: {
          userId: session.user.id,
          feature: COACH_CALLS_FEATURE_KEY,
          status: "pending",
        },
        select: { id: true },
      });
      coachCallsRequestPending = !!pending;
    } catch {
      coachCallsRequestPending = false;
    }
  }

  return NextResponse.json({
    success: true,
    ctScanAllowed,
    memeCoinsTraderAllowed,
    novaJobsAgentAllowed,
    coachCallsAllowed: coachCallsAllowed || coachCallsAllowedOwnerMode,
    coachCallsRequestPending,
  });
}
