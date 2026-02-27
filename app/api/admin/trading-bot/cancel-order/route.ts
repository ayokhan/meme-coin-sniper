import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { cancelOrder as cancelOrderBlofin, isBlofinConfigured } from "@/lib/blofin";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

/** POST - Cancel an open (pending) order. Body: { orderId: string, instId: string }. Owner only. */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerSession(session)) {
      return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
    }
    if (!isBlofinConfigured()) {
      return NextResponse.json({ success: false, error: "Blofin not configured." }, { status: 400 });
    }
    const body = await req.json().catch(() => ({}));
    const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
    const instId = typeof body.instId === "string" ? body.instId.trim().toUpperCase().replace("/", "-") : "";
    if (!orderId || !instId) {
      return NextResponse.json({ success: false, error: "orderId and instId are required." }, { status: 400 });
    }
    const bot = await db.tradingBot.findFirst({ orderBy: { updatedAt: "desc" } });
    const isDemo = bot?.mode === "demo";
    const result = await cancelOrderBlofin(instId, orderId, { demo: isDemo });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error ?? "Failed to cancel order." }, { status: 400 });
    }
    return NextResponse.json({ success: true, message: "Order canceled." });
  } catch (e) {
    console.error("Trading bot cancel-order:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to cancel order." },
      { status: 500 }
    );
  }
}
