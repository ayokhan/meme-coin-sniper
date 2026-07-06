import { NextResponse } from "next/server";
import { getGoHuntingRefreshConfig } from "@/lib/go-hunting-refresh-limit";

export const dynamic = "force-dynamic";

/** GET — public Go Hunting refresh policy for dashboard client. */
export async function GET() {
  const config = await getGoHuntingRefreshConfig();
  return NextResponse.json(
    { success: true, config },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } }
  );
}
