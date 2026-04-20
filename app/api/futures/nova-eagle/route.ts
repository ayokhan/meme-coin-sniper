import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchTopTradersForSession } from "@/lib/hyperliquid-top-traders-session";
import { getNovaEagleAccess } from "@/lib/vip-futures-addon-access";
import { summarizeNovaEagleForAi } from "@/lib/ai-nova-eagle";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DISCLAIMER =
  "Nova Eagle shows aggregated open positions from wallets on your Top Leverage Traders list (plus inferred xyz markets). It is not a complete picture of all whales, not real-time order flow, and not insider information. Not financial advice.";

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
        `${a.coin}: among large tracked positions, about ${(shortShare * 100).toFixed(0)}% of notional is short (${a.whaleCount} wallet(s)). Consider how that fits your own read of price action and risk.`
      );
    } else if (longShare >= 0.58 && a.whaleCount >= 1) {
      out.push(
        `${a.coin}: among large tracked positions, about ${(longShare * 100).toFixed(0)}% of notional is long (${a.whaleCount} wallet(s)).`
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

    const traders = await fetchTopTradersForSession(session!);
    const whales: WhaleRow[] = [];
    const byCoin = new Map<string, { longUsd: number; shortUsd: number; addrs: Set<string> }>();

    for (const t of traders) {
      for (const p of t.positions ?? []) {
        const v = Number(p.positionValue ?? 0);
        if (!Number.isFinite(v) || v < minUsd) continue;
        whales.push({
          address: t.address,
          nickname: t.nickname ?? null,
          coin: p.coin,
          side: p.side,
          positionUsd: v,
          apexLiquidUrl: t.apexLiquidUrl,
          isGlobal: t.isGlobal,
        });
        const row = byCoin.get(p.coin) ?? { longUsd: 0, shortUsd: 0, addrs: new Set<string>() };
        row.addrs.add(t.address.toLowerCase());
        if (p.side === "long") row.longUsd += v;
        else row.shortUsd += v;
        byCoin.set(p.coin, row);
      }
    }

    whales.sort((a, b) => b.positionUsd - a.positionUsd);

    const aggregates: CoinAgg[] = Array.from(byCoin.entries()).map(([coin, v]) => ({
      coin,
      longUsd: v.longUsd,
      shortUsd: v.shortUsd,
      whaleCount: v.addrs.size,
    }));

    const heuristics = buildHeuristics(aggregates);

    let aiBrief: { text: string; aiGenerated: boolean } | null = null;
    if (withAi && aggregates.length > 0) {
      aiBrief = await summarizeNovaEagleForAi({ aggregates, heuristics });
    }

    return NextResponse.json({
      success: true,
      minUsd,
      disclaimer: DISCLAIMER,
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
