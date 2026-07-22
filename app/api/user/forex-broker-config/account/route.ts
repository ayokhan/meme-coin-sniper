import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { FOREX_BROKER_IDS, getForexBrokerConfigForUser, parseForexBrokerId, type ForexBrokerId } from "@/lib/forex-broker-user-config";
import { getMetaApiAccountInformation, getMetaApiPositions, isMetaApiConfigured } from "@/lib/metaapi";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isValidBroker(v: unknown): v is ForexBrokerId {
  return parseForexBrokerId(v) != null;
}

/** GET ?broker= — account info + open positions via MetaAPI (only when provisioned). */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
    }
    const broker = new URL(request.url).searchParams.get("broker");
    if (!isValidBroker(broker)) {
      return NextResponse.json(
        { success: false, error: `broker must be one of: ${FOREX_BROKER_IDS.join(", ")}` },
        { status: 400 }
      );
    }

    const connection = await getForexBrokerConfigForUser(session.user.id, broker);
    if (!connection) {
      return NextResponse.json({ success: true, connected: false, account: null, positions: [] });
    }
    if (!connection.metaApiAccountId || !isMetaApiConfigured()) {
      return NextResponse.json({
        success: true,
        connected: false,
        needsProvisioning: true,
        account: null,
        positions: [],
      });
    }

    const [account, positions] = await Promise.all([
      getMetaApiAccountInformation(connection.metaApiAccountId),
      getMetaApiPositions(connection.metaApiAccountId),
    ]);

    return NextResponse.json({
      success: true,
      connected: true,
      account,
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
    });
  } catch (e) {
    console.error("forex-broker-config/account GET:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to load account." },
      { status: 500 }
    );
  }
}
