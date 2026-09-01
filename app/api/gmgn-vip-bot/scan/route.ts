import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getGmgnVipBotAccess } from "@/lib/vip-futures-addon-access";
import { getGmgnVipBotConfigView, resolveUserGmgnCredentials } from "@/lib/gmgn-vip-bot-config";
import { scanGmgnVipBot } from "@/lib/gmgn-vip-bot-scan";
import { executeGmgnVipBotSignal } from "@/lib/gmgn-vip-bot-execute";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    const access = await getGmgnVipBotAccess(session);
    if (!access.ok) {
      return NextResponse.json({ success: false, error: access.error, disabled: access.disabled }, { status: access.status });
    }

    const config = await getGmgnVipBotConfigView(access.userId);
    // Manual Scan now works even when the bot toggle is off (cron still requires enabled).

    const creds = await resolveUserGmgnCredentials(access.userId, session);
    if (!creds?.apiKey) {
      return NextResponse.json(
        { success: false, error: "Add your GMGN API key and private key in bot settings." },
        { status: 400 }
      );
    }

    const result = await scanGmgnVipBot({
      userId: access.userId,
      creds,
      chains: config.chains,
      maxOpenTrades: config.maxOpenTrades,
      minLiquidityUsd: config.minLiquidityUsd,
      minMomentum1hPct: config.minMomentum1hPct,
    });

    if (config.tradingMode === "auto" && result.created > 0) {
      const pending = await db.gmgnVipBotSignal.findMany({
        where: { userId: access.userId, status: "pending" },
        orderBy: { createdAt: "asc" },
      });
      for (const sig of pending) {
        await executeGmgnVipBotSignal(access.userId, session, sig.id);
      }
    }

    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    console.error("gmgn-vip-bot/scan POST:", e);
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "Scan failed." }, { status: 500 });
  }
}
