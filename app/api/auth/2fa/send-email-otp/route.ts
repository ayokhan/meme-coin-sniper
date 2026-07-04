import { NextResponse } from "next/server";
import {
  sendLoginEmailOtp,
  verifyPasswordAndGetUser,
} from "@/lib/two-factor";

/** Send email OTP during sign-in (email 2FA users only). */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; password?: string };
    const email = body.email?.trim().toLowerCase() ?? "";
    const password = body.password ?? "";
    if (!email || !password) {
      return NextResponse.json({ success: false, error: "Email and password required." }, { status: 400 });
    }
    const user = await verifyPasswordAndGetUser(email, password);
    if (!user) {
      return NextResponse.json({ success: false, error: "Invalid email or password." }, { status: 401 });
    }
    if (user.twoFactorMethod !== "email" || !user.email) {
      return NextResponse.json({ success: false, error: "Email 2FA is not enabled for this account." }, { status: 400 });
    }
    await sendLoginEmailOtp(user.id, user.email);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("2fa send-email-otp:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to send code." },
      { status: 500 }
    );
  }
}
