import { NextResponse } from "next/server";
import { buildJwtTokenForUserId } from "@/lib/auth";
import { verifyBiometricDeviceToken } from "@/lib/biometric-credential";
import { setSessionCookie } from "@/lib/session-cookie";

export async function POST(req: Request) {
  let body: { deviceToken?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 });
  }

  const userId =
    typeof body.deviceToken === "string" && body.deviceToken.length < 512
      ? await verifyBiometricDeviceToken(body.deviceToken)
      : null;
  if (!userId) {
    return NextResponse.json(
      { success: false, error: "Biometric sign-in is no longer active on this device.", revoked: true },
      { status: 401 }
    );
  }

  const sessionToken = await buildJwtTokenForUserId(userId);
  if (!sessionToken) {
    return NextResponse.json({ success: false, error: "User not found", revoked: true }, { status: 404 });
  }

  const { recordLoginEvent } = await import("@/lib/login-events");
  await recordLoginEvent({ userId, provider: "biometric", request: req });

  const res = NextResponse.json({ success: true });
  setSessionCookie(res, sessionToken);
  return res;
}
