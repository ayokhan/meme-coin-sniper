import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerEmail } from "@/lib/auth";
import { findUserByEmailOrId, syncReferralCommissionForReferee } from "@/lib/referral-commission";

/** POST — owner creates commission from invitee's VIP subscription when referral is already linked. */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !isOwnerEmail(session.user.email)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const refereeQuery = String(body.refereeQuery ?? body.referee ?? body.invitee ?? body.refereeId ?? "").trim();
  if (!refereeQuery) {
    return NextResponse.json({ success: false, error: "Invitee email or user id is required." }, { status: 400 });
  }

  const referee = await findUserByEmailOrId(refereeQuery);
  if (!referee) {
    return NextResponse.json({ success: false, error: "Invitee not found." }, { status: 404 });
  }

  const commissionId = await syncReferralCommissionForReferee(referee.id, {
    allowAdminGrants: true,
    notes: body.notes != null ? String(body.notes).trim() : undefined,
  });

  if (!commissionId) {
    return NextResponse.json({
      success: false,
      error: "No qualifying VIP subscription or referrer link found for this user.",
    }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    message: "Commission created (pending verification).",
    commissionId,
  });
}
