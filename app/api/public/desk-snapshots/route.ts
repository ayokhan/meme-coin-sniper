import { NextResponse } from "next/server";
import { getDeskSnapshots } from "@/lib/desk-snapshots";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Public (no auth): delayed desk snapshots for /enter. Cached ~30m — no cron required. */
export async function GET() {
  try {
    const snapshots = await getDeskSnapshots();
    return NextResponse.json({
      success: true,
      ...snapshots,
      cronNote:
        "Refreshes on demand via shared cache (≈30m). No 15-minute Vercel cron — Hobby only allows daily crons.",
    });
  } catch (e) {
    return NextResponse.json(
      {
        success: false,
        error: e instanceof Error ? e.message : "Failed to load desk snapshots.",
      },
      { status: 500 }
    );
  }
}
