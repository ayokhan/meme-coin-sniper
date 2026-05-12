import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getTrackedWallets } from "@/lib/wallet-tracker-config";
import { FEATURE_FLAG_KEYS, getFeatureFlag } from "@/lib/feature-flags";
import {
  computeWalletMemePnl,
  getWalletHoldings,
} from "@/lib/api-clients/helius-wallet-pnl";
import {
  getSolUsdPrice,
  getSolanaTokenPricesUsd,
} from "@/lib/api-clients/dexscreener-prices";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const PERIOD_MAP: Record<string, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

const NOTES_TEXT =
  "Approximation: net SOL flow per token × SOL/USD (Helius free tier). Holdings priced via Dexscreener (free).";

function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

async function authorize(request: Request): Promise<{ ok: true; isCron: boolean } | { ok: false; status: number; error: string }> {
  if (isCronAuthorized(request)) return { ok: true, isCron: true };
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, status: 401, error: "Sign in required." };
  if (!isOwnerSession(session)) return { ok: false, status: 403, error: "Owner only." };
  const enabled = await getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_MEME_LEADERBOARD);
  if (!enabled) return { ok: false, status: 403, error: "Meme Leaderboard is disabled by admin." };
  return { ok: true, isCron: false };
}

export async function POST(request: Request) {
  const auth = await authorize(request);
  if (!auth.ok) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

  const url = new URL(request.url);
  const periodRaw = (url.searchParams.get("period") ?? "7d").toLowerCase();
  const periodKey = PERIOD_MAP[periodRaw] ? periodRaw : "7d";
  const periodMs = PERIOD_MAP[periodKey];
  const onlyParam = url.searchParams.get("wallet");

  try {
    const wallets = await getTrackedWallets();

    // Also include user-personal Solana wallets so they appear on the leaderboard for their owner.
    const userMemeWallets = (await (prisma as unknown as {
      userMemeCoinWallet: { findMany: (args: unknown) => Promise<Array<{ address: string; label: string | null; chain: string }>> };
    }).userMemeCoinWallet.findMany({ where: { chain: "solana" } })) ?? [];

    const byAddress = new Map<string, { address: string; label: string | null }>();
    for (const w of wallets) {
      byAddress.set(w.address, { address: w.address, label: w.label ?? null });
    }
    for (const w of userMemeWallets) {
      // Prefer the admin-curated label when both exist.
      if (!byAddress.has(w.address)) {
        byAddress.set(w.address, { address: w.address, label: w.label ?? null });
      }
    }

    const merged = Array.from(byAddress.values());
    const list = onlyParam ? merged.filter((w) => w.address === onlyParam) : merged;
    if (list.length === 0) {
      return NextResponse.json({ success: true, refreshed: 0, period: periodKey, message: "No tracked wallets." });
    }

    const solUsd = await getSolUsdPrice();

    let refreshed = 0;
    const errors: Array<{ wallet: string; error: string }> = [];

    // Process wallets sequentially to stay friendly with the Helius free-tier RPS budget.
    for (const w of list) {
      try {
        const pnl = await computeWalletMemePnl(w.address, { periodMs, solUsd });
        const holdings = await getWalletHoldings(w.address);

        let unrealizedHoldingsUsd = 0;
        if (holdings.length > 0) {
          const mintList = holdings.map((h) => h.mint);
          const prices = await getSolanaTokenPricesUsd(mintList);
          for (const h of holdings) {
            const p = prices.get(h.mint);
            if (!p) continue;
            unrealizedHoldingsUsd += h.uiAmount * p.priceUsd;
          }
        }

        const totalPnlUsd = pnl.realizedPnlUsd + unrealizedHoldingsUsd;

        await (prisma as unknown as {
          memeTraderStats: {
            upsert: (args: unknown) => Promise<unknown>;
          };
        }).memeTraderStats.upsert({
          where: { walletAddress_periodKey: { walletAddress: w.address, periodKey } },
          create: {
            walletAddress: w.address,
            periodKey,
            label: w.label ?? null,
            realizedPnlUsd: pnl.realizedPnlUsd,
            unrealizedHoldingsUsd,
            totalPnlUsd,
            volumeUsd: pnl.volumeUsd,
            tradeCount: pnl.tradeCount,
            winRatePct: pnl.winRatePct,
            biggestWinMint: pnl.biggestWinMint,
            biggestWinSymbol: pnl.biggestWinSymbol,
            biggestWinPnlUsd: pnl.biggestWinPnlUsd,
            notes: NOTES_TEXT,
          },
          update: {
            label: w.label ?? null,
            realizedPnlUsd: pnl.realizedPnlUsd,
            unrealizedHoldingsUsd,
            totalPnlUsd,
            volumeUsd: pnl.volumeUsd,
            tradeCount: pnl.tradeCount,
            winRatePct: pnl.winRatePct,
            biggestWinMint: pnl.biggestWinMint,
            biggestWinSymbol: pnl.biggestWinSymbol,
            biggestWinPnlUsd: pnl.biggestWinPnlUsd,
            notes: NOTES_TEXT,
            computedAt: new Date(),
          },
        });

        refreshed += 1;
      } catch (innerErr) {
        errors.push({
          wallet: w.address,
          error: innerErr instanceof Error ? innerErr.message : "compute failed",
        });
      }
    }

    return NextResponse.json({
      success: true,
      refreshed,
      period: periodKey,
      totalWallets: list.length,
      solUsd,
      errors: errors.slice(0, 10),
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Refresh failed" },
      { status: 500 },
    );
  }
}
