import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { mergeTpTargets, runAIMonitorCycle } from "@/lib/trading-bot-run";
import { resolveBlofinConfigForTradingBotSession } from "@/lib/trading-bot-blofin-session";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

/** POST - Run AI monitor. Body: { pinnedOnly?: boolean, deepOnly?: boolean, tpTargets?: object }. */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const resolved = await resolveBlofinConfigForTradingBotSession(session);
    if (!resolved.ok) {
      return NextResponse.json({ success: false, error: resolved.error }, { status: resolved.status });
    }
    let pinnedOnly: boolean | undefined;
    let deepOnly = false;
    let tpTargetsBody: Record<string, number | string> | null = null;
    try {
      const body = await req.json().catch(() => ({}));
      pinnedOnly = body.pinnedOnly === true ? true : body.pinnedOnly === false ? false : undefined;
      deepOnly = body.deepOnly === true;
      if (body.tpTargets && typeof body.tpTargets === "object" && body.tpTargets !== null) {
        tpTargetsBody = body.tpTargets as Record<string, number | string>;
      }
    } catch {
      pinnedOnly = undefined;
    }
    const bot = await db.tradingBot.findFirst({ orderBy: { updatedAt: "desc" } });
    const autopilot = (bot as { aiMonitorAutopilot?: boolean } | null)?.aiMonitorAutopilot ?? false;
    const deepAutopilot = (bot as { aiMonitorDeepCheckAutopilot?: boolean } | null)?.aiMonitorDeepCheckAutopilot ?? false;
    const runDeepEach = (bot as { aiMonitorRunDeepEachCycle?: boolean } | null)?.aiMonitorRunDeepEachCycle ?? false;
    const dbTpJson = (bot as { monitorTpTargetsJson?: string | null } | null)?.monitorTpTargetsJson;
    const tpTargets = mergeTpTargets(dbTpJson, tpTargetsBody);

    if (deepOnly) {
      const result = await runAIMonitorCycle({
        blofinConfig: resolved.config,
        deepOnly: true,
        pinnedOnly,
        tpTargets: Object.keys(tpTargets).length ? tpTargets : null,
      });
      if (!result.ok) {
        return NextResponse.json({ success: false, error: result.error ?? "Deep check failed." }, { status: 400 });
      }
      return NextResponse.json({
        success: true,
        closed: 0,
        message: result.message ?? "Deep check complete.",
        reasons: result.reasons,
        suggestedCloses: [],
        deepReasons: result.deepReasons ?? result.reasons ?? [],
        deepSuggestedCloses: result.deepSuggestedCloses ?? [],
      });
    }

    const result = await runAIMonitorCycle({
      dryRun: !autopilot,
      deepCloseDryRun: !deepAutopilot,
      runDeepEachCycle: runDeepEach,
      pinnedOnly,
      blofinConfig: resolved.config,
      tpTargets: Object.keys(tpTargets).length ? tpTargets : null,
    });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error ?? "Monitor failed." }, { status: 400 });
    }
    return NextResponse.json({
      success: true,
      closed: result.closed ?? 0,
      message: result.message ?? "Evaluation complete.",
      reasons: result.reasons,
      suggestedCloses: result.suggestedCloses ?? [],
      deepReasons: result.deepReasons ?? [],
      deepSuggestedCloses: result.deepSuggestedCloses ?? [],
    });
  } catch (e) {
    console.error("Trading bot monitor:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Monitor failed." },
      { status: 500 }
    );
  }
}
