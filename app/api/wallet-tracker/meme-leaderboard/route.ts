import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getMemeLeaderboardAccess } from "@/lib/meme-leaderboard-access";

export const dynamic = "force-dynamic";

const ALLOWED_PERIODS = new Set(["24h", "7d", "30d"]);

type LeaderboardRow = {
  walletAddress: string;
  label: string | null;
  realizedPnlUsd: number;
  unrealizedHoldingsUsd: number;
  totalPnlUsd: number;
  volumeUsd: number;
  tradeCount: number;
  winRatePct: number | null;
  biggestWinMint: string | null;
  biggestWinSymbol: string | null;
  biggestWinPnlUsd: number | null;
  notes: string | null;
  computedAt: string;
};

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const access = await getMemeLeaderboardAccess(session);
  if (!access.ok) {
    return NextResponse.json(
      {
        success: false,
        error: access.error,
        disabled: access.disabled === true,
        locked: access.locked === true,
        rows: [],
      },
      { status: access.status },
    );
  }

  const url = new URL(request.url);
  const periodRaw = (url.searchParams.get("period") ?? "7d").toLowerCase();
  const period = ALLOWED_PERIODS.has(periodRaw) ? periodRaw : "7d";
  const limitParam = Number(url.searchParams.get("limit") ?? 50);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(Math.trunc(limitParam), 5), 100) : 50;

  try {
    const stats = await (prisma as unknown as {
      memeTraderStats: {
        findMany: (args: unknown) => Promise<Array<{
          walletAddress: string;
          label: string | null;
          realizedPnlUsd: number;
          unrealizedHoldingsUsd: number;
          totalPnlUsd: number;
          volumeUsd: number;
          tradeCount: number;
          winRatePct: number | null;
          biggestWinMint: string | null;
          biggestWinSymbol: string | null;
          biggestWinPnlUsd: number | null;
          notes: string | null;
          computedAt: Date;
        }>>;
      };
    }).memeTraderStats.findMany({
      where: { periodKey: period },
      orderBy: [{ totalPnlUsd: "desc" }, { realizedPnlUsd: "desc" }],
      take: limit,
    });

    const rows: LeaderboardRow[] = stats.map((s) => ({
      walletAddress: s.walletAddress,
      label: s.label,
      realizedPnlUsd: s.realizedPnlUsd,
      unrealizedHoldingsUsd: s.unrealizedHoldingsUsd,
      totalPnlUsd: s.totalPnlUsd,
      volumeUsd: s.volumeUsd,
      tradeCount: s.tradeCount,
      winRatePct: s.winRatePct,
      biggestWinMint: s.biggestWinMint,
      biggestWinSymbol: s.biggestWinSymbol,
      biggestWinPnlUsd: s.biggestWinPnlUsd,
      notes: s.notes,
      computedAt: s.computedAt.toISOString(),
    }));

    const lastComputedAt = rows.length > 0 ? rows.reduce((a, b) => (a > b.computedAt ? a : b.computedAt), rows[0].computedAt) : null;

    return NextResponse.json({
      success: true,
      period,
      rows,
      isOwner: access.isOwner,
      lastComputedAt,
      methodology:
        "Approximation. Realized PnL = net SOL flow per token × SOL/USD (Helius free tier). Holdings priced via Dexscreener (free, no key). Win rate counts mints with at least one SELL.",
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to load leaderboard", rows: [] },
      { status: 500 },
    );
  }
}
