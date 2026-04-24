import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getTopMemeCoinsAccess } from "@/lib/vip-futures-addon-access";
import { getTrendingBscPairs, getTrendingSolanaPairs } from "@/lib/api-clients/dexscreener";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const access = await getTopMemeCoinsAccess(session);
    if (!access.ok) {
      return NextResponse.json({ success: false, error: access.error, locked: access.status === 403 }, { status: access.status });
    }

    const minLiquidity = 20_000;
    const minMarketCap = 250_000;
    const minAgeDays = 3;
    const cutoff = new Date(Date.now() - minAgeDays * 24 * 60 * 60 * 1000);
    const rows = await prisma.token.findMany({
      where: {
        chain: { in: ["solana", "bsc"] },
        isHoneypot: false,
        launchedAt: { lte: cutoff },
        liquidity: { gte: minLiquidity },
        marketCap: { gte: minMarketCap },
        OR: [{ topHolderPct: null }, { topHolderPct: { lte: 35 } }],
      },
      orderBy: [{ marketCap: "desc" }, { liquidity: "desc" }],
      take: 80,
    });

    let safeRows = (rows as Array<Record<string, unknown>>)
      .map((r) => {
        const liq = Number(r.liquidity ?? 0);
        const mcap = Number(r.marketCap ?? 0);
        const change24h = Number(r.priceChange24h ?? 0);
        const ageDays = Math.max(1, Math.floor((Date.now() - new Date(String(r.launchedAt)).getTime()) / (24 * 60 * 60 * 1000)));
        const isDownBadly = change24h <= -25;
        const isLowLiquidity = liq < minLiquidity;
        const deadFlag = isDownBadly || isLowLiquidity;
        const score =
          (mcap >= 2_000_000 ? 35 : 20) +
          (liq >= 150_000 ? 30 : 15) +
          (!deadFlag ? 20 : 0) +
          (ageDays >= 30 ? 15 : 5);
        return {
          symbol: String(r.symbol ?? ""),
          name: String(r.name ?? ""),
          chain: String(r.chain ?? ""),
          contractAddress: String(r.contractAddress ?? ""),
          marketCap: mcap,
          liquidity: liq,
          priceUSD: (r.priceUSD as number | null | undefined) ?? null,
          priceChange24h: change24h,
          topHolderPct: (r.topHolderPct as number | null | undefined) ?? null,
          launchedAt: r.launchedAt,
          website: (r.website as string | null | undefined) ?? null,
          twitter: (r.twitter as string | null | undefined) ?? null,
          telegram: (r.telegram as string | null | undefined) ?? null,
          score: Math.max(0, Math.min(100, score)),
          deadFlag,
          qualityNote: deadFlag
            ? "Caution: momentum/liquidity risk detected. Better for watchlist than immediate buys."
            : "Healthy liquidity + age profile for scalp/swing watchlist consideration.",
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 30);

    // Fallback: if DB has no qualified rows yet, use live DexScreener trending data.
    if (safeRows.length === 0) {
      const [solPairs, bscPairs] = await Promise.all([getTrendingSolanaPairs(40), getTrendingBscPairs(40)]);
      const fallback = [...solPairs, ...bscPairs]
        .map((p) => {
          const liq = Number(p.liquidity?.usd ?? 0);
          const mcap = Number(p.fdv ?? 0);
          const change24h = Number(p.priceChange?.h24 ?? 0);
          const ageDays = Math.max(1, Math.floor((Date.now() - Number(p.pairCreatedAt ?? Date.now())) / (24 * 60 * 60 * 1000)));
          const deadFlag = change24h <= -25 || liq < minLiquidity;
          const score =
            (mcap >= 2_000_000 ? 35 : mcap >= minMarketCap ? 20 : 10) +
            (liq >= 150_000 ? 30 : liq >= minLiquidity ? 15 : 5) +
            (!deadFlag ? 20 : 0) +
            (ageDays >= 30 ? 15 : ageDays >= minAgeDays ? 8 : 3);
          return {
            symbol: p.baseToken?.symbol ?? "—",
            name: p.baseToken?.name ?? "Unknown",
            chain: p.chainId ?? "unknown",
            contractAddress: p.baseToken?.address ?? p.pairAddress ?? "",
            marketCap: mcap,
            liquidity: liq,
            priceUSD: p.priceUsd ? Number(p.priceUsd) : null,
            priceChange24h: change24h,
            topHolderPct: null,
            launchedAt: new Date(Number(p.pairCreatedAt ?? Date.now())).toISOString(),
            website: null,
            twitter: null,
            telegram: null,
            score: Math.max(0, Math.min(100, score)),
            deadFlag,
            qualityNote: deadFlag
              ? "Caution: weaker momentum/liquidity profile. Watch before trading."
              : "Good live liquidity/momentum profile for shortlist review.",
          };
        })
        .filter((x) => x.symbol && x.contractAddress)
        .sort((a, b) => b.score - a.score)
        .slice(0, 30);
      safeRows = fallback;
    }

    return NextResponse.json({
      success: true,
      filters: { minLiquidity, minMarketCap, minAgeDays, excludedHoneypots: true },
      coins: safeRows,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Top Meme coins failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
