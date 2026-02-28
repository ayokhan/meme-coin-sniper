import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import { getUserFills } from "@/lib/api-clients/hyperliquid";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Returns recent fills (last 7 days). Owner: any address. User: only addresses in their UserLeverageWallet list. */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Sign in required" }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address")?.trim()?.toLowerCase();
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json({ success: false, error: "Valid address required" }, { status: 400 });
    }
    if (!isOwnerSession(session)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const allowed = await (prisma as any).userLeverageWallet.findUnique({
        where: { userId_address: { userId: session.user.id, address } },
      });
      if (!allowed) {
        return NextResponse.json({ success: false, error: "You can only view history for wallets you added." }, { status: 403 });
      }
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
