import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPolymarketTrackerAccess } from "@/lib/polymarket-tracker-access";
import {
  fetchPolymarketClosedPositions,
  fetchPolymarketTrades,
  tradeNotionalUsd,
} from "@/lib/polymarket-data-api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function shortAddr(a: string) {
  if (a.length < 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

/** GET — topic radar from tracked top traders. VIP Polymarket access required. */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const access = await getPolymarketTrackerAccess(session);
    if (!access.ok) {
      return NextResponse.json({ success: false, error: access.error, disabled: access.disabled }, { status: access.status });
    }

    const { searchParams } = new URL(request.url);
    const topic = (searchParams.get("topic") ?? "").trim();
    if (topic.length < 2) {
      return NextResponse.json({ success: false, error: "Topic must be at least 2 characters." }, { status: 400 });
    }
    const q = topic.toLowerCase();

    const tracked = await prisma.polymarketTrackedWallet.findMany({
      where: { active: true, global: true },
      orderBy: [{ global: "desc" }, { createdAt: "asc" }],
      take: 8,
    });
    if (!tracked.length) {
      return NextResponse.json({
        success: true,
        topic,
        scannedWallets: 0,
        predictedWinRate: 50,
        topTraderSignal: "mixed",
        recommendation: "No tracked global wallets available yet.",
        bullishCount: 0,
        bearishCount: 0,
        neutralCount: 0,
        topWallets: [],
        note: "Add global trader wallets in Admin → Polymarket Tracker for stronger radar output.",
      });
    }

    const perWallet = await Promise.all(
      tracked.map(async (w) => {
        const [trades, closed] = await Promise.all([
          fetchPolymarketTrades(w.address, 250, 0),
          fetchPolymarketClosedPositions(w.address, 140),
        ]);
        const topicTrades = trades.filter((t) => String(t.title ?? "").toLowerCase().includes(q));
        const buyCount = topicTrades.filter((t) => String(t.side ?? "").toUpperCase() === "BUY").length;
        const sellCount = topicTrades.filter((t) => String(t.side ?? "").toUpperCase() === "SELL").length;
        const topicNetFlowUsd = topicTrades.reduce((acc, t) => {
          const sign = String(t.side ?? "").toUpperCase() === "SELL" ? -1 : 1;
          return acc + sign * tradeNotionalUsd(t);
        }, 0);
        const topicClosed = closed.filter((c) => String(c.title ?? "").toLowerCase().includes(q));
        const wins = topicClosed.filter((c) => Number(c.realizedPnl ?? 0) > 0).length;
        const topicWinRate = topicClosed.length > 0 ? (wins / topicClosed.length) * 100 : null;
        return {
          address: w.address,
          nickname: w.nickname,
          topicTradeCount: topicTrades.length,
          buyCount,
          sellCount,
          topicWinRate,
          topicNetFlowUsd,
        };
      })
    );

    const active = perWallet.filter((w) => w.topicTradeCount > 0);
    let bullishCount = 0;
    let bearishCount = 0;
    let neutralCount = 0;
    for (const w of active) {
      if (w.topicNetFlowUsd > 0 || w.buyCount > w.sellCount) bullishCount += 1;
      else if (w.topicNetFlowUsd < 0 || w.sellCount > w.buyCount) bearishCount += 1;
      else neutralCount += 1;
    }
    const signal: "bullish" | "bearish" | "mixed" =
      bullishCount > bearishCount ? "bullish" : bearishCount > bullishCount ? "bearish" : "mixed";

    const winRates = active.map((w) => w.topicWinRate).filter((v): v is number => v != null && Number.isFinite(v));
    const avgWinRate = winRates.length ? winRates.reduce((a, b) => a + b, 0) / winRates.length : 50;
    const voteBalance = active.length ? (bullishCount - bearishCount) / active.length : 0;
    const predictedWinRate = clamp(avgWinRate + voteBalance * 18, 25, 85);

    const recommendation =
      signal === "bullish"
        ? "Bias: bullish. Top tracked wallets show stronger buy flow on this topic. Favor YES/up setups only when liquidity and risk limits are clean."
        : signal === "bearish"
          ? "Bias: bearish. Top tracked wallets show stronger sell flow on this topic. Favor NO/down setups only with strict sizing and invalidation."
          : "Bias: mixed. Top tracked wallets are split. Keep size smaller and wait for clearer alignment before committing.";

    return NextResponse.json({
      success: true,
      topic,
      scannedWallets: tracked.length,
      predictedWinRate: Number(predictedWinRate.toFixed(1)),
      topTraderSignal: signal,
      recommendation,
      bullishCount,
      bearishCount,
      neutralCount,
      topWallets: active
        .sort((a, b) => Math.abs(b.topicNetFlowUsd) - Math.abs(a.topicNetFlowUsd))
        .slice(0, 5)
        .map((w) => ({
          ...w,
          nickname: w.nickname ?? shortAddr(w.address),
          topicWinRate: w.topicWinRate != null ? Number(w.topicWinRate.toFixed(1)) : null,
          topicNetFlowUsd: Number(w.topicNetFlowUsd.toFixed(2)),
        })),
      note:
        "Predicted win rate is a heuristic from tracked-wallet history + current topic flow in public Polymarket data. It is not a guarantee.",
    });
  } catch (e) {
    console.error("polymarket-radar/topic:", e);
    const message = e instanceof Error ? e.message : "Failed to run topic radar.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

