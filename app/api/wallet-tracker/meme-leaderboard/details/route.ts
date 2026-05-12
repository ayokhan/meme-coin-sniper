import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getMemeLeaderboardAccess } from "@/lib/meme-leaderboard-access";
import { computeWalletMemePnl } from "@/lib/api-clients/helius-wallet-pnl";
import { getSolUsdPrice, getSolanaTokenPricesUsd } from "@/lib/api-clients/dexscreener-prices";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PERIOD_MAP: Record<string, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

function isValidSolanaAddress(addr: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr.trim());
}

/** GET - Per-wallet drilldown: per-mint realized SOL breakdown over the window. Recomputed live. */
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
      },
      { status: access.status },
    );
  }

  const url = new URL(request.url);
  const wallet = (url.searchParams.get("wallet") ?? "").trim();
  const periodRaw = (url.searchParams.get("period") ?? "7d").toLowerCase();
  const periodKey = PERIOD_MAP[periodRaw] ? periodRaw : "7d";
  const periodMs = PERIOD_MAP[periodKey];
  if (!wallet || !isValidSolanaAddress(wallet)) {
    return NextResponse.json({ success: false, error: "Valid Solana wallet address required." }, { status: 400 });
  }

  try {
    const solUsd = await getSolUsdPrice();
    const pnl = await computeWalletMemePnl(wallet, { periodMs, solUsd });
    const mints = Array.from(pnl.perMintRealizedSol.keys());
    const prices = mints.length > 0 ? await getSolanaTokenPricesUsd(mints) : new Map();

    const positions = Array.from(pnl.perMintRealizedSol.entries())
      .map(([mint, v]) => {
        const meta = prices.get(mint);
        return {
          mint,
          symbol: v.symbol ?? meta?.symbol ?? null,
          trades: v.trades,
          realizedSol: v.realizedSol,
          realizedUsd: v.realizedSol * solUsd,
          currentPriceUsd: meta?.priceUsd ?? null,
        };
      })
      .sort((a, b) => b.realizedUsd - a.realizedUsd);

    return NextResponse.json({
      success: true,
      wallet,
      period: periodKey,
      solUsd,
      totals: {
        realizedPnlUsd: pnl.realizedPnlUsd,
        volumeUsd: pnl.volumeUsd,
        tradeCount: pnl.tradeCount,
        winRatePct: pnl.winRatePct,
        biggestWinSymbol: pnl.biggestWinSymbol,
        biggestWinMint: pnl.biggestWinMint,
        biggestWinPnlUsd: pnl.biggestWinPnlUsd,
      },
      positions,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to compute details." },
      { status: 500 },
    );
  }
}
