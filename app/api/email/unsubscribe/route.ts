import { NextResponse } from "next/server";
import { verifyUnsubscribeToken } from "@/lib/email-links";
import { unsubscribeEmail } from "@/lib/email-unsubscribe";

export const dynamic = "force-dynamic";

/**
 * POST ?e=&t= — RFC 8058 one-click (body "List-Unsubscribe=One-Click") from mail clients,
 * or the confirm form on /unsubscribe (redirects back with done=1).
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const email = url.searchParams.get("e") ?? "";
  const token = url.searchParams.get("t") ?? "";
  const fromForm = url.searchParams.get("form") === "1";
  if (!(await verifyUnsubscribeToken(email, token))) {
    return fromForm
      ? NextResponse.redirect(new URL(`/unsubscribe?error=1`, url.origin), 303)
      : NextResponse.json({ success: false, error: "Invalid link." }, { status: 400 });
  }
  try {
    await unsubscribeEmail(email);
  } catch (e) {
    console.error("unsubscribe:", e);
    return fromForm
      ? NextResponse.redirect(new URL(`/unsubscribe?error=1`, url.origin), 303)
      : NextResponse.json({ success: false, error: "Could not unsubscribe." }, { status: 500 });
  }
  if (fromForm) {
    return NextResponse.redirect(new URL(`/unsubscribe?done=1&e=${encodeURIComponent(email)}`, url.origin), 303);
  }
  return NextResponse.json({ success: true });
}

/** Opening the one-click URL in a browser shows the confirm page instead of unsubscribing silently. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const page = new URL("/unsubscribe", url.origin);
  for (const k of ["e", "t"]) {
    const v = url.searchParams.get(k);
    if (v) page.searchParams.set(k, v);
  }
  return NextResponse.redirect(page, 302);
}
