import { NextResponse } from "next/server";
import { getTrendingPerps } from "@/lib/api-clients/hyperliquid";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** GET - Top perp markets by 24h % move (Hyperliquid / Apex Liquid). Query: limit=50 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get("limit") ?? "50", 10) || 50));
    const perps = await getTrendingPerps(limit);
    return NextResponse.json({ success: true, perps });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch trending perps";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
