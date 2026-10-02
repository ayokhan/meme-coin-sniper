import { NextResponse } from "next/server";
import type { UsageDeskId } from "@/lib/trial-desk-quota";
import { assertTrialDeskAccess } from "@/lib/trial-desk-quota";

/** Returns a NextResponse if the trial / Limited VIP / Nova Pro daily limit blocks; otherwise null. */
export async function trialDeskLimitResponse(
  userId: string | null | undefined,
  desk: UsageDeskId
): Promise<NextResponse | null> {
  if (!userId) return null;
  const trial = await assertTrialDeskAccess(userId, desk, { record: true });
  if (trial.ok) return null;
  return NextResponse.json(
    {
      success: false,
      error: trial.error,
      trialLimit: true,
      used: trial.used,
      limit: trial.limit,
    },
    { status: trial.status }
  );
}
