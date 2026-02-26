import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import { closeTradingBotPosition } from "@/lib/trading-bot-run";

export const dynamic = "force-dynamic";

/** POST - Close open position for the bot's symbol (Blofin). Owner only. */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerSession(session)) {
      return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
    }
    const result = await closeTradingBotPosition();
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error ?? "Failed to close position." },
        { status: result.error?.includes("No open position") ? 404 : 400 }
      );
    }
    return NextResponse.json({ success: true, message: result.message ?? "Position closed." });
  } catch (e) {
    console.error("Trading bot close:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to close position." },
      { status: 500 }
    );
  }
}
