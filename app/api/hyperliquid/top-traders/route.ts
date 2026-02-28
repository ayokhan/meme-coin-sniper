import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import { getTopTradersPositions } from "@/lib/api-clients/hyperliquid";
import { APEXLIQUID_TOP_TRADERS } from "@/lib/config/apexliquid-top-traders";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Owner only. VIP + on demand for others (see Trading Bot tab). */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerSession(session)) {
      return NextResponse.json(
        { success: false, error: "Top Traders requires VIP + on demand. Contact for access." },
        { status: 403 }
      );
    }
    const traders = await getTopTradersPositions(APEXLIQUID_TOP_TRADERS);
    return NextResponse.json({ success: true, traders });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch Top Leverage Traders";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
