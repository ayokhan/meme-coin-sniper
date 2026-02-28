import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import { getUserFills } from "@/lib/api-clients/hyperliquid";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Owner only. Returns recent fills (last 7 days) for a given wallet. */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerSession(session)) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address")?.trim();
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json({ success: false, error: "Valid address required" }, { status: 400 });
    }
    const fills = await getUserFills(address);
    return NextResponse.json({
      success: true,
      fills: fills.map((f) => ({
        time: f.time,
        coin: f.coin,
        dir: f.dir,
        side: f.side,
        sz: f.sz,
        px: f.px,
        closedPnl: f.closedPnl,
        fee: f.fee,
      })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch history";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
