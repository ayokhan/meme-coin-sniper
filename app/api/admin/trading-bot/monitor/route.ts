import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { runAIMonitorCycle } from "@/lib/trading-bot-run";
import { resolveBlofinConfigForTradingBotSession } from "@/lib/trading-bot-blofin-session";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

/** POST - Run AI monitor on the signed-in user's Blofin positions. Body: { pinnedOnly?: boolean }. */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const resolved = await resolveBlofinConfigForTradingBotSession(session);
    if (!resolved.ok) {
      return NextResponse.json({ success: false, error: resolved.error }, { status: resolved.status });
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
    const result = await runAIMonitorCycle({ dryRun: !autopilot, pinnedOnly, blofinConfig: resolved.config });
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
