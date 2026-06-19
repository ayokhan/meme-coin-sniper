import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcrypt";
import { authOptions, isOwnerEmail, isOwnerWallet } from "@/lib/auth";
import { deleteUserAccount } from "@/lib/delete-user-account";
import { prisma } from "@/lib/db";
import { FEATURE_FLAG_KEYS, getFeatureFlag } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";

const CONFIRM_PHRASE = "DELETE";

/** DELETE — Self-service permanent account deletion (feature-flagged). */
export async function DELETE(request: Request) {
  try {
    const enabled = await getFeatureFlag(FEATURE_FLAG_KEYS.ACCOUNT_SELF_DELETE);
    if (!enabled) {
      return NextResponse.json(
        { success: false, error: "Account deletion is temporarily unavailable." },
        { status: 403 }
      );
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
    }

    const user = (await prisma.user.findUnique({
      where: { id: session.user.id },
    })) as { id: string; email: string | null; walletAddress: string | null; hashedPassword: string | null } | null;

    if (!user) {
      return NextResponse.json({ success: false, error: "User not found." }, { status: 404 });
    }

    if (isOwnerEmail(user.email) || isOwnerWallet(user.walletAddress)) {
      return NextResponse.json(
        {
          success: false,
          error: "Owner accounts cannot be deleted from the app. Contact support if you need help.",
        },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const confirm = typeof body.confirm === "string" ? body.confirm.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (confirm !== CONFIRM_PHRASE) {
      return NextResponse.json(
        { success: false, error: `Type ${CONFIRM_PHRASE} to confirm account deletion.` },
        { status: 400 }
      );
    }

    if (user.hashedPassword) {
      if (!password) {
        return NextResponse.json({ success: false, error: "Enter your current password to continue." }, { status: 400 });
      }
      const ok = await bcrypt.compare(password, user.hashedPassword);
      if (!ok) {
        return NextResponse.json({ success: false, error: "Password is incorrect." }, { status: 400 });
      }
    }

    await deleteUserAccount(user.id);

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Account delete error:", e);
    return NextResponse.json({ success: false, error: "Failed to delete account." }, { status: 500 });
  }
}
