import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, canAccessTradingBot, isOwnerSession } from "@/lib/auth";
import { runNovaScalperTick } from "@/lib/nova-scalper-run";

export const dynamic = "force-dynamic";

/** POST — run one NovaScalper price check / trade step. Uses your Blofin keys (Trading Bot); owner may fall back to server env. */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!canAccessTradingBot(session) || !session?.user?.id) {
      return NextResponse.json({ success: false, error: "Trading Bot access required." }, { status: 403 });
    }
    const allowEnvFallback = isOwnerSession(session);
    const result = await runNovaScalperTick(session.user.id, { allowEnvFallback });
    return NextResponse.json({
      success: result.ok,
      message: result.message,
      error: result.error,
      action: result.action,
    });
  } catch (e) {
    console.error("nova-scalper tick:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Tick failed." },
      { status: 500 }
    );
  }
}
