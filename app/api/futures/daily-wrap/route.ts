import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerEmail } from "@/lib/auth";
import {
  getFuturesDailyWrapByDateKey,
  getLatestFuturesDailyWrap,
  listFuturesDailyWrapArchive,
  upsertTodaysFuturesDailyWrap,
} from "@/lib/futures-daily-wrap";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Public read of stored Daily Futures Wrap (built once by cron — cheap to serve).
 * GET ?date=YYYY-MM-DD for a specific day; omit for latest.
 * GET ?archive=1 for recent titles only.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    if (searchParams.get("archive") === "1") {
      const limit = Math.min(30, Math.max(1, Number(searchParams.get("limit") ?? "14") || 14));
      const archive = await listFuturesDailyWrapArchive(limit);
      return NextResponse.json({ success: true, archive });
    }

    const dateKey = searchParams.get("date")?.trim();
    const wrap = dateKey
      ? await getFuturesDailyWrapByDateKey(dateKey)
      : await getLatestFuturesDailyWrap();

    if (!wrap) {
      return NextResponse.json({
        success: true,
        wrap: null,
        message: "No Daily Wrap yet.",
      });
    }

    const archive = await listFuturesDailyWrapArchive(14);
    return NextResponse.json({ success: true, wrap, archive });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load Daily Wrap";
    console.error("GET /api/futures/daily-wrap:", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * Owner-only: build + store today's wrap (no Telegram/email — use cron for that).
 * Use when today's wrap was missed and you need content in-app immediately.
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!isOwnerEmail(session?.user?.email ?? null)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const wrap = await upsertTodaysFuturesDailyWrap();
    const archive = await listFuturesDailyWrapArchive(14);
    return NextResponse.json({ success: true, wrap, archive });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to publish Daily Wrap";
    console.error("POST /api/futures/daily-wrap:", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
