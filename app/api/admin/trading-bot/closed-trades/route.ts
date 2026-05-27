import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getFillsHistory, getOrderHistory } from "@/lib/blofin";
import {
  closedTradesFromFills,
  closedTradesFromOrders,
  closedTradesPeriodBeginMs,
  closedTradesPeriodDays,
  closedTradesPeriodLabel,
  filterClosedTradesByPeriod,
  mergeClosedTrades,
  sumClosedTradesRealized,
  type ClosedTradesPeriod,
} from "@/lib/closed-trades";
import { getTradingBotBlofinMeta, resolveBlofinConfigForTradingBotSession } from "@/lib/trading-bot-blofin-session";
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
    const resolved = await resolveBlofinConfigForTradingBotSession(session);
    if (!resolved.ok) {
      return NextResponse.json({ success: false, error: resolved.error }, { status: resolved.status });
    }
    const { config, credentialSource } = resolved;
    const blofin = await getTradingBotBlofinMeta(config, credentialSource);
    const leverage = await getBotLeverage();
    const { searchParams } = new URL(req.url);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "100", 10) || 100));
    const periodRaw = searchParams.get("period") ?? "7d";
    const period: ClosedTradesPeriod =
      periodRaw === "1d" || periodRaw === "3d" || periodRaw === "7d" || periodRaw === "30d" ? periodRaw : "7d";
    const beginMs = closedTradesPeriodBeginMs(period);

    const [fills, orders] = await Promise.all([
      getFillsHistory({ demo: blofin.blofinDemo, limit, beginMs, config }).catch(() => []),
      getOrderHistory({ demo: blofin.blofinDemo, limit, beginMs, config }),
    ]);

    const leverageByInst = new Map<string, number>();
    for (const o of orders) {
      const lev = Number(o.leverage);
      if (o.instId && Number.isFinite(lev) && lev > 0) leverageByInst.set(o.instId, lev);
    }

    const fromFills = closedTradesFromFills(fills, leverage, leverageByInst);
    const fromOrders = closedTradesFromOrders(orders, leverage);
    const allClosedTrades = mergeClosedTrades(fromFills, fromOrders);
    const closedTrades = filterClosedTradesByPeriod(allClosedTrades, period);
    const totalRealized = sumClosedTradesRealized(closedTrades);

    return NextResponse.json({
      success: true,
      closedTrades,
      totalRealized,
      period,
      periodLabel: closedTradesPeriodLabel(period),
      periodDays: closedTradesPeriodDays(period),
      leverageUsed: leverage,
      blofin,
    });
  } catch (e) {
    console.error("Trading bot closed-trades:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to load closed trades." },
      { status: 500 }
    );
  }
}
