import { NextResponse } from "next/server";
import { trackStrongRunnerPicks } from "@/lib/strong-runners-store";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Cron-only: refresh market caps of recent Strong Runner picks for the track record. */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { checked } = await trackStrongRunnerPicks(600);
    return NextResponse.json({ success: true, checked });
  } catch (e) {
    console.error("cron strong-runners-track:", e);
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "Track failed" }, { status: 500 });
  }
}
