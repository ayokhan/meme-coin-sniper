import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import { getGoHuntingRefreshConfig, setGoHuntingRefreshConfig } from "@/lib/go-hunting-refresh-limit";

export const dynamic = "force-dynamic";

/** GET — owner reads current Go Hunting refresh limits. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isOwnerSession(session)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }
  const config = await getGoHuntingRefreshConfig();
  return NextResponse.json({ success: true, config });
}

/** PATCH — owner updates global Go Hunting refresh limits. */
export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!isOwnerSession(session)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const config = await setGoHuntingRefreshConfig({
    guestIntervalMinutes: body.guestIntervalMinutes !== undefined ? Number(body.guestIntervalMinutes) : undefined,
    freeMemberIntervalMinutes:
      body.freeMemberIntervalMinutes !== undefined ? Number(body.freeMemberIntervalMinutes) : undefined,
    guestAutoRefreshEnabled:
      body.guestAutoRefreshEnabled !== undefined ? !!body.guestAutoRefreshEnabled : undefined,
    freeAutoRefreshEnabled:
      body.freeAutoRefreshEnabled !== undefined ? !!body.freeAutoRefreshEnabled : undefined,
    freeAutoRefreshMinutes:
      body.freeAutoRefreshMinutes !== undefined ? Number(body.freeAutoRefreshMinutes) : undefined,
  });
  return NextResponse.json({ success: true, config });
}
