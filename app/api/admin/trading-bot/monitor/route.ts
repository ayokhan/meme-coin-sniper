import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, canAccessTradingBot } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { runAIMonitorCycle } from "@/lib/trading-bot-run";

export const dynamic = "force-dynamic";

/** POST - Run AI monitor once. When Autopilot is on, closes positions automatically. When off, returns suggested closes only (no close). Owner only. */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!canAccessTradingBot(session)) {
      return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
    }
    const bot = await prisma.tradingBot.findFirst({ orderBy: { updatedAt: "desc" } });
    const autopilot = (bot as { aiMonitorAutopilot?: boolean } | null)?.aiMonitorAutopilot ?? false;
    const result = await runAIMonitorCycle({ dryRun: !autopilot });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error ?? "Monitor failed." }, { status: 400 });
    }
    return NextResponse.json({
      success: true,
      closed: result.closed ?? 0,
      message: result.message ?? "Evaluation complete.",
      reasons: result.reasons,
      suggestedCloses: result.suggestedCloses ?? [],
    });
  } catch (e) {
    console.error("Trading bot monitor:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Monitor failed." },
      { status: 500 }
    );
  }
}
