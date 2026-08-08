import { NextResponse } from "next/server";
import { runVipTrialReminderEmails } from "@/lib/vip-trial";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/** GET — send VIP trial ending reminders (~24h before, windowed for daily cron). */
export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runVipTrialReminderEmails();
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Trial reminders failed" },
      { status: 500 }
    );
  }
}
