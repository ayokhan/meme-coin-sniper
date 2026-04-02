import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { closeTradingBotPosition } from "@/lib/trading-bot-run";
import { resolveBlofinConfigForTradingBotSession } from "@/lib/trading-bot-blofin-session";

export const dynamic = "force-dynamic";

/** POST - Close open position(s) on the signed-in user's Blofin account. Body: { instId?: string }; { closeAll: true }; omit instId to close bot symbol from shared config. */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const resolved = await resolveBlofinConfigForTradingBotSession(session);
    if (!resolved.ok) {
      return NextResponse.json({ success: false, error: resolved.error }, { status: resolved.status });
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
    const result = await closeTradingBotPosition({
      closeInstId,
      closeAll,
      posSide,
      blofinConfig: resolved.config,
    });
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
