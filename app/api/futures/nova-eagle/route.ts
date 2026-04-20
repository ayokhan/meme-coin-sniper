import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchTopTradersForSession, fetchTopTradersFromAddresses } from "@/lib/hyperliquid-top-traders-session";
import { getNovaEagleAccess } from "@/lib/vip-futures-addon-access";
import { summarizeNovaEagleForAi } from "@/lib/ai-nova-eagle";
import { APEXLIQUID_TOP_TRADERS } from "@/lib/config/apexliquid-top-traders";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DISCLAIMER_TRACKED =
  "Nova Eagle (Tracked mode) shows aggregated open positions from wallets on your Top Leverage Traders list (plus inferred xyz markets). This is not a complete picture of all whales, not real-time order flow, and not insider information. Not financial advice.";
const DISCLAIMER_GLOBAL =
  "Nova Eagle (Global mode) scans a broader public top-trader wallet set from Apex/Hyperliquid-style leaderboards (plus inferred xyz markets). It is still a sample, not all wallets in the world, not real-time order flow, and not insider information. Not financial advice.";

type WhaleRow = {
  address: string;
  nickname: string | null;
  coin: string;
  side: "long" | "short";
  positionUsd: number;
  apexLiquidUrl: string;
  isGlobal: boolean;
};

type CoinAgg = {
  coin: string;
  longUsd: number;
  shortUsd: number;
  whaleCount: number;
};

function buildHeuristics(aggs: CoinAgg[]): string[] {
  const sorted = [...aggs].sort((a, b) => b.longUsd + b.shortUsd - (a.longUsd + a.shortUsd));
  const out: string[] = [];
  for (const a of sorted.slice(0, 10)) {
    const t = a.longUsd + a.shortUsd;
    if (t < 500_000) continue;
    const shortShare = a.shortUsd / (t + 1e-9);
    const longShare = a.longUsd / (t + 1e-9);
    if (shortShare >= 0.58 && a.whaleCount >= 1) {
      out.push(
        `${a.coin}: among large sampled positions, about ${(shortShare * 100).toFixed(0)}% of notional is short (${a.whaleCount} wallet(s)). Consider how that fits your own read of price action and risk.`
      );
    } else if (longShare >= 0.58 && a.whaleCount >= 1) {
      out.push(
        `${a.coin}: among large sampled positions, about ${(longShare * 100).toFixed(0)}% of notional is long (${a.whaleCount} wallet(s)).`
      );
    }
  }
  if (out.length === 0) {
    out.push("No strong long/short skew detected above the minimum size threshold—either fewer large positions or more balanced sides.");
  }
  return out;
}

/** VIP + flag: large tracked perp positions + skew heuristics (+ optional AI blurb). */
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
    const minUsd = Math.max(50_000, Math.min(50_000_000, Number(searchParams.get("minUsd") ?? "500000") || 500_000));
    const withAi = searchParams.get("ai") === "1";
    const mode = searchParams.get("mode") === "global" ? "global" : "tracked";

    const traders =
      mode === "global"
        ? await fetchTopTradersFromAddresses(APEXLIQUID_TOP_TRADERS.map((t) => t.address))
        : await fetchTopTradersForSession(session!);
    const whales: WhaleRow[] = [];
    const byCoin = new Map<string, { longUsd: number; shortUsd: number; addrs: Set<string> }>();
    const btcEthAll = new Map<string, { longUsd: number; shortUsd: number; addrs: Set<string> }>([
      ["BTC", { longUsd: 0, shortUsd: 0, addrs: new Set<string>() }],
      ["ETH", { longUsd: 0, shortUsd: 0, addrs: new Set<string>() }],
    ]);

    for (const t of traders) {
      for (const p of t.positions ?? []) {
        const v = Number(p.positionValue ?? 0);
        if (!Number.isFinite(v) || v <= 0) continue;
        const coin = p.coin.toUpperCase();
        if (coin === "BTC" || coin === "ETH") {
          const row = btcEthAll.get(coin)!;
          row.addrs.add(t.address.toLowerCase());
          if (p.side === "long") row.longUsd += v;
          else row.shortUsd += v;
        }
        if (v < minUsd) continue;
        whales.push({
          address: t.address,
          nickname: t.nickname ?? null,
          coin: p.coin,
          side: p.side,
          positionUsd: v,
          apexLiquidUrl: t.apexLiquidUrl,
          isGlobal: t.isGlobal,
        });
        const row = byCoin.get(coin) ?? { longUsd: 0, shortUsd: 0, addrs: new Set<string>() };
        row.addrs.add(t.address.toLowerCase());
        if (p.side === "long") row.longUsd += v;
        else row.shortUsd += v;
        byCoin.set(coin, row);
      }
    }

    whales.sort((a, b) => b.positionUsd - a.positionUsd);

    const aggregates: CoinAgg[] = Array.from(byCoin.entries()).map(([coin, v]) => ({
      coin,
      longUsd: v.longUsd,
      shortUsd: v.shortUsd,
      whaleCount: v.addrs.size,
    }));
    for (const focusCoin of ["BTC", "ETH"] as const) {
      if (aggregates.some((a) => a.coin === focusCoin)) continue;
      const row = btcEthAll.get(focusCoin)!;
      aggregates.push({
        coin: focusCoin,
        longUsd: row.longUsd,
        shortUsd: row.shortUsd,
        whaleCount: row.addrs.size,
      });
    }

    const heuristics = buildHeuristics(aggregates);

    let aiBrief: { text: string; aiGenerated: boolean } | null = null;
    if (withAi && aggregates.length > 0) {
      aiBrief = await summarizeNovaEagleForAi({ aggregates, heuristics });
    }

    return NextResponse.json({
      success: true,
      mode,
      minUsd,
      disclaimer: mode === "global" ? DISCLAIMER_GLOBAL : DISCLAIMER_TRACKED,
      whales,
      aggregates: aggregates.sort((a, b) => b.longUsd + b.shortUsd - (a.longUsd + a.shortUsd)),
      heuristics,
      aiBrief,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Nova Eagle failed";
    console.error("nova-eagle:", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
