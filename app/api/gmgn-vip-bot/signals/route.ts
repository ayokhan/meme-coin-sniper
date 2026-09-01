import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getGmgnVipBotAccess } from "@/lib/vip-futures-addon-access";
import { executeGmgnVipBotSignal } from "@/lib/gmgn-vip-bot-execute";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const access = await getGmgnVipBotAccess(session);
    if (!access.ok) {
      return NextResponse.json({ success: false, error: access.error, disabled: access.disabled }, { status: access.status });
    }
    const signals = await db.gmgnVipBotSignal.findMany({
      where: { userId: access.userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json({
      success: true,
      signals: signals.map((s: {
        id: string;
        chain: string;
        tokenAddress: string;
        symbol: string | null;
        name: string | null;
        status: string;
        reason: string | null;
        orderId: string | null;
        createdAt: Date;
      }) => ({
        id: s.id,
        chain: s.chain,
        tokenAddress: s.tokenAddress,
        symbol: s.symbol,
        name: s.name,
        status: s.status,
        reason: s.reason,
        orderId: s.orderId,
        createdAt: s.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    console.error("gmgn-vip-bot/signals GET:", e);
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "Failed." }, { status: 500 });
  }
}

/** POST { signalId, action: "approve" | "reject" } */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const access = await getGmgnVipBotAccess(session);
    if (!access.ok) {
      return NextResponse.json({ success: false, error: access.error, disabled: access.disabled }, { status: access.status });
    }

    const body = (await request.json().catch(() => ({}))) as { signalId?: string; action?: string };
    const signalId = String(body.signalId ?? "").trim();
    const action = body.action === "reject" ? "reject" : "approve";
    if (!signalId) {
      return NextResponse.json({ success: false, error: "signalId required." }, { status: 400 });
    }

    if (action === "reject") {
      await db.gmgnVipBotSignal.updateMany({
        where: { id: signalId, userId: access.userId, status: "pending" },
        data: { status: "rejected" },
      });
      return NextResponse.json({ success: true, status: "rejected" });
    }

    await db.gmgnVipBotSignal.updateMany({
      where: { id: signalId, userId: access.userId, status: "pending" },
      data: { status: "approved" },
    });

    const result = await executeGmgnVipBotSignal(access.userId, session, signalId);
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 502 });
    }
    return NextResponse.json({ success: true, status: "executed", orderId: result.orderId ?? null });
  } catch (e) {
    console.error("gmgn-vip-bot/signals POST:", e);
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "Failed." }, { status: 500 });
  }
}
