import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getNovaEagleAccess } from "@/lib/vip-futures-addon-access";
import { getTopTradersPositions, getUserFills } from "@/lib/api-clients/hyperliquid";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function analyzeWalletQuality(winRate: number, closedTrades: number, openPositions: number): string {
  if (closedTrades < 8) return "Insufficient closed-trade history. Watch longer before copying.";
  if (winRate >= 62 && openPositions > 0) return "Strong recent profile for copywatching. Still size small and manage risk.";
  if (winRate >= 52) return "Mixed-to-decent profile. Consider selective copying with strict risk limits.";
  return "Weak recent profile. Prefer monitoring rather than copying for now.";
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const access = await getNovaEagleAccess(session);
    if (!access.ok) {
      return NextResponse.json(
        { success: false, error: access.error, locked: access.status === 403, disabled: access.disabled },
        { status: access.status }
      );
    }

    const { searchParams } = new URL(request.url);
    const address = String(searchParams.get("address") ?? "").trim().toLowerCase();
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json({ success: false, error: "Valid wallet address is required." }, { status: 400 });
    }

    const [top, fills] = await Promise.all([
      getTopTradersPositions([{ address }]),
      getUserFills(address).catch(() => []),
    ]);
    const trader = top[0];
    const openPositions = (trader?.positions ?? []).length;

    const closed = fills.filter((f) => {
      const dir = String(f.dir ?? "").toLowerCase();
      return dir.includes("close") || dir.includes("reduce");
    });
    const withPnl = closed.filter((f) => Number.isFinite(Number(f.closedPnl ?? "")));
    const wins = withPnl.filter((f) => Number(f.closedPnl ?? "0") > 0).length;
    const losses = withPnl.filter((f) => Number(f.closedPnl ?? "0") < 0).length;
    const closedTrades = withPnl.length;
    const winRate = closedTrades > 0 ? (wins / closedTrades) * 100 : 0;

    const totalRealizedPnlUsd = withPnl.reduce((sum, f) => sum + Number(f.closedPnl ?? "0"), 0);
    const avgRealizedPnlUsd = closedTrades > 0 ? totalRealizedPnlUsd / closedTrades : 0;

    const summary = analyzeWalletQuality(winRate, closedTrades, openPositions);

    return NextResponse.json({
      success: true,
      address,
      summary,
      metrics: {
        winRate,
        wins,
        losses,
        closedTrades,
        openPositions,
        totalRealizedPnlUsd,
        avgRealizedPnlUsd,
        fillsSampled: fills.length,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to analyze wallet";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
