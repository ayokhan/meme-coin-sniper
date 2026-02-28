import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, canAccessTradingBot } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { runAIMonitorCycle } from "@/lib/trading-bot-run";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

/** POST - Run AI monitor once. When Autopilot is on, closes positions automatically. When off, returns suggested closes only (no close). Owner only. Body: { pinnedOnly?: boolean } — true = only pinned (monitoring board) symbols, false/omit = all open positions. */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!canAccessTradingBot(session)) {
      return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
    }
    let pinnedOnly: boolean | undefined;
    try {
      const body = await req.json().catch(() => ({}));
      pinnedOnly = body.pinnedOnly === true ? true : body.pinnedOnly === false ? false : undefined;
    } catch {
      pinnedOnly = undefined;
    }
    const bot = await db.tradingBot.findFirst({ orderBy: { updatedAt: "desc" } });
    const autopilot = (bot as { aiMonitorAutopilot?: boolean } | null)?.aiMonitorAutopilot ?? false;
    const result = await runAIMonitorCycle({ dryRun: !autopilot, pinnedOnly });
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
