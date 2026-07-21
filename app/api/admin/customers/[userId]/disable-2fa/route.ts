import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerEmail } from "@/lib/auth";
import { adminDisableTwoFactor } from "@/lib/two-factor";

/** POST - Owner only: disable 2FA for a locked-out customer (no user password required). */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email ?? null;
    if (!email) {
      return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
    }
    if (!isOwnerEmail(email)) {
      return NextResponse.json({ success: false, error: "Not authorized. Owner only." }, { status: 403 });
    }

    const { userId } = await params;
    if (!userId) {
      return NextResponse.json({ success: false, error: "User ID required." }, { status: 400 });
    }

    const result = await adminDisableTwoFactor(userId);
    return NextResponse.json({
      success: true,
      wasEnabled: result.wasEnabled,
      previousMethod: result.method,
      message: result.wasEnabled
        ? `2FA disabled (was ${result.method}). User can sign in with password only.`
        : "2FA was already off for this user.",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to disable 2FA.";
    console.error("Admin disable 2FA error:", e);
    const status = message === "User not found." ? 404 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
