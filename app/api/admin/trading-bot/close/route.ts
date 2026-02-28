import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, canAccessTradingBot } from "@/lib/auth";
import { closeTradingBotPosition } from "@/lib/trading-bot-run";

export const dynamic = "force-dynamic";

/** POST - Close open position(s). Body: { instId?: string } close one symbol; { closeAll: true } close all positions; omit to close bot's symbol. Owner only. */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!canAccessTradingBot(session)) {
      return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
    }
    let closeInstId: string | undefined;
    let closeAll = false;
    let posSide: "long" | "short" | "net" | undefined;
    try {
      const body = await req.json().catch(() => ({}));
      closeInstId = typeof body?.instId === "string" ? body.instId.trim() || undefined : undefined;
      closeAll = body?.closeAll === true;
      if (body?.posSide === "long" || body?.posSide === "short" || body?.posSide === "net") posSide = body.posSide;
    } catch {
      // no body
    }
    const result = await closeTradingBotPosition({ closeInstId, closeAll, posSide });
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
