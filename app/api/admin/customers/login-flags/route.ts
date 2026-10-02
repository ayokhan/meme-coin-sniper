import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerEmail } from "@/lib/auth";
import { setLoginFlagSeen } from "@/lib/login-events";

/** POST { userIds: string[], seen: boolean } — Owner only: mark multi-location flags as seen (or un-see). */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email ?? null;
  if (!email || !isOwnerEmail(email)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }
  const body = (await request.json().catch(() => ({}))) as { userIds?: unknown; seen?: unknown };
  const userIds = Array.isArray(body.userIds)
    ? body.userIds.filter((id): id is string => typeof id === "string" && id.length > 0).slice(0, 500)
    : [];
  if (userIds.length === 0) {
    return NextResponse.json({ success: false, error: "userIds required." }, { status: 400 });
  }
  try {
    await setLoginFlagSeen(userIds, body.seen !== false, email);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("login-flags POST:", e);
    return NextResponse.json({ success: false, error: "Could not update flags." }, { status: 500 });
  }
}
