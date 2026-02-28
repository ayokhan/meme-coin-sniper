import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, canAccessTradingBot } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getOrderHistory, isBlofinConfigured } from "@/lib/blofin";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

/** GET - Order history from Blofin. Owner only. */
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!canAccessTradingBot(session)) {
      return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
    }
    if (!isBlofinConfigured()) {
      return NextResponse.json({ success: false, error: "Blofin not configured." }, { status: 400 });
    }
    const bot = await db.tradingBot.findFirst({ orderBy: { updatedAt: "desc" } });
    const isDemo = bot?.mode === "demo";
    const { searchParams } = new URL(req.url);
    const instId = searchParams.get("instId") ?? undefined;
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10) || 50));
    const orders = await getOrderHistory({ demo: isDemo, instId, limit });
    return NextResponse.json({ success: true, orders });
  } catch (e) {
    console.error("Trading bot orders-history:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to load order history." },
      { status: 500 }
    );
  }
}
