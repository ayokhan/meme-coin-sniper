import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { FOREX_BROKER_IDS, getForexBrokerConfigForUser, parseForexBrokerId, type ForexBrokerId } from "@/lib/forex-broker-user-config";
import {
  ensureMetaApiAccountReady,
  getMetaApiAccountInformationDetailed,
  getMetaApiHistoryDeals,
  getMetaApiOrders,
  getMetaApiPositions,
  isMetaApiConfigured,
  pairMetaApiClosedTrades,
} from "@/lib/metaapi";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

function isValidBroker(v: unknown): v is ForexBrokerId {
  return parseForexBrokerId(v) != null;
}

function periodStartIso(period: string): string {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  let ms = 7 * day;
  if (period === "1d") ms = day;
  else if (period === "3d") ms = 3 * day;
  else if (period === "30d") ms = 30 * day;
  else if (period === "90d") ms = 90 * day;
  else if (period === "all") ms = 365 * day;
  return new Date(now - ms).toISOString();
}

function mapOrderType(type: string): { side: "buy" | "sell" | "—"; kind: string } {
  const t = type.toUpperCase();
  const side = t.includes("BUY") ? "buy" : t.includes("SELL") ? "sell" : "—";
  let kind = "order";
  if (t.includes("LIMIT")) kind = "limit";
  else if (t.includes("STOP")) kind = "stop";
  else if (t.includes("MARKET")) kind = "market";
  return { side, kind };
}

/**
 * GET ?broker=&period=7d
 * Account info + open positions + pending orders + closed deals (records) via MetaAPI.
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
    }
    const url = new URL(request.url);
    const broker = url.searchParams.get("broker");
    const period = url.searchParams.get("period") || "7d";
    const wait = url.searchParams.get("wait") !== "0";

    if (!isValidBroker(broker)) {
      return NextResponse.json(
        { success: false, error: `broker must be one of: ${FOREX_BROKER_IDS.join(", ")}` },
        { status: 400 }
      );
    }

    const connection = await getForexBrokerConfigForUser(session.user.id, broker);
    if (!connection) {
      return NextResponse.json({
        success: true,
        connected: false,
        account: null,
        positions: [],
        orders: [],
        closedTrades: [],
      });
    }
    if (!connection.metaApiAccountId || !isMetaApiConfigured()) {
      return NextResponse.json({
        success: true,
        connected: false,
        needsProvisioning: true,
        account: null,
        positions: [],
        orders: [],
        closedTrades: [],
        accountError: !isMetaApiConfigured()
          ? "METAAPI_TOKEN is not configured on the server."
          : "Broker login is saved but not provisioned on MetaAPI yet.",
      });
    }

    const accountId = connection.metaApiAccountId;
    let readiness: { ready: boolean; state?: string; connectionStatus?: string; error?: string } | null = null;
    if (wait) {
      readiness = await ensureMetaApiAccountReady(accountId, 18000);
    }

    const [infoRes, positions, orders, deals] = await Promise.all([
      getMetaApiAccountInformationDetailed(accountId),
      getMetaApiPositions(accountId),
      getMetaApiOrders(accountId),
      getMetaApiHistoryDeals(accountId, periodStartIso(period), new Date(Date.now() + 60_000).toISOString(), 500),
    ]);

    const closedTrades = pairMetaApiClosedTrades(deals);

    return NextResponse.json({
      success: true,
      connected: true,
      demoMode: connection.demoMode,
      platform: connection.platform,
      server: connection.server,
      metaApi: readiness
        ? { state: readiness.state, connectionStatus: readiness.connectionStatus, ready: readiness.ready }
        : undefined,
      account: infoRes.ok
        ? {
            balance: infoRes.data.balance,
            equity: infoRes.data.equity,
            margin: infoRes.data.margin,
            freeMargin: infoRes.data.freeMargin,
            leverage: infoRes.data.leverage,
            currency: infoRes.data.currency || "USD",
          }
        : null,
      accountError: infoRes.ok
        ? null
        : infoRes.error ||
          readiness?.error ||
          "Could not load balance from MetaAPI yet. Tap Refresh in a few seconds.",
      positions: positions.map((p) => ({
        id: p.id,
        symbol: p.symbol,
        side: p.type === "POSITION_TYPE_BUY" ? "long" : "short",
        volume: p.volume,
        openPrice: p.openPrice,
        currentPrice: p.currentPrice ?? null,
        profit: p.profit ?? null,
        stopLoss: p.stopLoss ?? null,
        takeProfit: p.takeProfit ?? null,
      })),
      orders: orders.map((o) => {
        const { side, kind } = mapOrderType(String(o.type ?? ""));
        return {
          id: o.id,
          symbol: o.symbol,
          side,
          kind,
          type: o.type,
          state: o.state ?? null,
          volume: o.currentVolume ?? o.volume ?? null,
          openPrice: o.openPrice ?? null,
          currentPrice: o.currentPrice ?? null,
          stopLoss: o.stopLoss ?? null,
          takeProfit: o.takeProfit ?? null,
          time: o.time ?? null,
        };
      }),
      closedTrades: closedTrades.map((t) => ({
        id: t.id,
        symbol: t.symbol,
        side: t.side,
        volume: t.volume,
        openPrice: t.openPrice,
        closePrice: t.closePrice,
        profit: t.profit,
        openedAt: t.openedAt,
        closedAt: t.closedAt,
      })),
      period,
    });
  } catch (e) {
    console.error("forex-broker-config/account GET:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to load account." },
      { status: 500 }
    );
  }
}
