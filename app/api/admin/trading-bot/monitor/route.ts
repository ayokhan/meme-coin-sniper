import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import { runAIMonitorCycle } from "@/lib/trading-bot-run";

export const dynamic = "force-dynamic";

/** POST - Run AI monitor once: evaluate open positions and close if trend is opposite or negative. Owner only. */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerSession(session)) {
      return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
    }
    const result = await runAIMonitorCycle();
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error ?? "Monitor failed." }, { status: 400 });
    }
    return NextResponse.json({
      success: true,
      closed: result.closed ?? 0,
      message: result.message ?? (result.closed ? "Positions closed." : "No positions closed."),
      reasons: result.reasons,
    });
  } catch (e) {
    console.error("Trading bot monitor:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Monitor failed." },
      { status: 500 }
    );
  }
}
