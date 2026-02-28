import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import { leverageDb } from "@/lib/leverage-db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Owner only. Returns recent in-app leverage alerts (position changes). */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerSession(session)) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    const alerts = await leverageDb.leverageAlert.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json({
      success: true,
      alerts: alerts.map((a) => ({
        id: a.id,
        walletAddress: a.walletAddress,
        nickname: a.nickname,
        positionsSummary: a.positionsSummary,
        createdAt: a.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch alerts";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
