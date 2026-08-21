import { NextResponse } from "next/server";
import {
  getFuturesDailyWrapByDateKey,
  getLatestFuturesDailyWrap,
  listFuturesDailyWrapArchive,
} from "@/lib/futures-daily-wrap";

export const dynamic = "force-dynamic";

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
        message: "No Daily Wrap yet — it publishes with the daily cron (00:00 UTC).",
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
