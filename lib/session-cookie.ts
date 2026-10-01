import type { NextResponse } from "next/server";

export const SESSION_MAX_AGE = 30 * 24 * 60 * 60;

export function sessionCookieName(): string {
  return process.env.NODE_ENV === "production"
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token";
}

export function setSessionCookie(res: NextResponse, sessionToken: string): void {
  res.cookies.set(sessionCookieName(), sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}
