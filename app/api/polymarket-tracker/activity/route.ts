import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPolymarketTrackerAccess } from "@/lib/polymarket-tracker-access";
import {
  aggregateTradesStats,
  fetchPolymarketClosedPositions,
  fetchPolymarketPositions,
  fetchPolymarketTrades,
} from "@/lib/polymarket-data-api";

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

/** GET — ?address=0x&type=trades|positions|closed|all&limit=… (limit capped at 500 for trades; positions/closed up to 250) */
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
    const limitRaw = parseInt(searchParams.get("limit") ?? "400", 10) || 400;
    const wantTrades = type === "all" || type === "trades";
    const wantPositions = type === "all" || type === "positions";
    const wantClosed = type === "all" || type === "closed";
    const tradeLimit = wantTrades ? Math.min(500, Math.max(1, limitRaw)) : 0;
    const posLimit = Math.min(250, Math.max(1, parseInt(searchParams.get("positionsLimit") ?? "200", 10) || 200));
    const closedLimit = Math.min(250, Math.max(1, parseInt(searchParams.get("closedLimit") ?? "150", 10) || 150));
    if (!isValidEvmAddress(address)) {
      return NextResponse.json({ success: false, error: "Valid 0x address required." }, { status: 400 });
    }

    const allowed = await isAddressAllowedForUser(access.userId, access.isOwner, address);
    if (!allowed) {
      return NextResponse.json({ success: false, error: "You can only view activity for tracked wallets." }, { status: 403 });
    }

    const [trades, positions, closedPositions] = await Promise.all([
      wantTrades ? fetchPolymarketTrades(address, tradeLimit) : Promise.resolve([]),
      wantPositions ? fetchPolymarketPositions(address, posLimit) : Promise.resolve([]),
      wantClosed ? fetchPolymarketClosedPositions(address, closedLimit) : Promise.resolve([]),
    ]);

    const stats = aggregateTradesStats(trades);

    return NextResponse.json({
      success: true,
      address,
      trades: wantTrades ? trades : [],
      positions: wantPositions ? positions : [],
      closedPositions: wantClosed ? closedPositions : [],
      tradeStats: stats,
      /** Trades list is capped; volume is sum of size×price over returned fills only. */
      tradeStatsNote:
        "Volume and counts are computed from the returned trade fills only (not full account lifetime unless the API returns every fill).",
    });
  } catch (e) {
    console.error("polymarket-tracker/activity:", e);
    const message = e instanceof Error ? e.message : "Failed to load activity.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
