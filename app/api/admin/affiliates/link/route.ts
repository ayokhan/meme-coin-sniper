import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerEmail } from "@/lib/auth";
import { manuallyLinkReferral } from "@/lib/referral-commission";

/** POST — owner manually links invitee to referrer (verified offline). */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !isOwnerEmail(session.user.email)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const referrerQuery = String(body.referrerQuery ?? body.referrer ?? "").trim();
  const refereeQuery = String(body.refereeQuery ?? body.referee ?? body.invitee ?? "").trim();
  const notes = body.notes != null ? String(body.notes).trim() : undefined;

  if (!referrerQuery || !refereeQuery) {
    return NextResponse.json(
      { success: false, error: "Referrer and invitee email (or referral code) are required." },
      { status: 400 }
    );
  }

  try {
    const result = await manuallyLinkReferral({
      referrerQuery,
      refereeQuery,
      notes,
      allowAdminGrants: true,
    });
    return NextResponse.json({
      success: true,
      message: result.commissionCreated
        ? "Referral linked and commission created (pending verification)."
        : "Referral linked. No VIP subscription found yet — commission will appear when invitee pays for VIP.",
      ...result,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to link referral.";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
