import { NextResponse } from "next/server";
import { buildJwtTokenForUserId } from "@/lib/auth";
import { verifyCapacitorAuthToken } from "@/lib/capacitor-auth-token";

const SESSION_MAX_AGE = 30 * 24 * 60 * 60;

function sessionCookieName(): string {
  return process.env.NODE_ENV === "production"
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token";
}

export async function POST(req: Request) {
  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 });
  }

  const userId = body.token ? verifyCapacitorAuthToken(body.token) : null;
  if (!userId) {
    return NextResponse.json({ success: false, error: "Invalid or expired token" }, { status: 401 });
  }

  const sessionToken = await buildJwtTokenForUserId(userId);
  if (!sessionToken) {
    return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
  }

  const isProd = process.env.NODE_ENV === "production";
  const res = NextResponse.json({ success: true });
  res.cookies.set(sessionCookieName(), sessionToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
