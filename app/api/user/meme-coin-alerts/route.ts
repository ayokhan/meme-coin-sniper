import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** GET: recent first-buy alerts for current user's meme coin wallets (in-app). */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Sign in required" }, { status: 401 });
    }
    const alerts = await prisma.userMemeCoinAlert.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json({
      success: true,
      alerts: alerts.map((a) => ({
        id: a.id,
        walletAddress: a.walletAddress,
        contractAddress: a.contractAddress,
        symbol: a.symbol,
        createdAt: a.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch alerts";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
