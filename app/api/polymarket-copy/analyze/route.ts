import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPolymarketTrackerAccess } from "@/lib/polymarket-tracker-access";
import {
  aggregateTradesStats,
  fetchPolymarketClosedPositions,
  fetchPolymarketPortfolioValueUsd,
  fetchPolymarketPositions,
  fetchPolymarketTrades,
} from "@/lib/polymarket-data-api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isValidEvmAddress(addr: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(addr.trim());
}

/** GET — analyze any proxy wallet (read-only public API). VIP Nova Polymarket access required. */
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
    const address = searchParams.get("address")?.trim().toLowerCase() ?? "";
    const tradeLimit = Math.min(200, Math.max(1, parseInt(searchParams.get("tradeLimit") ?? "100", 10) || 100));
    const tradeOffset = Math.min(10000, Math.max(0, parseInt(searchParams.get("tradeOffset") ?? "0", 10) || 0));
    const posLimit = Math.min(200, Math.max(1, parseInt(searchParams.get("positionsLimit") ?? "120", 10) || 120));
    const closedLimit = Math.min(200, Math.max(1, parseInt(searchParams.get("closedLimit") ?? "120", 10) || 120));
    const fields = (searchParams.get("fields") ?? "full").toLowerCase();

    if (!isValidEvmAddress(address)) {
      return NextResponse.json({ success: false, error: "Valid 0x address required." }, { status: 400 });
    }

    if (fields === "trades") {
      const trades = await fetchPolymarketTrades(address, tradeLimit, tradeOffset);
      const stats = aggregateTradesStats(trades);
      const tradesHasMore = trades.length === tradeLimit && tradeOffset + tradeLimit < 10000;
      const nextTradeOffset = tradeOffset + trades.length;
      return NextResponse.json({
        success: true,
        address,
        trades,
        tradeOffset,
        nextTradeOffset,
        tradesHasMore,
        tradeStats: stats,
      });
    }

    const [valueUsd, positions, trades, closedPositions] = await Promise.all([
      fetchPolymarketPortfolioValueUsd(address),
      fetchPolymarketPositions(address, posLimit),
      fetchPolymarketTrades(address, tradeLimit, tradeOffset),
      fetchPolymarketClosedPositions(address, closedLimit),
    ]);

    const stats = aggregateTradesStats(trades);
    const tradesHasMore = trades.length === tradeLimit && tradeOffset + tradeLimit < 10000;
    const nextTradeOffset = tradeOffset + trades.length;

    return NextResponse.json({
      success: true,
      address,
      valueUsd,
      positionCount: positions.length,
      closedPositionCount: closedPositions.length,
      positions,
      closedPositions,
      trades,
      tradeOffset,
      nextTradeOffset,
      tradesHasMore,
      tradeStats: stats,
      tradeStatsNote:
        "Stats are for this trade batch only (offset pagination). Polymarket’s public data API; not financial advice.",
      polymarketProfileUrl: `https://polymarket.com/profile/${address}`,
    });
  } catch (e) {
    console.error("polymarket-copy/analyze:", e);
    const message = e instanceof Error ? e.message : "Failed to analyze wallet.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
