import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  beginTotpSetup,
  confirmTotpSetup,
  disableTwoFactor,
  enableEmailTwoFactor,
  getTwoFactorStatus,
} from "@/lib/two-factor";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
  try {
    const status = await getTwoFactorStatus(userId);
    return NextResponse.json({ success: true, status });
  } catch (e) {
    console.error("account two-factor GET:", e);
    return NextResponse.json({ success: false, error: "Failed to load 2FA settings." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const email = session?.user?.email;
  if (!userId) return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });

  try {
    const body = (await request.json()) as {
      action?: string;
      code?: string;
      password?: string;
    };

    if (body.action === "setup-totp") {
      if (!email) return NextResponse.json({ success: false, error: "Email required for authenticator setup." }, { status: 400 });
      const { uri } = await beginTotpSetup(userId, email);
      const qrDataUrl = await QRCode.toDataURL(uri);
      return NextResponse.json({ success: true, qrDataUrl, uri });
    }

    if (body.action === "confirm-totp") {
      const code = body.code?.trim() ?? "";
      if (!code) return NextResponse.json({ success: false, error: "Enter the 6-digit code." }, { status: 400 });
      const { backupCodes } = await confirmTotpSetup(userId, code);
      return NextResponse.json({ success: true, backupCodes });
    }

    if (body.action === "enable-email") {
      await enableEmailTwoFactor(userId);
      return NextResponse.json({ success: true });
    }

    if (body.action === "disable") {
      const password = body.password ?? "";
      if (!password) return NextResponse.json({ success: false, error: "Enter your password." }, { status: 400 });
      await disableTwoFactor(userId, password);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Unknown action." }, { status: 400 });
  } catch (e) {
    console.error("account two-factor POST:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Request failed." },
      { status: 400 }
    );
  }
}
