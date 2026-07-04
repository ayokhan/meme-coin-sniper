import { NextResponse } from "next/server";
import { verifyPasswordAndGetUser, shouldRequireTwoFactor } from "@/lib/two-factor";

/** Check whether sign-in requires 2FA before prompting for a code. */
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
    const requires2fa = await shouldRequireTwoFactor(user);
    const method = user.twoFactorMethod;
    return NextResponse.json({
      success: true,
      requires2fa,
      method: requires2fa && (method === "totp" || method === "email") ? method : null,
    });
  } catch (e) {
    console.error("2fa check:", e);
    return NextResponse.json({ success: false, error: "Failed to check 2FA." }, { status: 500 });
  }
}
