import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import { closeTradingBotPosition } from "@/lib/trading-bot-run";

export const dynamic = "force-dynamic";

/** POST - Close open position. Body: { instId?: string } to close a specific symbol; omit to close bot's symbol. Owner only. */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerSession(session)) {
      return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
    }
    let instId: string | undefined;
    try {
      const body = await req.json().catch(() => ({}));
      instId = typeof body?.instId === "string" ? body.instId.trim() || undefined : undefined;
    } catch {
      // no body
    }
    const result = await closeTradingBotPosition(instId);
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
