import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchTopTradersForSession } from "@/lib/hyperliquid-top-traders-session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Owner: admin list (LeverageWallet). Logged-in user: their UserLeverageWallet list. */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Sign in required to view Top Leverage Traders." },
        { status: 401 }
      );
    }
    const withTime = await fetchTopTradersForSession(session);
    return NextResponse.json({ success: true, traders: withTime });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch Top Leverage Traders";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
