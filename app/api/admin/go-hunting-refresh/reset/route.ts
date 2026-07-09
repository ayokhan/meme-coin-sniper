import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  resetAllGoHuntingRefreshCooldowns,
  resetGoHuntingRefreshForUserId,
} from "@/lib/go-hunting-refresh-limit";

export const dynamic = "force-dynamic";

/** POST — reset market refresh cooldowns globally or for one user (by userId or email). */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!isOwnerSession(session)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const scope = body.scope === "user" ? "user" : "all";

  if (scope === "all") {
    const deleted = await resetAllGoHuntingRefreshCooldowns();
    return NextResponse.json({
      success: true,
      scope: "all",
      deleted,
      message: `Reset refresh limits for all users (${deleted} cooldown record${deleted === 1 ? "" : "s"} cleared).`,
    });
  }

  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  let targetUserId = userId;
  if (!targetUserId && email) {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    });
    if (!user) {
      return NextResponse.json({ success: false, error: `No user found for ${email}.` }, { status: 404 });
    }
    targetUserId = user.id;
  }

  if (!targetUserId) {
    return NextResponse.json(
      { success: false, error: "Provide userId or email for per-user reset." },
      { status: 400 }
    );
  }

  const deleted = await resetGoHuntingRefreshForUserId(targetUserId);
  return NextResponse.json({
    success: true,
    scope: "user",
    userId: targetUserId,
    deleted,
    message: `Reset refresh limits for user (${deleted} cooldown record${deleted === 1 ? "" : "s"} cleared).`,
  });
}
