import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getOpenOrders, isBlofinConfigured } from "@/lib/blofin";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

/** GET - Open (pending) orders from Blofin. Owner only. */
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerSession(session)) {
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
    const orders = await getOpenOrders({ demo: isDemo, instId, limit });
    return NextResponse.json({ success: true, orders });
  } catch (e) {
    console.error("Trading bot open-orders:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to load open orders." },
      { status: 500 }
    );
  }
}
