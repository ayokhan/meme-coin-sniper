import { NextResponse } from "next/server";
import { getActiveTabNewBadges } from "@/lib/tab-new-badges";

export const dynamic = "force-dynamic";

/** Public read-only: active tab NEW badges for the main GUI. */
export async function GET() {
  try {
    const badges = await getActiveTabNewBadges();
    return NextResponse.json({ success: true, badges });
  } catch (e) {
    console.error("tab-new-badges GET:", e);
    return NextResponse.json({ success: true, badges: {} });
  }
}
