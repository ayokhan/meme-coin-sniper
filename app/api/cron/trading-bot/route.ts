import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Lightweight cron: runs one trading-bot cycle when enabled.
 * Wire in vercel.json (e.g. hourly on Pro). Main /api/cron also invokes the bot daily.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const base = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  try {
    const res = await fetch(`${base}/api/admin/trading-bot/run`, {
      cache: "no-store",
      headers: auth ? { Authorization: auth } : {},
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json({
      success: data.success === true,
      message: data.message ?? data.error,
      skipped: data.message === "No enabled bot",
    });
  } catch (e) {
    return NextResponse.json({
      success: false,
      error: e instanceof Error ? e.message : "Trading bot cron failed",
    });
  }
}
