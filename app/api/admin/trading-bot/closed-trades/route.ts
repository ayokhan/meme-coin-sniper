import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getFillsHistory as getFillsHistoryBlofin, getOrderHistory as getOrderHistoryBlofin } from "@/lib/blofin";
import { getFillsHistory as getFillsHistoryCoinbase, getOrderHistory as getOrderHistoryCoinbase } from "@/lib/coinbase";
import {
  analyzeClosedTrades,
  closedTradesFromFills,
  closedTradesFromOrders,
  closedTradesPeriodDays,
  closedTradesPeriodLabel,
  filterClosedTradesByPeriod,
  mergeClosedTrades,
  sumClosedTradesRealized,
  type ClosedTradesPeriod,
} from "@/lib/closed-trades";
import {
  resolveExchangeConfigForTradingBotSession,
  getTradingBotExchangeMeta,
  parseExchangeProviderParam,
} from "@/lib/trading-bot-exchange-session";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

async function getBotLeverage(): Promise<number> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bot = await (prisma as any).tradingBot.findFirst({ orderBy: { updatedAt: "desc" } });
    const lev = Number(bot?.leverage);
    return Number.isFinite(lev) && lev > 0 ? lev : 10;
  } catch {
    return 10;
  }
}

/** GET — Parsed closed round-trips for PNL share cards. */
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(req.url);
    const resolved = await resolveExchangeConfigForTradingBotSession(session, {
      provider: parseExchangeProviderParam(searchParams.get("provider")),
    });
    if (!resolved.ok) {
      return NextResponse.json({ success: false, error: resolved.error }, { status: resolved.status });
    }
    const { provider, credentialSource } = resolved;
    const config = provider === "coinbase" ? resolved.coinbase! : resolved.blofin!;
    const exchange = await getTradingBotExchangeMeta(provider, credentialSource, config);
    const isDemo = exchange.demo;
    const leverage = await getBotLeverage();
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "100", 10) || 100));
    const periodRaw = searchParams.get("period") ?? "7d";
    const normalized = periodRaw === "1d" ? "24h" : periodRaw;
    const valid: ClosedTradesPeriod[] = ["24h", "3d", "7d", "14d", "30d", "60d", "90d", "all"];
    const period: ClosedTradesPeriod = valid.includes(normalized as ClosedTradesPeriod)
      ? (normalized as ClosedTradesPeriod)
      : "7d";

    const [fills, orders] =
      provider === "coinbase"
        ? await Promise.all([
            getFillsHistoryCoinbase({ demo: isDemo, limit, config: resolved.coinbase! }).catch(() => []),
            getOrderHistoryCoinbase({ demo: isDemo, limit, config: resolved.coinbase! }),
          ])
        : await Promise.all([
            getFillsHistoryBlofin({ demo: isDemo, limit, config: resolved.blofin! }).catch(() => []),
            getOrderHistoryBlofin({ demo: isDemo, limit, config: resolved.blofin! }),
          ]);

    const leverageByInst = new Map<string, number>();
    const leverageByOrderId = new Map<string, number>();
    for (const o of orders) {
      const lev = Number(o.leverage);
      if (o.instId && Number.isFinite(lev) && lev > 0) leverageByInst.set(o.instId, lev);
      if (o.orderId && Number.isFinite(lev) && lev > 0) leverageByOrderId.set(o.orderId, lev);
    }

    const fromFills = closedTradesFromFills(fills, leverage, leverageByInst, leverageByOrderId);
    const fromOrders = closedTradesFromOrders(orders, leverage);
    const allClosedTrades = mergeClosedTrades(fromFills, fromOrders);
    const closedTrades = filterClosedTradesByPeriod(allClosedTrades, period).map((t) => ({
      ...t,
      exchange: provider,
    }));
    const totalRealized = sumClosedTradesRealized(closedTrades);
    const analysis = analyzeClosedTrades(closedTrades);

    return NextResponse.json({
      success: true,
      closedTrades,
      totalRealized,
      analysis,
      period,
      periodLabel: closedTradesPeriodLabel(period),
      periodDays: closedTradesPeriodDays(period),
      leverageUsed: leverage,
      provider,
      exchange,
      blofin: provider === "blofin" ? exchange : undefined,
      coinbase: provider === "coinbase" ? exchange : undefined,
    });
  } catch (e) {
    console.error("Trading bot closed-trades:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to load closed trades." },
      { status: 500 }
    );
  }
}
