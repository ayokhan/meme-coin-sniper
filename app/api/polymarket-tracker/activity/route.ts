import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPolymarketTrackerAccess } from "@/lib/polymarket-tracker-access";
import { fetchPolymarketPositions, fetchPolymarketTrades } from "@/lib/polymarket-data-api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isValidEvmAddress(addr: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(addr.trim());
}

async function isAddressAllowedForUser(userId: string, isOwner: boolean, address: string): Promise<boolean> {
  const key = address.toLowerCase();
  if (isOwner) return true;
  const [globalAdmin, own] = await Promise.all([
    prisma.polymarketTrackedWallet.findFirst({
      where: { address: key, active: true, global: true },
    }),
    prisma.userPolymarketTrackedWallet.findUnique({
      where: { userId_address: { userId, address: key } },
    }),
  ]);
  return !!(globalAdmin || own);
}

/** GET — ?address=0x&type=trades|positions|all&limit=50 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const access = await getPolymarketTrackerAccess(session);
    if (!access.ok) {
      return NextResponse.json(
        { success: false, error: access.error, disabled: access.disabled },
        { status: access.status }
      );
    }
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address")?.trim()?.toLowerCase() ?? "";
    const type = (searchParams.get("type") ?? "all").toLowerCase();
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "40", 10) || 40));
    if (!isValidEvmAddress(address)) {
      return NextResponse.json({ success: false, error: "Valid 0x address required." }, { status: 400 });
    }

    const allowed = await isAddressAllowedForUser(access.userId, access.isOwner, address);
    if (!allowed) {
      return NextResponse.json({ success: false, error: "You can only view activity for tracked wallets." }, { status: 403 });
    }

    const [trades, positions] = await Promise.all([
      type === "positions" ? Promise.resolve([]) : fetchPolymarketTrades(address, limit),
      type === "trades" ? Promise.resolve([]) : fetchPolymarketPositions(address, limit),
    ]);

    return NextResponse.json({
      success: true,
      address,
      trades: type === "positions" ? [] : trades,
      positions: type === "trades" ? [] : positions,
    });
  } catch (e) {
    console.error("polymarket-tracker/activity:", e);
    const message = e instanceof Error ? e.message : "Failed to load activity.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
