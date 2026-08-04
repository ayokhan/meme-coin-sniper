import { NextResponse } from "next/server";
import { runVipExpiryEmails } from "@/lib/vip-expiry-email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily: one pre (~3d before) + one post (just after) VIP expiry email.
 * Called from main /api/cron. Auth: Bearer CRON_SECRET.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runVipExpiryEmails();
  return NextResponse.json({
    success: result.ok,
    preSent: result.preSent,
    postSent: result.postSent,
    preFailed: result.preFailed,
    postFailed: result.postFailed,
    message: result.message,
  });
}
