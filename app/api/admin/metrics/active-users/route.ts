import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import { getActiveUsersForOwner } from "@/lib/active-users";

export const dynamic = "force-dynamic";

/** GET - Signed-in users active on the site (page-view heartbeats). Owner only. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isOwnerSession(session)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }
  try {
    const snapshot = await getActiveUsersForOwner();
    return NextResponse.json({ success: true, snapshot });
  } catch (e) {
    console.error("admin metrics active-users:", e);
    return NextResponse.json({ success: false, error: "Failed to load active users." }, { status: 500 });
  }
}
